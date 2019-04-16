'use strict'

const config = require('../config/config').get()

function isDevelopment (req, res, next) {
  if (config.isDev || config.isTest) return next()
  res.status(404).send('Debug endpoints are only available during development')
}

function isLoggedIn (req, res, next) {
  // If not logged in, redirect to login
  if (!req.user) {
    return res.status(403).json({
      notLoggedIn: true
    })
  }
  next()
}

// TODO: throw error if socketId is missing?
function attachSocketId (req, res, next) {
  req.session.socketId = req.query.socketId
  next()
}

module.exports = {
  isDevelopment,
  isLoggedIn,
  attachSocketId
}
