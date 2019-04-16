'use strict'

require('dotenv').config() // Load private env from .env

const isMain = require.main === module

const chalk = require('chalk')

const { initializeKnex } = require('./lib/knex')
const redisClient = require('./lib/redis-client')

class Server {
  static get (opts) {
    return new Server(opts)
  }

  constructor (opts = {}) {
    this._config = opts.config
    this._logger = opts.logger
  }

  get config () {
    if (!this._config) this._config = require('./config/config').get()
    return this._config
  }

  get logger () {
    if (!this._logger) this._logger = require('./lib/logger')
    return this._logger
  }

  async start (port) {
    const http = require('http')
    const express = require('express')
    const app = express()

    // Start knex
    await initializeKnex()

    // Apply express config
    const session = require('./config/express')(app, redisClient)

    // Get dev url
    if (this.config.isDev) await require('./lib/utils').determineDevUrl()

    // Apply passport (after fetching dev url)
    const { initialize, passportSession } = require('./config/passport')()
    app.use(initialize)
    app.use(passportSession)

    // Apply routes
    app.use(require('./rest/router'))

    // Create server
    const server = http.createServer(app)

    // Init socket
    const io = require('./socket')(server, session)

    // TODO: Use hooks?
    // Apply GitHub webhooks
    // const Hooks = require('./rest/hooks').get({ io })
    // app.use(Hooks.middleware)

    // Start server
    try {
      this._runningServer = await server.listen(port || this.config.port)
    } catch (error) {
      this.logger.error(error)
      return false
    }

    // Attach io instance to express making it accessible as req.app.get('io') in routes
    app.set('io', io)

    this.logger.info(chalk`Server and socket are up and listening. On port: {magenta.bold ${this.config.port}}.`)

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

    this.logger.info(chalk`
    Port {magenta.bold ${this.config.port}} closed.
    `)

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

// Export Server Class
module.exports = Server
