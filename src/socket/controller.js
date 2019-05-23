'use strict'

const events = require('./events')
const logger = require('../lib/logger')
const SocketService = require('./service')

function mountOnConnection (io, socket) {
  const socketService = new SocketService({ io, socket })

  /* - - - START GAME FLOW - - - */
  // The order of events from JOIN_ROOM to RESET reflects the expected flow of events

  // When a user joins a room
  socket.on(events.JOIN_ROOM, async (payload) => {
    return socketService.joinRoom(payload)
  })

  // Moves the room to the voting stage
  socket.on(events.BEGIN_VOTE, async (payload) => {
    return socketService.beginVoting(payload)
  })

  // When a user votes within a room that is in the voting stage
  socket.on(events.VOTE, async (payload) => {
    return socketService.vote(payload)
  })

  // Moves room to the results stage
  socket.on(events.SHOW_RESULTS, async (payload) => {
    return socketService.showResults(payload)
  })

  // Moves room to the results stage
  socket.on(events.SHOW_RESULTS, async (payload) => {
    return socketService.showResults(payload)
  })

  // Moves room to the results stage
  socket.on(events.DECIDE_VOTE, async (payload) => {
    return socketService.decideStoryValue(payload)
  })

  /* - - - END GAME FLOW - - - */

  // - - - Other Room Events - - -

  // Resets the stage to 'choose'
  socket.on(events.RESET, async (payload) => {
    return socketService.reset(payload)
  })

  // Removes a user from a room (fired by a user with privileges to kick)
  socket.on(events.REMOVE_USER, async (payload) => {
    return socketService.removeFromRoom(payload)
  })

  // When a user disconnects from their socket, set them as inactive for each room they are in
  socket.on(events.DISCONNECT, async (payload) => {
    // TODO: Tear down session after X time? OR set cookie expire elsewhere?
    return socketService.setInactive(payload)
  })

  // System events
  socket.on(events.KEEP_ALIVE, async () => {
    logger.silly(`Being kept alive by ${socket.id}`)
  })
}

module.exports = {
  mountOnConnection
}
