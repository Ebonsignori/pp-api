
const OctokitWrapper = require('../lib/octokit-wrapper')

module.exports = (config, logger, isLoggedIn) => {
  const router = require('express').Router()

  // List orgs for user
  router.get('/orgs', isLoggedIn, async (req, res) => {
    let octokitWrapper = OctokitWrapper.get({
      user: req.user.username
    })

    if (!await octokitWrapper.hasAuth()) {
      return res.status(403).send(`Must authenticate with github auth for ${req.user.username}}`)
    }

    const octokit = await octokitWrapper.initialize()

    // TODO: Paginate
    let orgs
    try {
      // TODO: also fetch private orgs
      orgs = await octokit.paginate('GET /user/orgs')
    } catch (err) {
      if (err && err.status === 404) {
        res.status(403).json({
          loggedIn: false,
          msg: 'Github app not installed.'
        })
      } else {
        logger.error(err)
        res.status(500).send('Unable to fetch orgs from GitHub.')
      }
    }
    return res.status(200).json({ orgs })
  })

  // List repos for user
  router.get('/repos', isLoggedIn, async (req, res) => {
    let octokitWrapper = OctokitWrapper.get({
      user: req.user.username
    })

    if (!await octokitWrapper.hasAuth()) {
      return res.status(403).send(`Must authenticate with github auth for ${req.user.username}}`)
    }

    const octokit = await octokitWrapper.initialize()

    let repos
    try {
      const options = octokit.repos.list.endpoint.merge()
      repos = await octokit.paginate(options)
    } catch (err) {
      if (err.status === 403) {
        console.log('403!')
      }
      logger.error(err)
      res.status(500).send('Unable to fetch orgs from GitHub.')
    }

    return res.status(200).json({ repos })
  })

  // TODO: Unused
  // Get issues from github
  router.get('issues/:owner/:repo', isLoggedIn, async (req, res) => {
    // TODO: Validate query params
    const owner = req.params.owner
    const repo = req.params.repo

    let octokitWrapper = OctokitWrapper.get({
      user: req.user.username
    })

    if (!await octokitWrapper.hasAuth()) {
      return res.status(403).send(`Must authenticate with github auth for ${owner}/${repo}`)
    }

    const octokit = await octokitWrapper.initialize()

    // const storage = require('../storage').get({
    //   owner: req.params.owner,
    //   repo: req.params.repo
    // })

    // const votingIssues = await storage.getVoteArray()

    // Build query to github using passed in params
    const issuesQuery = {
      owner,
      repo,
      state: 'open'
    }
    if (req.query.label) issuesQuery.labels = req.query.label
    else issuesQuery.labels = config.votingLabelName
    if (req.query.sortBy) issuesQuery.sort = req.query.sortBy

    let issues
    // TODO: paginate
    try {
      const options = octokit.issues.listForRepo.endpoint.merge(issuesQuery)
      issues = await octokit.paginate(options)
    } catch (error) {
      logger.error(error)
      return res.status(404).send(`Unable to find issues from GitHub for ${req.params.owner}/${req.params.repo}`)
    }

    if (issues.status !== 200) {
      return res.status(500).send(`Unable to fetch issues from GitHub for ${req.params.owner}/${req.params.repo}`)
    }

    res.status(200).json({ issues })
  })

  return router
}
