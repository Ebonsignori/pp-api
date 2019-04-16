const server = require('../src/server')
const got = require('got')
const assert = require('assert')
class Helper {
  static get (opts) {
    return new Helper(opts)
  }

  constructor (opts = {}) {
    this._knex = opts.knex
    this._server = opts.server
    this._serverConfig = opts.serverConfig
    this._verbose = opts.verbose
    this._port = opts.port
  }

  get server () {
    if (!this._server) {
      this._server = server.get({
        logger: this.logger,
        config: this._serverConfig
      })
    }
    return this._server
  }

  get knex () {
    if (!this._knex) this._knex = require('../src/lib/knex').getKnex()
    return this._knex
  }

  get port () {
    if (!this._port) this._port = 5431
    return this._port
  }

  get config () {
    if (!this._config) throw Error('Init server or pass config in init before calling config')
    return this._config
  }

  get logger () {
    if (!this._logger) this._logger = this.mockLogger
    return this._logger
  }

  get verbose () {
    if (!this._verbose) this._verbose = false
    return this._verbose
  }

  get mockLogger () {
    return {
      silly: this.verbose ? (msg) => console.log(`mockSilly: ${msg}`) : () => {},
      debug: this.verbose ? (msg) => console.log(`mockDebug: ${msg}`) : () => {},
      info: this.verbose ? (msg) => console.log(`mockInfo: ${msg}`) : () => {},
      warn: this.verbose ? (msg) => console.log(`mockWarn: ${msg}`) : () => {},
      error: this.verbose ? (msg) => console.log(`mockError: ${msg}`) : () => {}
    }
  }

  async startServer () {
    await this.server.start(this.port)
    if (!this._config) this._config = this.server.config
  }

  async stopServer () {
    return this.server.stop()
  }

  url (uri) {
    return `http://localhost:${this.port}${uri}`
  }

  async get (route, opts) {
    opts = opts || {}

    const gotOpts = { json: true }
    if (opts.cookieUser) gotOpts.headers = { cookie: this.cookies[opts.cookieUser] }
    if (opts.headers) gotOpts.headers = { ...gotOpts.headers, ...opts.headers }

    let response
    try {
      response = await got(this.url(route), gotOpts)
      if (opts.cookieUser && response.headers['set-cookie']) {
        this.setCookieForUser(opts.cookieUser, response.headers['set-cookie'][0])
      }
    } catch (err) {
      response = err.response
    }
    return response
  }

  async post (route, data, opts) {
    opts = opts || {}

    const gotOpts = {
      method: opts.method || 'POST',
      json: true,
      body: data
    }
    if (opts.form) gotOpts.form = true
    if (opts.cookieUser) gotOpts.headers = { cookie: this.cookies[opts.cookieUser] }

    if (opts.headers) gotOpts.headers = { ...gotOpts.headers, ...opts.headers }

    let response
    try {
      response = await got(this.url(route), gotOpts)
      if (opts.cookieUser && response.headers['set-cookie']) {
        this.setCookieForUser(opts.cookieUser, response.headers['set-cookie'][0])
      }
    } catch (err) {
      response = err.response
    }
    return response
  }

  // for debugging
  async redisScan () {
    return this.get('/debug/redis-scan')
  }

  // - - - Database - - -
  get tables () {
    if (!this._tables) this._tables = require('../src/lib/knex').tables
    return this._tables
  }
  async dbInsert (table, objToInsert) {
    const res = await this.knex(table).insert(objToInsert).returning('*')
    if (res && res.length === 1) {
      return res[0]
    }
    return res
  }
  async dbDelete (table, whereQuery) {
    const res = await this.knex(table).where(whereQuery).del().returning('*')
    if (res && res.length === 1) {
      return res[0]
    }
    return res
  }
  async dbUpdate (table, objOfUpdates, whereParams) {
    const res = await this.knex(table).where(whereParams).update(objOfUpdates).returning('*')
    if (res && res.length === 1) {
      return res[0]
    }
    return res
  }

  // - - - Assertions - - -
  assertStatus (res, status) {
    assert.strictEqual(res.statusCode, status, 'Unexpected HTTP Status')
  }

  // - - - In memory mock data - - -
  get mockUser () {
    return {
      username: 'test',
      password: 'Dp93Zaw#g^JQeZkS*y'
    }
  }

  get cookies () {
    if (!this._cookies) this._cookies = {}
    return this._cookies
  }

  getCookieForUser (username) {
    return this.cookies[username]
  }

  setCookieForUser (username, cookieHeader) {
    this.cookies[username] = cookieHeader.substr(0, cookieHeader.indexOf(';'))
  }
}

module.exports = Helper
