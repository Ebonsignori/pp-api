const events = require('./events')
const Redis = require('../lib/redis-wrapper')
const { getKnex, tables } = require('../lib/knex')
const knex = getKnex()

// TODO: Temporary
const roomUsers = {}

class SocketService {
  constructor (opts) {
    this._io = opts.io
    this._socket = opts.socket
  }

  get io () {
    if (!this._io) throw Error('Include error in instantiation')
    return this._io
  }

  get socket () {
    if (!this._io) throw Error('Include error in instantiation')
    return this._socket
  }

  async reset (payload) {
    const user = await getLoggedIn(this.socket)
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

    await roomRedis.setGameState(SocketService.initialGameState)
    this.io.to(currentRoom).emit(events.GAME_STATE, { gameState: SocketService.initialGameState })
  }

  async showResults (payload) {
    const user = await getLoggedIn(this.socket)
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
    gameState.stage = SocketService.STAGES.RESULTS
    await roomRedis.setGameState(gameState)
    this.io.to(currentRoom).emit(events.GAME_STATE, { gameState })
  }

  async vote (payload) {
    let user
    if (payload.guestUsername) {
      user = {
        username: payload.guestUsername
      }
    } else {
      user = await getLoggedIn(this.socket)
    }
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

    // Let user know what they voted for
    this.io.to(this.socket.id).emit(events.VOTE, {
      userVote: value
    })
    // Let room know user voted (but not the value of the vote)
    this.io.to(currentRoom).emit(events.GAME_STATE, {
      gameState: {
        ...gameState,
        userVotes: obscureVotes(gameState.userVotes)
      }
    })
  }

  async beginVote (payload) {
    const user = await getLoggedIn(this.socket)
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

    const gameState = { ...SocketService.initialGameState }
    gameState.stage = SocketService.STAGES.VOTE
    gameState.story = issue
    await roomRedis.setGameState(gameState)

    this.io.to(currentRoom).emit(events.GAME_STATE, { gameState })
  }

  async joinRoom (payload) {
    let user = await getLoggedIn(this.socket)
    if (!payload.roomId) {
      throw Error('TODO: No room id in payload')
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

    // TEMP: store users in redis
    // Get redis instance for room
    const roomRedis = new Redis({ room: room.id })
    let users = await roomRedis.getUsers()
    if (!users || users.length === 0 || !users.find(u => u.username === user.username)) {
      await roomRedis.addUser(user)
      users = [...users, user]
    }

    // TODO: Make promise?
    // Get privileges and set as active
    // let privileges = room.privileges
    // if (!room.userId) {
    //   // Add user to room
    //   const userRoomPrivileges = await knex(tables.MAP_USER_AND_ROOM)
    //     .insert({
    //       isActive: true,
    //       userId: user.id,
    //       roomId: room.id,
    //       privileges: user.isGuest ? 'guest' : 'user' // creator should already be in room
    //     })
    //     .returning('*')
    //     // TODO: handle possible error
    //   if (userRoomPrivileges && userRoomPrivileges.length > 0) {
    //     privileges = userRoomPrivileges[0].privileges
    //   }
    // } else {
    //   // Update user as active in room
    //   const userRoomPrivileges = await knex(tables.MAP_USER_AND_ROOM)
    //     .where('userId', room.userId)
    //     .update({ isActive: true })
    //     .returning('*')
    //     // TODO: handle possible error
    //   if (userRoomPrivileges && userRoomPrivileges.length > 0) {
    //     privileges = userRoomPrivileges[0].privileges
    //   }
    // }

    // // TODO: Get users in room
    // promises[1] = await knex({ r: tables.ROOM })
    //   .leftJoin(`${tables.MAP_USER_AND_ROOM} as muar`, 'muar.roomId', 'r.id')
    //   .leftJoin(`${tables.USER} as u`, 'u.id', 'muar.userId')
    //   .select(
    //     'u.username',
    //     'u.givenName',
    //     'u.avatarUrl',
    //     'u.isGuest'
    //   )
    //   .where('u.id', user.id)
    //   .where('r.id', room.id)

    promises[2] = await knex({ r: tables.ROOM })
      .leftJoin(`${tables.MAP_ROOM_AND_STORY} as mras`, 'mras.roomId', 'r.id')
      .leftJoin(`${tables.STORY} as s`, 's.id', 'mras.storyId')
      .select(
        's.*'
      )
      .where('r.id', room.id)
      .where('s.deleted', false)

    const [ todo, realUsers, stories ] = await Promise.all(promises)

    // Add to activeRooms if not already active
    const activeRooms = await roomRedis.getActiveRooms()
    if (!activeRooms || !activeRooms.includes(room.id)) {
      await roomRedis.addActiveRoom(room.id)
    }

    // Get or init game state
    let gameState = await roomRedis.getGameState()
    if (!gameState) {
      gameState = { ...SocketService.initialGameState }
      await roomRedis.setGameState(gameState)
    }
    // If in voting phase, obscure votes
    let userVote
    if (gameState.stage === SocketService.STAGES.VOTE) {
      userVote = gameState.userVotes[user.username]
      gameState.userVotes = obscureVotes(gameState.userVotes)
    }

    // Let others in room know user joined
    this.socket.join(room.id)
    this.io.to(room.id).emit(events.USERS, { users: roomUsers[room.id] })

    // Send the subscriber the current game state and stories
    this.io.to(this.socket.id).emit(events.JOINED, {
      gameState,
      stories
    })
    // Send the subscriber their vote if they have voted
    if (userVote) {
      this.io.to(this.socket.id).emit(events.VOTE, {
        userVote
      })
    }
    // socket.emit(events.USERS, { users })
    // socket.emit(events.STORIES, { stories })
  }

  async removeFromRoom (payload) {
    const roomId = payload.roomId
    const username = payload.username

    // If user is guest, delete it
    await knex(tables.USER)
      .del()
      .where('username', username)
      .where('isGuest', true)
      .returning('*')

    roomUsers[roomId] = roomUsers[roomId].filter(u => u.username !== username)
    this.io.to(roomId).emit(events.USERS, { users: roomUsers[roomId] })
  }

  async leaveRoom () {
    let userId = await getLoggedIn(this.socket, true)
    await knex(tables.MAP_USER_AND_ROOM)
      .where('userId', userId)
      .update({
        isActive: false
      })
  }
}

async function getLoggedIn (socket, onlyGetId) {
  if (socket && socket.handshake && socket.handshake.session && socket.handshake.session.passport && socket.handshake.session.passport.user) {
    const userId = socket.handshake.session.passport.user
    if (onlyGetId) return userId
    let user = await knex(tables.USER)
      .select('*')
      .where('id', userId)
      .first()
    if (user) {
      delete user.password
      return user
    }
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

SocketService.STAGES = {
  CHOSE: 'choose',
  VOTE: 'vote',
  RESULTS: 'results'
}

SocketService.initialGameState = {
  stage: SocketService.STAGES.CHOSE,
  story: undefined,
  userVotes: {} // no one has voted yet
}

module.exports = SocketService
