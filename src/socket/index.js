'use strict'

// const config = require('../config/config').get()
const logger = require('../lib/logger')
const events = require('./events')
const OctokitWrapper = require('../lib/octokit-wrapper')
const Redis = require('../lib/redis-wrapper')
const cuid = require('cuid')
const { getKnex, tables } = require('../lib/knex')
const knex = getKnex()

// TODO: move
const STAGES = {
  CHOSE: 'choose',
  VOTE: 'vote',
  RESULTS: 'results'
}
const initialGameState = {
  stage: STAGES.CHOSE,
  story: undefined,
  userVotes: {} // no one has voted yet
}

function mountSocket (server, session) {
  if (!server) throw new Error('initializeSocket must be called with a server instance.')
  if (!session) throw new Error('initializeSocket must be called with a session instance.')

  const io = require('socket.io').listen(server)

  const sharedSession = require('express-socket.io-session')

  // Use a shared session between express and socket-io
  io.use(sharedSession(session, {
    autoSave: true
  }))

  // io.use(isLoggedIn)

  io.on('connection', (socket) => {
    // // If client is logged in, let them know via initial socket connection
    // if (socket && socket.handshake && socket.handshake.session && socket.handshake.session.passport && socket.handshake.session.passport.user) {
    //   if (socket.id) {
    //     const userId = socket.handshake.session.passport.user
    //     let user = await knex(tables.USER)
    //       .select('*')
    //       .where('id', userId)
    //       .first()
    //     delete user.password
    //     const payload = {
    //       username: socket.user.username,
    //       avatar: Array.isArray(socket.user.photos) && socket.user.photos[0] && socket.user.photos[0].value
    //     }
    //     io.in(socket.id).emit(events.USER_LOGGED_IN, payload)
    //   }
    // }

    // TODO: Fetch voting labels from GH or create as needed (e.g. swag:2, swag:5, etc)

    socket.on(events.RESET, async (payload) => {
      const user = await getLoggedIn(socket)
      if (!user) return

      const roomId = payload.roomId

      if (!roomId) {
        throw Error('TODO: No issue or roomId in BEGIN_VOTE')
      }

      const roomRedis = new Redis({
        room: roomId
      })

      const activeRooms = await roomRedis.getActiveRooms()
      const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomId)
      if (!currentRoom) { // Must have joined room first
        console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
        return
      }

      await roomRedis.setGameState(initialGameState)
      io.to(currentRoom).emit(events.GAME_STATE, { gameState: initialGameState })
    })

    socket.on(events.SHOW_RESULTS, async (payload) => {
      const user = await getLoggedIn(socket)
      if (!user) return

      const roomId = payload.roomId

      if (!roomId) {
        throw Error('TODO: No roomId in SHOW_RESULTS')
      }

      const roomRedis = new Redis({
        room: roomId
      })

      const activeRooms = await roomRedis.getActiveRooms()
      const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomId)
      if (!currentRoom) { // Must have joined room first
        console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
        return
      }

      const gameState = await roomRedis.getGameState()
      gameState.stage = STAGES.RESULTS
      await roomRedis.setGameState(gameState)
      io.to(currentRoom).emit(events.GAME_STATE, { gameState })
    })

    socket.on(events.VOTE, async (payload) => {
      const user = await getLoggedIn(socket)
      if (!user) return

      const roomId = payload.roomId
      const value = payload.value

      if (!roomId || !value || !user) {
        throw Error('TODO: No issue or value in VOTE')
      }

      const roomRedis = new Redis({
        room: roomId
      })

      const activeRooms = await roomRedis.getActiveRooms()
      const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomId)
      if (!currentRoom) { // Must have joined room first
        console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
        return
      }

      // Update gameState with user's vote
      let gameState = await roomRedis.getGameState()

      gameState = {
        ...gameState,
        userVotes: {
          ...gameState.userVotes,
          [user.username]: value
        }
      }
      await roomRedis.setGameState(gameState)

      io.to(currentRoom).emit(events.GAME_STATE, {
        gameState: {
          ...gameState,
          userVotes: obscureVotes(gameState.userVotes)
        }
      })
    })

    socket.on(events.BEGIN_VOTE, async (payload) => {
      const user = await getLoggedIn(socket)
      if (!user) return

      const roomId = payload.roomId
      const issue = payload.issue

      if (!issue || !roomId) {
        throw Error('TODO: No issue or roomId in BEGIN_VOTE')
      }

      const roomRedis = new Redis({
        room: roomId
      })

      const activeRooms = await roomRedis.getActiveRooms()
      const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomId)
      if (!currentRoom) { // Must have joined room first
        console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
        return
      }

      const gameState = { ...initialGameState }
      gameState.stage = STAGES.VOTE
      gameState.story = issue
      await roomRedis.setGameState(gameState)

      io.to(currentRoom).emit(events.GAME_STATE, { gameState })
    })

    // // When a client joins a new room
    // // -- Payload
    // // roomId
    // // guestUsername (when not logged in)
    socket.on(events.JOIN_ROOM, async (payload) => {
      let user = await getLoggedIn(socket)
      // Create guest user if not logged in
      if (!user) {
        if (!payload.guestUsername) {
          throw Error('TODO: No guest username')
        }
        user = await knex(tables.USER).insert({
          id: cuid(),
          isGuest: true,
          username: payload.guestUsername
        })
      }
      if (!payload.roomId) {
        throw Error('TODO: No payload id')
      }

      const room = await knex({ r: tables.ROOM })
        .leftJoin(`${tables.MAP_USER_AND_ROOM} as muar`, 'muar.roomId', 'r.id')
        .select(
          'r.*',
          'muar.privileges',
          'muar.userId')
        .where('r.id', payload.roomId)
        .first()

      // Get room contents and send to user
      const promises = [null, null, null]

      // TODO: Make promise
      // Get privileges and set as active
      let privileges = room.privileges
      if (!room.userId) {
        // Add user to room
        const userRoomPrivileges = await knex(tables.MAP_USER_AND_ROOM)
          .insert({
            id: cuid(),
            isActive: true,
            userId: user.id,
            roomId: room.id,
            privileges: user.isGuest ? 'guest' : 'user' // creator should already be in room
          })
          .returning('*')
          // TODO: handle possible error
        if (userRoomPrivileges && userRoomPrivileges.length > 0) {
          privileges = userRoomPrivileges[0].privileges
        }
      } else {
        // Update user as active in room
        const userRoomPrivileges = await knex(tables.MAP_USER_AND_ROOM)
          .where('userId', user.id)
          .update({ isActive: true })
          .returning('*')
          // TODO: handle possible error
        if (userRoomPrivileges && userRoomPrivileges.length > 0) {
          privileges = userRoomPrivileges[0].privileges
        }
      }

      // TODO: Get users in room
      promises[1] = await knex({ r: tables.ROOM })
        .leftJoin(`${tables.MAP_USER_AND_ROOM} as muar`, 'muar.roomId', 'r.id')
        .leftJoin(`${tables.USER} as u`, 'u.id', 'muar.userId')
        .select(
          'u.username',
          'u.givenName',
          'u.avatarUrl',
          'u.isGuest'
        )
        .where('u.id', user.id)
        .where('r.id', room.id)

      promises[2] = await knex({ r: tables.ROOM })
        .leftJoin(`${tables.MAP_ROOM_AND_STORY} as mras`, 'mras.roomId', 'r.id')
        .leftJoin(`${tables.STORY} as s`, 's.id', 'mras.storyId')
        .select(
          's.*'
        )
        .where('r.id', room.id)

      const [ todo, users, stories ] = await Promise.all(promises)

      // Get redis instance for room
      const roomRedis = new Redis({ room: room.id })

      // Add to activeRooms if not already active
      const activeRooms = await roomRedis.getActiveRooms()
      if (!activeRooms || !activeRooms.includes(room.id)) {
        await roomRedis.addActiveRoom(room.id)
      }

      // Get or init game state
      let gameState = await roomRedis.getGameState()
      if (!gameState) {
        gameState = { ...initialGameState }
        await roomRedis.setGameState(gameState)
      }
      // If in voting phase, obscure votes
      if (gameState.stage === STAGES.VOTE) gameState.userVotes = obscureVotes(gameState.userVotes)

      // Let others in room know user joined
      socket.join(room.id)
      io.to(room.id).emit(events.USER, { user })

      // Send the subscriber the current game state, users and stories
      io.to(socket.id).emit(events.JOINED, {
        gameState,
        users,
        stories
      })
      // socket.emit(events.USERS, { users })
      // socket.emit(events.STORIES, { stories })
    })
  })

  // TODO: Tear down session after X time? OR set cookie expire elsewhere?
  io.on('disconnect', async (socket) => {
    // TODO: Also have a user leave a room when they logout (bc that will be through rest endpoint and this logic will not be reached)
    let userId = await getLoggedIn(socket, true)
    await knex(tables.MAP_USER_AND_ROOM)
      .where('userId', userId)
      .update({
        isActive: false
      })
  })

  return io
}

async function getLoggedIn (socket, onlyGetId) {
  if (socket && socket.handshake && socket.handshake.session && socket.handshake.session.passport && socket.handshake.session.passport.user) {
    const userId = socket.handshake.session.passport.user
    if (onlyGetId) return userId
    let user = await knex(tables.USER)
      .select('*')
      .where('id', userId)
      .first()
    delete user.password
    return user
  }
  socket.emit(events.USER_NOT_LOGGED_IN)
  return false
}

function obscureVotes (userVotes) {
  const obscuredVotes = {}
  for (const vote of Object.entries(userVotes)) {
    obscuredVotes[vote[0]] = vote[1] && 'voted'
  }
  return obscuredVotes
}

async function getIssues (socket, user, owner, repo, label, sortBy) {
  let octokitWrapper = OctokitWrapper.get({
    oauthToken: user.githubOauthAccess
  })

  if (!await octokitWrapper.hasAuth()) {
    socket.emit('join_room_error', 'TODO:')
    // return res.status(403).send(`Must authenticate with github auth for ${owner}/${repo}`)
  }

  const octokit = await octokitWrapper.initialize()

  // Build query to github using passed in params
  const issuesQuery = {
    owner,
    repo,
    state: 'open'
  }
  if (label) issuesQuery.labels = label
  if (sortBy) issuesQuery.sort = sortBy

  // TODO: paginate
  try {
    const options = octokit.issues.listForRepo.endpoint.merge(issuesQuery)
    return await octokit.paginate(options)
  } catch (error) {
    console.error(error)
    socket.emit('join_room_error', 'TODO:')
    // return res.status(404).send(`Unable to find issues from GitHub for ${req.params.owner}/${req.params.repo}`)
  }
}

module.exports = mountSocket
