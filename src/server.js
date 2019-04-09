'use strict'

require('dotenv').config() // Load private env from .env
const isMain = require.main === module

const Generic = require('./lib/generic-class')
const chalk = require('chalk')

class Server extends Generic {
  static get (opts) {
    return Generic.get(Server, opts)
  }

  constructor (opts = {}) {
    super(opts)
    this._server = opts.server
    this._redis = opts.redis
    this._storage = opts.storage
  }

  get app () {
    if (!this._server || !this._app) {
      const { server, app } = this.initializeServer()
      this._server = server
      this._app = app
    }
    return this._app
  }

  get server () {
    if (!this._server || !this._app) {
      const { server, app } = this.initializeServer()
      this._server = server
      this._app = app
    }
    return this._server
  }

  get redis () {
    if (!this._redis) this._redis = require('./lib/redis-client').get()
    return this._redis
  }

  get session () {
    if (!this._session) throw Error('Call initializeServer() to generate session.')
    return this._session
  }

  initializeServer () {
    const http = require('http')
    const express = require('express')
    const app = express()

    // Apply express config
    this._session = require('./config/express-middlewares')(app, this.config, this.logger, this.redis.client)

    // Apply passport
    const { initialize, passportSession } = require('./config/passport')(this.storage, this.config, this.logger)
    app.use(initialize)
    app.use(passportSession)

    // Apply routes
    const Routes = require('./routes').get({
      config: this.config,
      logger: this.logger
    })
    app.use(Routes.middleware)

    const server = http.createServer(app)
    return { server, app }
  }

  async start () {
    // Init socket
    const io = require('./socket').initializeSocket(this.server, this.session, this.logger, this.config)

    // Apply GitHub webhooks
    const Hooks = require('./hooks').get({
      config: this.config,
      logger: this.logger,
      io
    })
    this.app.use(Hooks.middleware)

    // Start server
    try {
      this._runningServer = await this.server.listen(this.config.port)
    } catch (error) {
      console.error(error)
      return false
    }

    // Attach io instance to express making it accessible as req.app.get('io') in routes
    this.app.set('io', io)

    this.logger.info(chalk`Server and socket are up and listening. On port: {magenta.bold ${this.config.port}}.`)

    if (this.config.isDev) require('./lib/utils').getDevUrl(this.config, this.logger)

    return true
  }

  async stop () {
    if (!this._runningServer) {
      this.logger.error('No server is currently running')
      return false
    }

    try {
      await this._runningServer.close()
    } catch (err) {
      this.logger.error(err)
      return false
    }

    if (this.config.isDev) {
      this.logger.info(chalk`
        Port {magenta.bold ${this.config.port}} closed.
        `)
    }

    return true
  }
}

let server
if (isMain) {
  server = new Server()
  server.start().then(() => {
    // On success
    // server.logger.info('')
  }).catch((err) => {
    // On fail
    console.error(err)
  })
}

// Export server instance
module.exports = server
