'use strict'

const router = require('express').Router()
const passport = require('passport')

// const config = require('../../config/config').get()
// const logger = require('../../lib/logger')
const { isLoggedIn, attachSocketId } = require('../custom-middlewares')

// Called from client with socketId param. Triggers github oauth
router.get('/github', attachSocketId, passport.authenticate('github'))
router.get('/github-login', attachSocketId, passport.authenticate('github-login'))

// Called from Github redirect on oauth confirm/deny by user
router.get('/redirect', passport.authenticate('github'), (req, res) => {
  const io = req.app.get('io')
  if (req.session.socketId) {
    const user = { ...req.user }
    delete user.password
    if (user.githubOauthId) { // TODO: Improve this / make generic
      user.githubLinked = true
      delete user.githubOauthId
    }
    io.in(req.session.socketId).emit('authenticate-github', req.user) // socketId should be attached from GET /oauth/github
  }
  res.end()
})

router.get('/logout', isLoggedIn, (req, res) => {
  const user = req.user
  req.logout()
  res.status(200).json({
    msg: `Logged out of ${user.username}`,
    user: user
  })
})

// router.get('/authenticate', async (req, res) => {
//   res.status(200).redirect(`https://github.com/login/oauth/authorize?client_id=${config.githubClientId}&redirect_uri=http://${config.hostname}/oauth/redirect`)
// })

// From https://github.com/sohamkamani/node-oauth-example/blob/master/index.js
//   router.get('/redirect', async (req, res) => {
//     const requestToken = req.query.code
//     if (!requestToken) {
//       return res.status(400).send('Must have a requestToken query.')
//     }

//     let postResp
//     try {
//       postResp = await axios({
//       // make a POST request
//         method: 'post',
//         // to the Github authentication API, with the client ID, client secret and request token
//         url: `https://github.com/login/oauth/access_token?client_id=${config.githubClientId}&client_secret=${config.githubClientSecret}&code=${requestToken}`,
//         // Set the content type header, so that we get the response in JSOn
//         headers: {
//           accept: 'application/json'
//         }
//       })
//     } catch (error) {
//       console.error(error)
//       return res.status(400).send('Could not get token from github')
//     }

//     if (postResp.status !== 200) {
//       return res.status(400).send('Could not get token from github')
//     }

//     // Once we get the response, extract the access token from the response body
//     const accessToken = postResp && postResp.data && postResp.data.access_token
//     console.log(accessToken)
//     let getResp
//     try {
//       const octokit = new Octokit({
//         auth: `token ${accessToken}`
//       })
//       getResp = await octokit.request('GET /user')
//     } catch (error) {
//       console.error(error)
//       return res.status(400).send('Oauth token received from github did not work.')
//     }

//     if (getResp.status !== 200) {
//       return res.status(400).send('Oauth token received from github did not work.')
//     }

//     try {
//       const storage = require('../storage').get({
//         owner: getResp.data.login,
//         repo: '*' // Oauth is for all repos TODO: Is it though?
//       })
//       await storage.addOauthToken(accessToken)
//     } catch (err) {
//       console.error(err)
//       return res.status(500).send('Unable to save oauth token.')
//     }

//     return res.status(200).send(`Hello ${getResp.data.login}, You have successfully been authenticated with the app!`)
//   })

module.exports = router
