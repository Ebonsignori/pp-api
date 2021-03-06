'use strict'

const router = require('express').Router()

const config = require('../../config/config').get()
const logger = require('../../lib/logger')
const { isLoggedIn } = require('../custom-middlewares')
const OctokitWrapper = require('../../lib/octokit-wrapper')

// Get issues from github
router.get('/:owner/:repo', isLoggedIn, async (req, res) => {
  // TODO: Validate query params
  const owner = req.params.owner
  const repo = req.params.repo

  let octokitWrapper = OctokitWrapper.get({
    oauthToken: req.user.githubOauthAccess
  })

  const octokit = await octokitWrapper.initialize()

  // Build query to github using passed in params
  const issuesQuery = {
    owner,
    repo,
    state: 'open'
  }
  if (req.query.label) issuesQuery.labels = req.query.label
  if (req.query.sortBy) issuesQuery.sort = req.query.sortBy

  // TODO: paginate
  let issues
  try {
    const options = octokit.issues.listForRepo.endpoint.merge(issuesQuery)
    issues = await octokit.paginate(options)
  } catch (error) {
    console.error(error)
    logger.error(error)
    return res.status(404).send(`Unable to find issues from GitHub for ${req.params.owner}/${req.params.repo}`)
  }

  res.status(200).json(issues)
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
  const owner = req.params.owner
  const repo = req.params.repo
  const number = req.params.number

  let octokitWrapper = OctokitWrapper.get({
    oauthToken: req.user.githubOauthAccess
  })

  if (!await octokitWrapper.hasAuth()) {
    return res.status(403).send(`Must authenticate with github auth for ${owner}/${repo}`)
  }

  const octokit = await octokitWrapper.initialize()

  // Get existing labels from Github
  let labels
  try {
    const options = octokit.issues.listLabelsForRepo.endpoint.merge({
      owner,
      repo
    })
    labels = await octokit.paginate(options)
  } catch (error) {
    return res.status(404).send(`Unable to find labels from GitHub for ${owner}/${repo}`)
  }

  let applyingLabel = labels.find(label => label.name === req.body.decision)
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
      logger.error(`Unable to create new label. Please add manually.`)
      return res.status(500).send(`Unable to create new label. Please add manually.`)
    }
  }

  // If removing existing voting label is enabled
  if (req.body.votingLabel) {
    const removingLabel = labels.find(label => label.name === req.body.votingLabel)
    if (removingLabel) {
      try {
        await octokit.issues.removeLabel({ owner, repo, number, name: req.body.votingLabel })
      } catch (error) {
        logger.debug(`Tried to remove an existing label that wasn't present on issue`)
      }
    }
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
    logger.error(`Unable to fetch issue #${number} from GitHub for ${owner}/${repo}`)
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

module.exports = router
