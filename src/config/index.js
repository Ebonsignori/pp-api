class Config {
  static get () {
    return new Config()
  }

  get logger () {
    if (!this._logger) this._logger = require('./logging')(this.loggingLevel)
    return this._logger
  }

  constructor (opts = {}) {
    this._logger = opts.logger
    this._isDev = opts.isDev
  }

  // Determine NODE_ENV
  get isDev () {
    if (!this._isDev) this._isDev = ['development', 'dev', 'test', 'testing', 'local'].some(x => x.toUpperCase() === String(process.env.NODE_ENV).toUpperCase())
    return this._isDev
  }

  // silly, debug, info, warn, error
  get loggingLevel () {
    return process.env.LOGGING_LEVEL || 'info'
  }

  get storageDirectory () {
    return process.env.STORAGE_DIRECTORY || 'storage-files'
  }

  /* - - - Configured for github App - - - */
  get githubAppId () {
    return process.env.GITHUB_APP_ID
  }

  get githubAppPrivateKey () {
    return process.env.GITHUB_APP_PRIVATE_KEY
  }

  get githubClientId () {
    return process.env.GITHUB_CLIENT_ID
  }

  get githubClientSecret () {
    return process.env.GITHUB_CLIENT_SECRET
  }

  get githubWebhookUrl () {
    return process.env.GITHUB_WEBHOOK_URL || '/github-webhooks'
  }

  get githubWebhookSecret () {
    return process.env.GITHUB_WEBHOOK_SECRET
  }

  /* - - - Configured for Github repo - - - */
  get votingLabelName () {
    return process.env.VOTING_LABEL_NAME || 'swag-ready'
  }

  /* - - - Configured for server - - - */
  get hostname () {
    return process.env.HOSTNAME || 'http://150aae4a.ngrok.io/' // TODO: change to another default
  }
  get port () {
    return process.env.PORT || '4390'
  }

  get sessionSecret () {
    return process.env.SESSION_SECRET || 'a ssssecrett'
  }

  get allowedOrigin () {
    if (this.isDev) return process.env.DEV_ORIGIN || 'http://localhost:8086'
    if (!process.env.ALLOWED_ORIGIN) throw Error('Declare an ALLOWED_ORIGIN of frontend in .env for production.')
    return process.env.ALLOWED_ORIGIN
  }

  /* - - - Redis - - - */
  get redisHost () {
    return process.env.REDIS_HOST || 'localhost'
  }

  get redisPort () {
    return this.asInt(process.env.REDIS_PORT, 6379)
  }

  get redisPassword () {
    return process.env.REDIS_PASSWORD || null
  }

  asInt (str, dfault) {
    const i = parseInt(str, 10)
    return isNaN(i) ? dfault : i
  }
}

module.exports = Config
