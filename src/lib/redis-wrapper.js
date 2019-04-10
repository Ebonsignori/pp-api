const Generic = require('./generic-class')
let store = require('./redis-client').get().client

// TODO: move and DRY with socket/index.js
const STAGES = {
  CHOSE: 'choose',
  VOTE: 'vote',
  RESULTS: 'results'
}
const initialGameState = {
  stage: STAGES.CHOSE,
  issue: undefined,
  userVotes: {}
}
const initialRoom = {
  issues: [],
  users: [],
  votingLabel: 'swag:ready', // default to swag:ready if none specified
  gameState: initialGameState
}

const initialSession = {
  activeRooms: []
}

// Should be instantiated and used with a user and/or room name
class ReddisWrapper extends Generic {
  static get (opts) {
    return Generic.get(ReddisWrapper, opts)
  }

  constructor (opts = {}) {
    super(opts)

    this._user = opts.user && opts.user.toLowerCase()
    this._room = opts.room && opts.room.toLowerCase()
    this._store = opts.store
  }

  get store () {
    if (!this._store) this._store = store
    return this._store
  }

  get user () {
    if (!this._user) throw Error('A Storage instance using user storage must have a user name.')
    return this._user
  }

  get room () {
    if (!this._room) throw Error('A Storage instance using room storage must have a room name.')
    return this._room
  }

  get logger () {
    if (!this._logger) this._logger = require('../config/logging')(this.config.loggingLevel)
    return this._logger
  }

  // - - - Object under username storage - - -
  // initializeUserStorage () {
  //   this.store.set(this.user, { // everything for this object instance will be under "user" object
  //     oauthToken: null
  //   })
  // }

  async getUserStorage () {
    const user = await this.store.get(this.user)
    return user && JSON.parse(user)
  }

  async saveUserStorage (obj) {
    if (!obj) console.error('Object not passed to saveUserStorageObj.')
    return this.store.set(this.user, JSON.stringify(obj))
  }

  async resetUserStorage () {
    return this.store.set(this.user, undefined)
  }

  // - - - Object under room name storage - - -
  // initializeRoomStorage () {
  //   this.store.set(this.room, { // everything for this object instance will be under "room" object
  //     voteReadyIssues: [] // voteReadyIssues is an array of issues with voting labels applied
  //   })
  // }

  async getRoomStorage () {
    const room = await this.store.get(this.room)
    return room && JSON.parse(room)
  }

  async saveRoomStorage (obj) {
    return this.store.set(this.room, JSON.stringify(obj))
  }

  // - - - Application Session Objects - - -
  // Active rooms
  async getSessionStorage () {
    const session = await this.store.get('backend_session')
    return session && JSON.parse(session)
  }

  async saveSessionStorage (obj) {
    return this.store.set('backend_session', JSON.stringify(obj))
  }

  // - - - Data Manipulation Methods - - -
  // Github oauth token manipulation
  async getOauthToken () {
    const user = await this.getUserStorage()
    return user && user.oauthToken
  }
  async addOauthToken (oauthToken) {
    const user = await this.getUserStorage()
    return this.saveUserStorage({ ...user, oauthToken: oauthToken })
  }

  // Issues in room manipulation
  async getIssues () {
    const room = await this.getRoomStorage()
    return room && room.issues
  }

  async setIssues (issues) {
    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    this.saveRoomStorage({
      ...room,
      issues
    })
  }

  async addIssue (issue) {
    if (!issue) return false

    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    if (!room.issues) {
      room = {
        ...initialRoom,
        issues: []
      }
    }

    const newIssues = [...room.issues, issue]
    const newRoom = { ...room, issues: newIssues }
    await this.saveRoomStorage(newRoom)

    return newRoom
  }

  async removeIssue (issue) {
    if (!issue) return false

    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    if (!room.issues) {
      room = {
        ...initialRoom,
        issues: []
      }
    }

    const newIssues = [...room.issues].filter(existingIssue => existingIssue.id !== issue.id)
    const newRoom = { ...room, issues: newIssues }
    await this.saveRoomStorage(newRoom)

    return newRoom
  }

  // Users in room manipulation
  async getUsers () {
    const room = await this.getRoomStorage()
    return room && room.users
  }

  async setUsers (users) {
    const room = await this.getRoomStorage()
    this.saveRoomStorage({
      ...room, users
    })
  }

  async addUser (user) {
    if (!user) return false

    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    if (!room.users) {
      room = {
        ...initialRoom,
        users: []
      }
    }

    const newUsers = [...room.users, user]
    const newRoom = { ...room, users: newUsers }
    await this.saveRoomStorage(newRoom)

    return newRoom
  }

  async removeUser (user) {
    if (!user) return false

    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    if (!room.users) {
      room = {
        ...initialRoom,
        users: []
      }
    }

    const newUsers = [...room.users].filter(existingUser => existingUser.username !== user.username)
    const newRoom = { ...room, users: newUsers }
    await this.saveRoomStorage(newRoom)

    return newRoom
  }

  // Game state manipulation
  async getGameState () {
    const room = await this.getRoomStorage()
    return room && room.gameState
  }

  async setVotingLabel (votingLabel) {
    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    return this.saveRoomStorage({
      ...room,
      votingLabel
    })
  }

  // Voting label name of issue
  async getVotingLabel () {
    const room = await this.getRoomStorage()
    return room && room.votingLabel
  }

  async setGameState (gameState) {
    let room = await this.getRoomStorage()
    if (!room) room = initialRoom
    return this.saveRoomStorage({
      ...room,
      gameState
    })
  }

  // TODO: map list of users for each room to reestablish connection on log in
  // Active room manipulation
  async getActiveRooms () {
    const session = await this.getSessionStorage()
    const activeRooms = session && session.activeRooms
    return Array.isArray(activeRooms) && activeRooms.length > 0 && activeRooms
  }

  async addActiveRoom (slug) {
    if (!slug) return false
    let session = await this.getSessionStorage()
    if (!session) session = initialSession
    if (!session.activeRooms) {
      session = {
        ...initialSession,
        activeRooms: []
      }
    }

    const newActiveRooms = [...session.activeRooms, slug]
    const newSession = { ...session, activeRooms: newActiveRooms }
    await this.saveSessionStorage(newSession)
    return newSession
  }

  async removeActiveRoom (slug) {
    if (!slug) return false
    let session = await this.getSessionStorage()
    if (!session) session = initialSession
    if (!session.activeRooms) {
      session = {
        ...initialSession,
        activeRooms: []
      }
    }

    const newActiveRooms = [...session.activeRooms].filter(existingSlug => existingSlug !== slug)
    const newSession = { ...session, activeRooms: newActiveRooms }
    await this.saveSessionStorage(newSession)
    return newSession
  }
}

module.exports = ReddisWrapper
