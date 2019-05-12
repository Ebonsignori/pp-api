const events = require('./events')
const SocketService = require('./service')

function mountOnConnection (io, socket) {
  const socketService = new SocketService({ io, socket })

  socket.on(events.RESET, async (payload) => {
    return socketService.reset(payload)
  })

  socket.on(events.SHOW_RESULTS, async (payload) => {
    return socketService.showResults(payload)
  })

  socket.on(events.VOTE, async (payload) => {
    return socketService.vote(payload)
  })

  socket.on(events.BEGIN_VOTE, async (payload) => {
    return socketService.beginVote(payload)
  })

  socket.on(events.JOIN_ROOM, async (payload) => {
    return socketService.joinRoom(payload)
  })

  socket.on(events.REMOVE_FROM_ROOM, async (payload) => {
    return socketService.removeFromRoom(payload)
  })

  socket.on('disconnect', async (payload) => {
    return socketService.leaveRoom()
  })
}

module.exports = {
  mountOnConnection
}
