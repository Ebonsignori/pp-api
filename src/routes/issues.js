
const OctokitWrapper = require('../lib/octokit-wrapper')

module.exports = (config, logger, isLoggedIn) => {
  const router = require('express').Router()

  // Get issues from github
  router.get('/:owner/:repo', isLoggedIn, async (req, res) => {
    console.log(`User: ${req.user.username}`)
    // TODO: Validate query params
    const owner = req.params.owner
    const repo = req.params.repo

    let octokitWrapper = OctokitWrapper.get({
      user: req.user.username
    })

    console.log(`access token for ${req.user.username}: ${await octokitWrapper.getOauthToken()}`)

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
    try {
      console.log(issuesQuery)
      issues = await octokit.issues.listForRepo(issuesQuery) // TODO: paginate
    } catch (error) {
      logger.error(error)
      return res.status(404).send(`Unable to find issues from GitHub for ${req.params.owner}/${req.params.repo}`)
    }

    if (issues.status !== 200) {
      return res.status(500).send(`Unable to fetch issues from GitHub for ${req.params.owner}/${req.params.repo}`)
    }

    res.status(200).json(issues.data)
  })

  // Assign a label
  router.post('/:owner/:repo/:number', isLoggedIn, async (req, res) => {
    if (!req.body.decision) {
      return res.status(400).json({
        property: 'decision',
        type: 'missing_required',
        msg: 'Missing decision property'
      })
    }

    if (typeof req.body.decision !== 'string') {
      return res.status(400).json({
        property: 'decision',
        type: 'invalid_property',
        msg: 'decision must be a string.'
      })
    }

    // TODO: Validate params
    const user = req.user.username
    const owner = req.params.owner
    const repo = req.params.repo
    const number = req.params.number

    let octokitWrapper = OctokitWrapper.get({ user, owner, repo })

    if (!await octokitWrapper.hasAuth()) {
      return res.status(403).send(`Must authenticate with github auth for ${owner}/${repo}`)
    }

    const octokit = await octokitWrapper.initialize()

    // Get existing labels from Github
    let labels
    try {
      labels = await octokit.request('GET /repos/:owner/:repo/labels', { owner, repo })
    } catch (error) {
      return res.status(404).send(`Unable to find labels from GitHub for ${owner}/${repo}`)
    }

    if (labels.status !== 200) {
      return res.status(500).send(`Unable to fetch labels from GitHub for ${owner}/${repo}`)
    }

    let applyingLabel = labels.data.find(label => label.name === req.body.decision)
    if (!applyingLabel) {
      // Create the label
      try {
        applyingLabel = await octokit.issues.createLabel({
          owner,
          repo,
          name: req.body.decision,
          color: '58b1bc',
          description: 'Created from Planning Poker.'
        })
        applyingLabel = applyingLabel.data
      } catch (error) {
        return res.status(500).send(`Unable to create new label. Please add manually.`)
      }
    }

    // If removing voting label is enabled
    if (req.body.votingLabel) {
      // const removingLabel = labels.data.find(label => label.name === req.body.votingLabel)
      await octokit.issues.removeLabel({ owner, repo, number, name: req.body.votingLabel })
      // TODO: Errors
    }

    // Get issue with existing labels
    let existingIssue
    try {
      existingIssue = await octokit.request('GET /repos/:owner/:repo/issues/:number', { owner, repo, number })
    } catch (error) {
      logger.error(error)
      return res.status(404).send(`Unable to find issue #${number} from GitHub for ${owner}/${repo}`)
    }

    if (existingIssue.status !== 200) {
      return res.status(500).send(`Unable to fetch issue #${number} from GitHub for ${owner}/${repo}`)
    }

    // Add new swag to existing labels
    let patchedIssue
    try {
      patchedIssue = await octokit.request('PATCH /repos/:owner/:repo/issues/:number', {
        owner,
        repo,
        number,
        labels: [...existingIssue.data.labels, applyingLabel]
      })
    } catch (error) {
      logger.error(error)
      return res.status(500).send(`Unable to add swag label to issue #${number} from GitHub for ${owner}/${repo}`)
    }

    return res.status(200).json(patchedIssue)
  })

  return router
}
