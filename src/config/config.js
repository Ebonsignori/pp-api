'use strict'

// Globals
let hostname
class Config {
  static get () {
    return new Config()
  }

  constructor (opts = {}) {
    this._isDev = opts.isDev
  }

  // Determine NODE_ENV
  get isDev () {
    if (!this._isDev) this._isDev = ['development', 'dev', 'local'].some(x => x.toUpperCase() === String(process.env.NODE_ENV).toUpperCase())
    return this._isDev
  }

  get isTest () {
    if (!this._isTest) this._isTest = ['test', 'testing'].some(x => x.toUpperCase() === String(process.env.NODE_ENV).toUpperCase())
    return this._isTest
  }

  // silly, debug, info, warn, error
  get loggingLevel () {
    return process.env.LOGGING_LEVEL || 'info'
  }

  /* - - - Users - - - */
  get saltRounds () {
    return 12
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

  /* - - - Configured for server - - - */
  setHostname (url) {
    hostname = url
  }

  get hostname () {
    if (this.isTest) return 'localhost'
    if (hostname) return hostname
    if (!this._hostname) this._hostname = process.env.HOSTNAME || 'http://150aae4a.ngrok.io/' // TODO: change to another default
    return this._hostname
  }

  get port () {
    if (this.isTest) return '4391'
    return process.env.PORT || '4390'
  }

  get sessionSecret () {
    return process.env.SESSION_SECRET || 'a ssssecrett'
  }

  get allowedOrigin () {
    if (this.isDev) return process.env.DEV_ORIGIN || 'http://localhost:8086'
    if (!process.env.ALLOWED_ORIGIN) throw Error('Declare production ALLOWED_ORIGIN for pp-web origin url in .env')
    return process.env.ALLOWED_ORIGIN
  }

  get ngrokHelperPort () {
    return process.env.NGROK_HELPER_PORT || '4040'
  }

  /* - - - Database - - - */
  get dbHost () {
    return process.env.DB_HOST || 'localhost'
  }

  get dbPort () {
    if (this.isTest) return this.asInt(process.env.DB_TEST_PORT)
    return this.asInt(process.env.DB_PORT, 5433)
  }

  get dbUser () {
    return process.env.DB_USER || 'root'
  }

  get dbPassword () {
    return process.env.DB_PASSWORD || 'root'
  }

  get dbName () {
    return process.env.DB_NAME || 'pp-api-db'
  }

  get dbPoolMin () {
    return this.asInt(process.env.DB_POOL_MIN, 2)
  }

  get dbPoolMax () {
    return this.asInt(process.env.DB_POOL_MAX, 10)
  }

  get postgresVersion () {
    return process.env.POSTGRES_VERSION || '11.2'
  }

  /* - - - Redis - - - */
  get redisHost () {
    return process.env.REDIS_HOST || 'localhost'
  }

  get redisPort () {
    if (this.isTest) return this.asInt(process.env.REDIS_TEST_PORT)
    return this.asInt(process.env.REDIS_PORT, 6379)
  }

  get redisPassword () {
    return process.env.REDIS_PASSWORD
  }

  asInt (str, dfault) {
    const i = parseInt(str, 10)
    return isNaN(i) ? dfault : i
  }
}

module.exports = Config
