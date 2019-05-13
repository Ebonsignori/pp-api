'use strict'

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

  return io
}

module.exports = mountSocket
