'use strict'

require('dotenv').config() // Load private env from .env

const isMain = require.main === module

const chalk = require('chalk')

const config = require('./config/config').get()
const logger = require('./lib/logger')
const { initializeKnex } = require('./lib/knex')
const redisClient = require('./lib/redis-client')

class Server {
  static get (opts) {
    return new Server(opts)
  }

  async start () {
    const http = require('http')
    const express = require('express')
    const app = express()

    // Start knex
    await initializeKnex()

    // Apply express config
    const session = require('./config/express')(app, redisClient)

    // Get dev url
    if (config.isDev) await require('./lib/utils').determineDevUrl()

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
      this._runningServer = await server.listen(config.port)
    } catch (error) {
      logger.error(error)
      return false
    }

    // Attach io instance to express making it accessible as req.app.get('io') in routes
    app.set('io', io)

    logger.info(chalk`Server and socket are up and listening. On port: {magenta.bold ${config.port}}.`)

    return true
  }

  async stop () {
    if (!this._runningServer) {
      logger.error('No server is currently running')
      return false
    }

    try {
      await this._runningServer.close()
    } catch (err) {
      logger.error(err)
      return false
    }

    logger.info(chalk`
    Port {magenta.bold ${config.port}} closed.
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
    logger.error(err)
  })
}

// Export server instance
module.exports = server
