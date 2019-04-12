'use strict'

const passport = require('passport')
const bcrypt = require('bcrypt')
const GitHubStrategy = require('passport-github').Strategy
const LocalStrategy = require('passport-local').Strategy

const logger = require('../lib/logger')
const config = require('./config').get()
const { getKnex, tables } = require('../lib/knex')
const knex = getKnex()

module.exports = () => {
  passport.use(new LocalStrategy(async (username, password, cb) => {
    let user
    try {
      user = await knex(tables.USER)
        .select(
          'id',
          'isGuest',
          'username',
          'password',
          'email',
          'googleOauthId',
          'googleOauthAccess',
          'githubOauthId',
          'githubOauthAccess',
          'givenName',
          'familyName',
          'avatarUrl',
          'createdAt')
        .where('username', username)
        .where('deleted', false)
        .first()
    } catch (error) {
      logger.error('Unable to fetch user by username:')
      logger.error(error)
    }
    if (!user) {
      logger.silly(`Account name DNE: ${username}`)
      cb(null, false, { doesNotExist: true })
      return
    }

    const passwordMatches = await bcrypt.compare(password, user.password)

    if (passwordMatches) {
      // remove password hash from user object
      delete user.password
      cb(null, user)
    } else {
      logger.warn(`Incorrect password for username: ${username}`)
      cb(null, false, { badPassword: true })
    }
  }))

  // Authorize github (link to account)
  passport.use(new GitHubStrategy({
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: `${config.hostname}/oauth/redirect`,
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, cb) => {
    if (!req.user) {
      console.log('no user')
      cb(null, false, { notLoggedIn: true })
    } else {
      // Associate Github account with user
      const updateQuery = {
        githubOauthId: profile.id,
        githubOauthAccess: accessToken,
        githubOauthRefresh: refreshToken
      }
      if (!req.user.avatarUrl && profile.photos && profile.photos.length > 0) updateQuery.avatarUrl = profile.photos[0].value
      let user = await knex(tables.USER)
        .where('deleted', false)
        .where('id', req.user.id)
        .update(updateQuery)
        .returning('*')

      // TODO: better handling
      if (user && user.length > 0) {
        user = user[0]
        delete user.password
        cb(null, user)
      }
      cb(null, false)
    }
  }))

  // Authenticate github (for login)
  passport.use('github-login', new GitHubStrategy({
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: `${config.hostname}/oauth/redirect`,
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, cb) => {
    console.log('HERE AT GITHUB-LOGIN')
    if (!req.user) {
      const user = await knex(tables.USER)
        .select('*')
        .where('deleted', false)
        .where('githubOauthId', profile.id)
        .first()
      delete user.password
      cb(null, user)
    } else {
      cb(null, false, { alreadyLoggedIn: true })
    }
  }))

  passport.serializeUser((user, cb) => {
    cb(null, user.id)
  })

  passport.deserializeUser(async (id, cb) => {
    let user = await knex(tables.USER)
      .select('*')
      .where('id', id)
      .where('deleted', false)
      .first()

    if (user) {
      delete user.password
    } else {
      user = false
    }
    cb(null, user)
  })

  return { initialize: passport.initialize(), passportSession: passport.session() }
}
