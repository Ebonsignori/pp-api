// The following routes provide a placeholder frontend
module.exports = (config, logger, isLoggedIn) => {
  const router = require('express').Router()

  // Homepage list orgs and repos for user to chose to start planning poker in
  router.get('/', isLoggedIn, (req, res) => {
    res.status(200).send('We home bby')
    
  })

  // /login provides link to login/auth through GitHub
  const indexTemplate = require('../public/templates/index')()
  router.get('/login', (req, res) => {
    res.status(200).send(indexTemplate)
  })

  return router
}
