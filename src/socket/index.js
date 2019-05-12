'use strict'

// const config = require('../config/config').get()
// const logger = require('../lib/logger')
const events = require('./events')
const errors = require('./errors')
const OctokitWrapper = require('../lib/octokit-wrapper')
const Redis = require('../lib/redis-wrapper')
const cuid = require('cuid')
const { getKnex, tables } = require('../lib/knex')
const knex = getKnex()
const controller = require('./controller')

function mountSocket (server, session) {
  if (!server) throw new Error('initializeSocket must be called with a server instance.')
  if (!session) throw new Error('initializeSocket must be called with a session instance.')

  const io = require('socket.io').listen(server)

  const sharedSession = require('express-socket.io-session')

  // Use a shared session between express and socket-io
  io.use(sharedSession(session, {
    autoSave: true
  }))

  io.on('connection', (socket) => {
    controller.mountOnConnection(io, socket)
  })

  // TODO: Tear down session after X time? OR set cookie expire elsewhere?
  io.on('disconnect', async (socket) => {
    // TODO: Also have a user leave a room when they logout (bc that will be through rest endpoint and this logic will not be reached)
    let userId = await getLoggedIn(socket, true)
    // await knex(tables.MAP_USER_AND_ROOM)
    //   .where('userId', userId)
    //   .update({
    //     isActive: false
    //   })
    console.log('user disconnected', userId)
  })

  return io
}

module.exports = mountSocket
