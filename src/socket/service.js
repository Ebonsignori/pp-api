'use strict'

const events = require('./events')
const Redis = require('../lib/redis-wrapper')
const { getKnex, tables } = require('../lib/knex')
const knex = getKnex()

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

  /*
  - - - Join Room - - -
  */
  async joinRoom (payload) {
    let user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId

    if (!roomId) {
      throw Error('TODO: No room id in payload')
    }

    const room = await knex({ r: tables.ROOM })
      .leftJoin(`map_user_and_room`, function () {
        this.on('map_user_and_room.roomId', 'r.id')
        this.on('map_user_and_room.userId', '=', knex.raw('?', user.id))
      })
      .select(
        'r.*',
        'map_user_and_room.privileges',
        'map_user_and_room.userId')
      .where('r.id', roomId)
      .first()

    // Get or init game state of room
    const roomRedis = new Redis({ room: room.id })
    let gameState = await roomRedis.getGameState()
    if (!gameState) {
      gameState = { ...SocketService.initialGameState }
      await roomRedis.setGameState(gameState)
    }

    const promises = [null, null, null] // privileges, users in room, and stories in room

    // Get user privileges & set user as active in room
    if (!room.userId) {
      // Add user to room
      promises[0] = await knex(tables.MAP_USER_AND_ROOM)
        .insert({
          isActive: true,
          userId: user.id,
          roomId: room.id,
          // Creator will already be mapped to room so this user is either guest or user
          privileges: user.isGuest ? 'guest' : 'user'
        })
        .returning('*')
    } else {
      // Set user as active in room
      promises[0] = await knex(tables.MAP_USER_AND_ROOM)
        .update({
          isActive: true
        })
        .where('roomId', room.id)
        .where('userId', room.userId)
        .returning('*')
    }

    // Get all active users in room
    promises[1] = await knex({ r: tables.ROOM })
      .leftJoin(`${tables.MAP_USER_AND_ROOM} as muar`, 'muar.roomId', 'r.id')
      .leftJoin(`${tables.USER} as u`, 'u.id', 'muar.userId')
      .select(
        'u.username',
        'u.givenName',
        'u.avatarUrl',
        'u.isGuest'
      )
      .where('r.id', room.id)
      .where('muar.isActive', true)

    // Get all stories in room if in choice stage
    if (gameState.stage === SocketService.STAGES.CHOSE) {
      promises[2] = await knex({ r: tables.ROOM })
        .leftJoin(`${tables.MAP_ROOM_AND_STORY} as mras`, 'mras.roomId', 'r.id')
        .leftJoin(`${tables.STORY} as s`, 's.id', 'mras.storyId')
        .select(
          's.*'
        )
        .where('r.id', room.id)
    }

    const [ userPrivileges, users, stories ] = await Promise.all(promises)

    let privileges
    if (userPrivileges && userPrivileges.length > 0) {
      privileges = userPrivileges[0].privileges
    } else {
      privileges = userPrivileges.privileges
    }

    // If in voting phase, obscure votes
    let userVote
    if (gameState.stage === SocketService.STAGES.VOTE) {
      userVote = gameState.userVotes[user.username]
      // Send the subscriber their vote if they have already voted
      if (userVote) this.io.to(this.socket.id).emit(events.VOTE, { userVote })
      gameState.userVotes = obscureVotes(gameState.userVotes)
    }

    // Send the subscriber the current game state and data for stage
    this.io.to(this.socket.id).emit(events.JOINED, {
      gameState,
      privileges,
      users,
      stories
    })

    // Join room with socket
    this.socket.join(room.id)
    // Let others in room know user joined
    this.io.to(room.id).emit(events.USER, { user: user })
  }

  /*
  - - - Begin Voting - - -
  */
  async beginVoting (payload) {
    const user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId
    const story = payload.story

    if (!story || !roomId) {
      throw Error('TODO: No issue or roomId in BEGIN_VOTE')
    }

    // Update game stage
    const gameState = await updateGameStage(roomId, SocketService.STAGES.VOTE, story)

    this.io.to(roomId).emit(events.GAME_STATE, { gameState })
  }

  /*
  - - - Vote - - -
  */
  async vote (payload) {
    let user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId
    const value = payload.value

    if (!roomId || !value || !user) {
      throw Error('TODO: No issue or value in VOTE')
    }

    const roomRedis = new Redis({ room: roomId })

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

    // Let room know user voted (but not the value of the vote)
    this.io.to(roomId).emit(events.GAME_STATE, {
      gameState: {
        ...gameState,
        userVotes: obscureVotes(gameState.userVotes)
      }
    })
    // Let user know what they voted for
    this.io.to(this.socket.id).emit(events.VOTE, {
      userVote: value
    })
  }

  /*
  - - - Show Results
  */
  async showResults (payload) {
    const user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId

    if (!roomId) {
      throw Error('TODO: No roomId in SHOW_RESULTS')
    }

    // Update game stage
    const gameState = await updateGameStage(roomId, SocketService.STAGES.RESULTS)

    this.io.to(roomId).emit(events.GAME_STATE, { gameState })
  }

  /*
  - - - Decide Story Value
  */
  async decideStoryValue (payload) {
    const user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId
    const storyId = payload.storyId
    const decision = payload.decision // value of vote that was decided on for issue

    if (!roomId || !decision) {
      throw Error('TODO: No roomId or decision in decideStoryValue')
    }

    // Get vote value type of room
    const room = await knex(tables.ROOM)
      .select('voteValueType')
      .where('id', roomId)
      .first()

    let story = await knex(tables.STORY)
      .update({
        voteValueType: room.voteValueType,
        voteValue: decision
      })
      .where('id', storyId)
      .returning('*')

    if (story && story.length > 0) {
      story = story[0]
    }

    // Update game stage
    const gameState = await updateGameStage(roomId, SocketService.STAGES.CHOSE, null)

    // Send updated story to users
    this.io.to(roomId).emit(events.STORY, { story })
    this.io.to(roomId).emit(events.GAME_STATE, { gameState })
  }

  /*
  - - - Reset
  */
  async reset (payload) {
    const user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId

    if (!roomId) {
      throw Error('TODO: No roomId in reset')
    }

    const roomRedis = new Redis({ room: roomId })
    await roomRedis.setGameState(SocketService.initialGameState)
    this.io.to(roomId).emit(events.GAME_STATE, { gameState: SocketService.initialGameState })
  }

  /*
   - - - Remove from Room - - -
  */
  async removeFromRoom (payload) {
    const user = await this.getLoggedIn()
    if (!user) return

    const roomId = payload.roomId
    const username = payload.username

    // User can remove themselves
    if (user.username === username) {
      await setUserAsInactiveInRoom(user.id, roomId)
      return this.io.to(roomId).emit(events.REMOVE_USER, {
        username,
        kicked: false
      })
    }

    // Or another user with privileges can remove another user
    const userInRoom = await knex(tables.MAP_USER_AND_ROOM)
      .select('*')
      .where('userId', user.id)
      .where('roomId', roomId)
      .first()

    if (userInRoom.privileges === 'admin' || userInRoom.privileges === 'creator') {
      // Get user in room
      const userToRemove = await knex(tables.USER)
        .select(
          'id',
          'username'
        )
        .where('username', username)
        .first()

      // TODO: handle error not in room
      if (!userToRemove) return

      await setUserAsInactiveInRoom(userToRemove.id, roomId)
      this.io.to(roomId).emit(events.REMOVE_USER, {
        username: userToRemove.username,
        kicked: true
      })
    }
  }

  /*
   - - - Set Inactive - - -
  */
  async setInactive () {
    let user = await this.getLoggedIn()
    const userRooms = await knex(tables.MAP_USER_AND_ROOM)
      .update({
        isActive: false
      })
      .where('userId', user.id)
      .where('isActive', true)
      .returning('*')

    // Let rooms know user disconnected
    for (const userRoom of userRooms) {
      return this.io.to(userRoom.roomId).emit(events.REMOVE_USER, {
        username: user.username,
        kicked: false
      })
    }
  }

  // - - -  Helpers (Not service methods)
  async getLoggedIn (onlyGetId) {
    if (this.socket.handshake &&
        this.socket.handshake.session &&
        this.socket.handshake.session.passport &&
        this.socket.handshake.session.passport.user) {
      const userId = this.socket.handshake.session.passport.user
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
    this.socket.emit(events.USER_NOT_LOGGED_IN)
    return false
  }
}

async function updateGameStage (roomId, newStage, story) {
  const roomRedis = new Redis({ room: roomId })
  const gameState = await roomRedis.getGameState()
  gameState.stage = newStage
  if (typeof story !== 'undefined') gameState.story = story
  await roomRedis.setGameState(gameState)
  return gameState
}

function obscureVotes (userVotes) {
  const obscuredVotes = {}
  for (const vote of Object.entries(userVotes)) {
    obscuredVotes[vote[0]] = vote[1] && 'voted'
  }
  return obscuredVotes
}

async function setUserAsInactiveInRoom (userId, roomId) {
  return knex(`${tables.MAP_USER_AND_ROOM} as muar`)
    .update({
      isActive: false
    })
    .where('muar.userId', userId)
    .where('muar.roomId', roomId)
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
