'use strict'

const router = require('express').Router()
const { isDevelopment } = require('./custom-middlewares')

router.use('/issues', require('./routes/issues'))
router.use('/debug', isDevelopment, require('./routes/debug'))
router.use('/users', require('./routes/users'))
router.use('/oauth', require('./routes/oauth'))
router.use('/list', require('./routes/list'))
router.use('/rooms', require('./routes/rooms'))

module.exports = router
