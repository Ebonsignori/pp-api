const passport = require('passport')
const GitHubStrategy = require('passport-github').Strategy
const Redis = require('../lib/redis-wrapper')

module.exports = (config, logger) => {
  // Use github oauth for authentication
  passport.use(new GitHubStrategy({
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: `${config.hostname}/oauth/redirect`
  }, async (accessToken, refreshToken, profile, cb) => {
    // Save the oauth token for user in redis for octokit to use
    const redis = Redis.get({
      user: profile.username
    })
    await redis.addOauthToken(accessToken)
    logger.debug(`Added GH acces token: ${accessToken} for user: ${profile.username}.`)
    return cb(null, profile)
  }))

  passport.serializeUser(function (user, cb) {
    cb(null, user)
  })

  passport.deserializeUser(function (obj, cb) {
    cb(null, obj)
  })

  // TODO: implement custom github auth callback to return error response instead of redirect

  return { initialize: passport.initialize(), passportSession: passport.session() }
}
