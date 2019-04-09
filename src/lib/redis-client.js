'use strict'

const Redis = require('ioredis')
const Generic = require('./generic-class')

let staticClient
class RedisWrapper extends Generic {
  static get (opts) {
    return Generic.get(RedisWrapper, opts)
  }

  constructor (opts) {
    super(opts)

    this._client = opts.client
    if (!this._client && !staticClient) staticClient = this.initializeRedis()
  }

  get client () {
    if (!this._client) this._client = staticClient
    return this._client
  }

  initializeRedis () {
    const redisConfig = {}
    if (this.config.redisPassword) redisConfig.password = this.config.redisPassword

    let client
    try {
      client = new Redis(this.config.redisPort, this.config.redisHost, redisConfig)
    } catch (err) {
      console.error('Error starting Redis:')
      console.error(err)
      process.exit(1)
    }
    return client
  }
}

module.exports = RedisWrapper
