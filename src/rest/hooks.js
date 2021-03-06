'use strict'

const Middleware = require('@octokit/webhooks/middleware')

const config = require('../config/config').get()
const logger = require('../lib/logger')
const Redis = require('../lib/redis-wrapper')
const events = require('../socket/events')
const { getKnex, tables } = require('../lib/knex')

const knex = getKnex()
class Hooks {
  static get (opts) {
    return new Hooks(opts)
  }

  constructor (opts) {
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
    if (!config.githubWebhookSecret) {
      throw Error(logger.missingEnvVar('GITHUB_WEBHOOK_SECRET'))
    }

    return new Middleware({
      secret: config.githubWebhookSecret,
      path: config.githubWebhookUrl // defaults to "/github-webhooks"
    })
  }

  // TODO: Separate these into service?
  mountHooks () {
    this.webhooks.on(Hooks.ACTIONS.LABELED, async ({ id, name, payload }) => {
      // const roomSlug = payload && payload.repository && payload.repository.full_name
      // const roomRedis = Redis.get({
      //   room: roomSlug
      // })
      // const votingLabel = await roomRedis.getVotingLabel()
      // const hookLabel = payload && payload.label
      // if (hookLabel.name === votingLabel) {
      //   // Add issue to room
      //   await roomRedis.addIssue(payload.issue)
      //   // Emit to room
      //   this.io.to(roomSlug).emit(events.ISSUE, payload.issue)
      // }
    })

    this.webhooks.on(Hooks.ACTIONS.UNLABELED, async ({ id, name, payload }) => {
      // const roomSlug = payload && payload.repository && payload.repository.full_name
      // const roomRedis = Redis.get({
      //   room: roomSlug
      // })
      // const votingLabel = await roomRedis.getVotingLabel()
      // const hookLabel = payload && payload.label
      // if (hookLabel.name === votingLabel) {
      //   // Remove issue from room
      //   await roomRedis.removeIssue(payload.issue)
      //   // Emit to room
      //   this.io.to(roomSlug).emit(events.ISSUE, payload.issue)
      // }

      // TODO: add deletedAdd and maybe change deleted to voted or swagged
      let story = await knex(tables.STORY)
        .update({
          deleted: true
        })
        .where('githubIssueLabel', payload.label.name)
        .where('githubIssueId', payload.issue.id)
        .returning('*')

      if (story && story.length > 0) {
        story = story[0]
      } else {
        return
      }

      let roomStoryMap = await knex(tables.MAP_ROOM_AND_STORY)
        .del()
        .where('storyId', story.id)
        .returning('*')

      if (roomStoryMap && roomStoryMap.length > 0) {
        roomStoryMap = roomStoryMap[0]
      } else {
        return
      }

      const stories = await knex({ r: tables.ROOM })
        .leftJoin(`${tables.MAP_ROOM_AND_STORY} as mras`, 'mras.roomId', 'r.id')
        .leftJoin(`${tables.STORY} as s`, 's.id', 'mras.storyId')
        .select(
          's.*'
        )
        .where('r.id', roomStoryMap.roomId)
        .where('s.deleted', false)

      this.io.to(roomStoryMap.roomId).emit(events.STORIES, { stories })
    })

    this.webhooks.on('error', (error) => {
      logger.error(`GH Webhooks Error: "${error.event.name} handler: ${error.stack}"`)
    })

    this._mounted = true // TODO: Use better pattern?
  }
}

Hooks.ACTIONS = {
  LABELED: 'issues.labeled',
  UNLABELED: 'issues.unlabeled'
}

module.exports = Hooks
