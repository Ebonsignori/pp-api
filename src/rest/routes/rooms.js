'use strict'

const router = require('express').Router()
const cuid = require('cuid')

// const config = require('../../config/config').get()
// const logger = require('../../lib/logger')
const { isLoggedIn } = require('../custom-middlewares')
const { getKnex, tables } = require('../../lib/knex')
const knex = getKnex()

// Join room
// router.get('/:id', (req, res) => {
//   const roomId = req.query.id

//   let room = await knex(tables.ROOM)
//     .select('')
//     .where('id', roomId)
//     .first()

//     const io = req.app.get('io')
//     if (req.session.socketId) {
//       const user = { ...req.user }
//       delete user.password
//       if (user.githubOauthId) { // TODO: Improve this / make generic
//         user.githubLinked = true
//         delete user.githubOauthId
//       }
//       io.in(req.session.socketId).emit('authenticate-github', req.user) // socketId should be attached from GET /oauth/github
//     }
//     res.end()
// })

// Get the rooms that a user has created
router.get('/created', isLoggedIn, async (req, res) => {
  const rooms = await knex({ muar: tables.MAP_USER_AND_ROOM })
    .leftJoin(`${tables.ROOM} as r`, 'r.id', 'muar.roomId')
    .select('r.*')
    .where('privileges', 'creator')
    .where('muar.userId', req.user.id)

  if (!rooms) return res.status(404)
  res.status(200).json(rooms)
})

// Create room
// -- req.body
// name
// voteValueType
// allowGuests
// allowedUsers
// revealVotes
// useTimer
// allowRevote
// whoCanStart
// whoCanVote
// whoCanEnd
// whoCanRevote
// whoCanDecide
// stories (array of stories)
// -- each story item
// title
// body
// sourceUrl
// isFromGithub
// githubIssueOwner
// githubIssueRepo
// githubIssueNumber
router.post('', isLoggedIn, async (req, res) => {
  const user = req.user
  // TODO: Validate body
  let room = await knex(tables.ROOM)
    .insert({
      id: cuid(),
      name: req.body.name,
      voteValueType: req.body.voteValueType,
      revealVotes: req.body.revealVotes,
      useTimer: req.body.useTimer,
      allowRevote: req.body.allowRevote,
      allowGuests: req.body.allowGuests,
      allowedUsers: req.body.allowedUsers,
      whoCanStart: req.body.whoCanStart,
      whoCanVote: req.body.whoCanVote,
      whoCanEnd: req.body.whoCanEnd,
      whoCanRevote: req.body.whoCanRevote,
      whoCanDecide: req.body.whoCanDecide
    })
    .returning('*')

  // TODO: handle error
  if (room && room.length > 0) {
    room = room[0]
  }

  // Add creator to room
  const userRoomMap = await knex(tables.MAP_USER_AND_ROOM).insert({
    userId: user.id,
    roomId: room.id,
    privileges: 'creator'
  })

  if (!req.body.stories) throw Error('TODO: no stories provided in create room to vote on')

  // Add user stories
  let stories = []
  let mappings = []
  for (const story of req.body.stories) {
    const storyId = cuid()
    stories.push({
      id: storyId,
      title: story.title,
      body: story.body,
      sourceUrl: story.sourceUrl,
      isFromGithub: story.isFromGithub,
      githubIssueLabel: story.githubIssueLabel,
      githubIssueId: story.githubIssueId,
      githubIssueOwner: story.githubIssueOwner,
      githubIssueRepo: story.githubIssueRepo,
      githubIssueNumber: story.githubIssueNumber
    })
    mappings.push({
      storyId,
      roomId: room.id
    })
  }
  stories = await knex(tables.STORY).insert(stories).returning('*')
  mappings = await knex(tables.MAP_ROOM_AND_STORY).insert(mappings).returning('*')

  // TODO: validate inserts

  room = {
    ...room,
    privileges: userRoomMap,
    stories
  }
  res.status(201).json(room)
})

module.exports = router
