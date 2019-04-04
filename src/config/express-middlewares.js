'use strict'

const chalk = require('chalk')
const express = require('express')
const session = require('express-session')
const path = require('path')
const RedisStore = require('connect-redis')(session)
const cors = require('cors')

// Initialize Express middlewares
module.exports = (app, config, logger, redisClient) => {
  // Apply cors
  const corsOptions = {
    origin: config.allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
  app.use(cors(corsOptions))

  // Init session
  const _session = session({
    store: new RedisStore({
      client: redisClient
    }),
    resave: true,
    secret: config.sessionSecret,
    saveUninitialized: true
  })

  // Apply parsing middleware
  app.use(express.json()) // For parsing application/json
  app.use(express.urlencoded({ extended: true })) // For parsing application/x-www-form-urlencoded
  app.use(_session)

  // Load static files
  app.use(express.static(path.join(__dirname, '..', 'public')))

  // Log each url for 'debug' loggingLevel
  app.use((req, res, next) => {
    logger.debug(chalk`Route called: {cyan ${req.method}} {magenta ${req.url}}`)
    next()
  })

  return _session
}
