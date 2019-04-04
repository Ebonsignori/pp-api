'use strict'

const Generic = require('../lib/generic-class')
class Routes extends Generic {
  static get (opts) {
    return Generic.get(Routes, opts)
  }

  constructor (opts) {
    super(opts)

    this._router = opts.router
    this._mounted = opts.mounted

    this.isDevelopment = this.isDevelopment.bind(this)
    this.attachSocketId = this.attachSocketId.bind(this)
  }

  get router () {
    if (!this._router) this._router = require('express').Router()
    return this._router
  }

  // Init router and mount routes
  get middleware () {
    if (!this._router) this._router = require('express').Router()
    if (!this._mounted) this.mountRoutes()
    return this._router
  }

  mountRoutes () {
    // this.router.use('/room', require('./room')(this.config, this.logger, this.isLoggedIn, this.isLoggedInSocket))
    this.router.use('/issues', require('./issues')(this.config, this.logger, this.isLoggedIn))
    this.router.use('/debug', this.isDevelopment, require('./debug')(this.config, this.logger))
    this.router.use('/oauth', require('./oauth')(this.config, this.logger, this.attachSocketId, this.isLoggedIn))
    this.router.use('/list', require('./list')(this.config, this.logger, this.isLoggedIn))
  }

  // Custom middlewares
  isDevelopment (req, res, next) {
    if (this.config.isDev) return next()
    res.status(404).send('Debug endpoints are only available during development')
  }

  isLoggedIn (req, res, next) {
    // If not logged in, redirect to login
    if (!req.user) {
      return res.status(403).json({
        notLoggedIn: true
      })
    }
    next()
  }

  // TODO: throw error if socketId is missing?
  attachSocketId (req, res, next) {
    req.session.socketId = req.query.socketId
    next()
  }
}

module.exports = Routes
