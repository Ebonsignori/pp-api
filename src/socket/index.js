'use strict'

const Generic = require('../lib/generic-class')
const events = require('./events')
const OctokitWrapper = require('../lib/octokit-wrapper')
const Storage = require('../lib/storage')

// TODO: move
const STAGES = {
  CHOSE: 'choose',
  VOTE: 'vote',
  RESULTS: 'results'
}
const initialGameState = {
  stage: STAGES.CHOSE,
  issue: undefined,
  userVotes: {} // no one has voted yet
}

// Socket follows a different pattern than routes. Must be instantiated with a server and session
let staticIo
class Socket extends Generic {
  static get (opts) {
    return Generic.get(Socket, opts)
  }

  static initializeSocket (server, session, logger, config) {
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
      // If client is logged in, let them know via initial socket connection
      if (socket && socket.handshake && socket.handshake.session && socket.handshake.session.passport && socket.handshake.session.passport.user) {
        if (socket.id) {
          socket.user = socket.handshake.session.passport.user
          const payload = {
            username: socket.user.username,
            avatar: Array.isArray(socket.user.photos) && socket.user.photos[0] && socket.user.photos[0].value
          }
          io.in(socket.id).emit(events.USER_LOGGED_IN, payload)
        }
      }

      // TODO: Fetch voting labels from GH or create as needed (e.g. swag:2, swag:5, etc)

      socket.on(events.RESET, async (payload) => {
        const user = getLoggedIn(socket)
        if (!user) return

        const owner = payload.owner
        const repo = payload.repo

        if (!owner || !repo) {
          socket.emit('join_room_error', 'TODO:')
        }

        // Find active room instance
        const roomSlug = `${owner}/${repo}`

        const roomStorage = new Storage({
          room: roomSlug
        })

        const activeRooms = await roomStorage.getActiveRooms()
        const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomSlug)
        if (!currentRoom) { // Must have joined room first
          console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
          return
        }

        await roomStorage.setGameState(initialGameState)
        io.to(currentRoom).emit(events.GAME_STATE, { gameState: initialGameState })
      })

      socket.on(events.SHOW_RESULTS, async (payload) => {
        const user = getLoggedIn(socket)
        if (!user) return

        const owner = payload.owner
        const repo = payload.repo

        if (!owner || !repo) {
          socket.emit('join_room_error', 'TODO:')
        }

        // Find active room instance
        const roomSlug = `${owner}/${repo}`

        const roomStorage = new Storage({
          room: roomSlug
        })

        const activeRooms = await roomStorage.getActiveRooms()
        const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomSlug)
        if (!currentRoom) { // Must have joined room first
          console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
          return
        }

        const gameState = await roomStorage.getGameState()
        gameState.stage = STAGES.RESULTS
        await roomStorage.setGameState(gameState)
        io.to(currentRoom).emit(events.GAME_STATE, { gameState })
      })

      socket.on(events.VOTE_LABEL, async (payload) => {
        const user = getLoggedIn(socket)
        if (!user) return

        const owner = payload.owner
        const repo = payload.repo
        const label = payload.label

        if (!owner || !repo || !label) {
          socket.emit('join_room_error', 'TODO:')
        }

        // Find active room instance
        const roomSlug = `${owner}/${repo}`

        const roomStorage = new Storage({
          room: roomSlug
        })

        const activeRooms = await roomStorage.getActiveRooms()
        const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomSlug)
        if (!currentRoom) { // Must have joined room first
          console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
          return
        }

        // Update the label and update issues by new label
        await roomStorage.setVotingLabel(label)
        io.to(currentRoom).emit(events.VOTE_LABEL, { label })
        const issues = await getIssues(socket, user, owner, repo, label)
        await roomStorage.setIssues(issues)
        io.to(currentRoom).emit(events.ISSUES, { issues })
      })

      socket.on(events.VOTE, async (payload) => {
        const user = getLoggedIn(socket)
        if (!user) return

        const owner = payload.owner
        const repo = payload.repo
        const value = payload.value

        if (!owner || !repo || !value) {
          socket.emit('join_room_error', 'TODO:')
        }

        // Find active room instance
        const roomSlug = `${owner}/${repo}`

        const roomStorage = new Storage({
          room: roomSlug
        })

        const activeRooms = await roomStorage.getActiveRooms()
        const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomSlug)
        if (!currentRoom) { // Must have joined room first
          console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
          return
        }

        // Update gameState with user's vote
        let gameState = await roomStorage.getGameState()
        gameState = {
          ...gameState,
          userVotes: {
            ...gameState.userVotes,
            [user.username]: value
          }
        }
        await roomStorage.setGameState(gameState)

        io.to(currentRoom).emit(events.GAME_STATE, {
          gameState: {
            ...gameState,
            userVotes: obscureVotes(gameState.userVotes)
          }
        })
      })

      socket.on(events.BEGIN_VOTE, async (payload) => {
        const user = getLoggedIn(socket)
        if (!user) return

        const owner = payload.owner
        const repo = payload.repo
        const issue = payload.issue

        if (!owner || !repo || !issue) {
          socket.emit('join_room_error', 'TODO:')
        }

        // Find active room instance
        const roomSlug = `${owner}/${repo}`

        const roomStorage = new Storage({
          room: roomSlug
        })

        const activeRooms = await roomStorage.getActiveRooms()
        const currentRoom = activeRooms && activeRooms.find(activeRoom => activeRoom === roomSlug)
        if (!currentRoom) { // Must have joined room first
          console.error(`User needs to join room before voting. This shouldn't be reached from client, if it is fix bug.`)
          return
        }

        const gameState = { ...initialGameState }
        gameState.stage = STAGES.VOTE
        gameState.issue = issue
        await roomStorage.setGameState(gameState)

        io.to(currentRoom).emit(events.GAME_STATE, { gameState })
      })

      // When a client joins a new room
      socket.on(events.JOIN_ROOM, async (payload) => {
        const user = getLoggedIn(socket)
        if (!user) return

        const owner = payload.owner
        const repo = payload.repo

        if (!owner || !repo) {
          socket.emit('join_room_error', 'TODO:')
        }

        // Determine room
        const roomSlug = `${owner}/${repo}`

        const roomStorage = new Storage({
          room: roomSlug
        })

        // Add to activeRooms if not already active
        const activeRooms = await roomStorage.getActiveRooms()
        if (!activeRooms || !activeRooms.includes(roomSlug)) {
          await roomStorage.addActiveRoom(roomSlug)
        }

        // Add user to active users
        let users = await roomStorage.getUsers()
        if (!users || (users && !users.find(existingUser => existingUser.username === user.username))) { // Failsafe (bug catch) user should not be part of active room and joining
          await roomStorage.addUser(user)
        }
        users = await roomStorage.getUsers()

        // Get current room label
        const label = await roomStorage.getVotingLabel()

        // TODO: Combine this with room init for inactive rooms?
        // Get issues if not already fetched
        let issues = await roomStorage.getIssues()
        if (!issues) {
          issues = await getIssues(socket, user, owner, repo, label)
          await roomStorage.setIssues(issues)
        }

        // Get or init game state
        let gameState = await roomStorage.getGameState()
        if (!gameState) {
          gameState = { ...initialGameState }
          await roomStorage.setGameState(gameState)
        }
        // If in voting phase, obscure votes
        if (gameState.stage === STAGES.VOTE) gameState.userVotes = obscureVotes(gameState.userVotes)

        // TODO: Combine all these initial emits into once emit of the current room state
        // TODO: leave previous room
        socket.join(roomSlug)
        // let room know new user has joined
        io.to(roomSlug).emit(events.JOINED, {
          roomSlug: roomSlug,
          username: socket.user.username
        })
        io.to(roomSlug).emit(events.GAME_STATE, { gameState })
        io.to(roomSlug).emit(events.USERS, { users })
        // Send issues to joiner
        socket.emit(events.ISSUES, { issues })
        // Send label to joiner
        socket.emit(events.VOTE_LABEL, { label })
      })
    })

    // TODO: Tear down session after X time? OR set cookie expire elsewhere?
    io.on('disconnect', () => {
      logger.debug('Socket disconnected.')
    })

    staticIo = io
    return io
  }

  constructor (opts) {
    super(opts)

    this._io = opts.io
  }

  get io () {
    if (!staticIo) throw Error('Must initialize socket before using it with static initializeSocket method.')
    if (!this._io) this._io = staticIo
    return this._io
  }
}

function getLoggedIn (socket) {
  if (socket && socket.handshake && socket.handshake.session && socket.handshake.session.passport && socket.handshake.session.passport.user) {
    return socket.handshake.session.passport.user
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
    user: user.username
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

module.exports = Socket
