const Middleware = require('@octokit/webhooks/middleware')
const Generic = require('../lib/generic-class')
const Redis = require('../lib/redis-wrapper')
const events = require('../socket/events')

class Hooks extends Generic {
  static get (opts) {
    return Generic.get(Hooks, opts)
  }

  constructor (opts) {
    super(opts)

    this._webhooks = opts.webhooks
    this._io = opts.io
    this._mounted = opts.mounted
  }

  get webhooks () {
    if (!this._webhooks) this._webhooks = this.initializeHooks()
    return this._webhooks
  }

  get io () {
    if (!this._io) throw Error('Must include io in Hooks instantiation.')
    return this._io
  }

  // Init webhook middleware and mount
  get middleware () {
    if (!this._webhooks) this._webhooks = this.initializeHooks()
    if (!this._mounted) this.mountHooks()
    return this._webhooks
  }

  initializeHooks () {
    if (!this.config.githubWebhookSecret) {
      throw Error(this.logger.missingEnvVar('GITHUB_WEBHOOK_SECRET'))
    }

    return new Middleware({
      secret: this.config.githubWebhookSecret,
      path: this.config.githubWebhookUrl // defaults to "/github-webhooks"
    })
  }

  // TODO: Separate these into service?
  mountHooks () {
    this.webhooks.on(Hooks.ACTIONS.LABELED, async ({ id, name, payload }) => {
      const roomSlug = payload && payload.repository && payload.repository.full_name
      const roomRedis = Redis.get({
        room: roomSlug
      })
      const votingLabel = await roomRedis.getVotingLabel()
      const hookLabel = payload && payload.label
      if (hookLabel.name === votingLabel) {
        // Add issue to room
        await roomRedis.addIssue(payload.issue)
        // Emit to room
        this.io.to(roomSlug).emit(events.ISSUE, payload.issue)
      }
    })

    this.webhooks.on(Hooks.ACTIONS.UNLABELED, async ({ id, name, payload }) => {
      const roomSlug = payload && payload.repository && payload.repository.full_name
      const roomRedis = Redis.get({
        room: roomSlug
      })
      const votingLabel = await roomRedis.getVotingLabel()
      const hookLabel = payload && payload.label
      if (hookLabel.name === votingLabel) {
        // Remove issue from room
        await roomRedis.removeIssue(payload.issue)
        // Emit to room
        this.io.to(roomSlug).emit(events.ISSUE, payload.issue)
      }
    })

    this.webhooks.on('error', (error) => {
      this.logger.error(`GH Webhooks Error: "${error.event.name} handler: ${error.stack}"`)
    })

    this._mounted = true // TODO: Use better pattern?
  }
}

Hooks.ACTIONS = {
  LABELED: 'issues.labeled',
  UNLABELED: 'issues.unlabeled'
}

module.exports = Hooks
