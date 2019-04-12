'use strict'

const router = require('express').Router()
const chalk = require('chalk')
const passport = require('passport')
const bcrypt = require('bcrypt')
const cuid = require('cuid')

const config = require('../../config/config').get()
const logger = require('../../lib/logger')
const { isLoggedIn } = require('../custom-middlewares')
const { getKnex, tables } = require('../../lib/knex')

const knex = getKnex()

// TODO: replace this with better pattern
router.get('/logged-in', async (req, res) => {
  if (req.user) {
    let user = { ...req.user }
    delete user.password
    if (user.githubOauthId) {
      user.githubLinked = true
      delete user.githubOauthId
    }
    return res.status(200).json(user)
  }

  return res.status(400)
})

router.post('/register', async function registerNewUser (req, res) {
  // TODO: Validate body

  const passwordHash = await bcrypt.hash(req.body.password, config.saltRounds)

  let user
  try {
    user = await knex(tables.USER).insert({
      id: cuid(),
      username: req.body.username,
      givenName: req.body.givenName,
      familyName: req.body.familyName,
      email: req.body.email,
      password: passwordHash
    }).returning('*')
  } catch (err) {
    logger.error(err)
    return res.status(400).send('TODO: register error')
  }

  // TODO: Better error handling
  if (!user) {
    logger.error('User was not inserted')
    res.status(500).send('User was not registered')
    return
  }

  logger.silly(chalk`A new user with username: {green ${user.username}} just registered`)

  // TODO: Improve this / make generic (only include what needs to be included in query rather than deleting)
  if (user && user.length > 0) {
    user = user[0]
    delete user.password
    if (user.githubOauthId) {
      user.githubLinked = true
      delete user.githubOauthId
    }
    res.status(200).json(user)
  } else {
    // TODO: Better errors
    res.status(500).send('Error')
  }
})

router.post('/login', function (req, res, next) {
  // TODO: Validate that uname and password were passed and match standards
  passport.authenticate('local', function (err, user, message) {
    if (err) {
      return next(err)
    }
    if (!user) {
      // TODO: improve errors
      if (message.doesNotExist) {
        return res.status(404).send('username does not exist.')
      }
      if (message.badPassword) {
        return res.status(403).send('Incorrect password.')
      }
      return res.status(500).send('Something went wrong while attempting to fetch your account. Please contact an admin.')
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err)
      }
      logger.silly(`User ${req.user.username} has logged in.`)

      // TODO: Improve this / make generic
      let user = { ...req.user }
      delete user.password
      if (user.githubOauthId) {
        user.githubLinked = true
        delete user.githubOauthId
      }
      console.log(user)
      return res.json(user)
    })
  })(req, res, next)
})

router.get('/logout', isLoggedIn, function (req, res) {
  const username = req.user.username
  try {
    req.logout()
    logger.silly(`User ${username} has logged out.`)
    res.status(200).send(`User ${username} has logged out.`)
  } catch (err) {
    res.status(400).send(`User ${username} was unable to log out.`)
    logger.error(err)
  }
})

module.exports = router
