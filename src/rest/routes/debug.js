'use strict'

const chalk = require('chalk')
const router = require('express').Router()
const redisScan = require('redisscan')

// const config = require('../../config/config').get()
const logger = require('../../lib/logger')
const redis = require('../../lib/redis-client')

// For scanning the contents of redis and printing them to the console
router.get('/redis-scan', function (req, res) {
  logger.debug(chalk`-=-=-=-=-=--=-=-=- {green.bold Begin Redis Scan}
Each scanned item is in form: 
{magenta ${'type'}} {cyan ${'key'}} {blue ${'subkey'}} {yellow ${'length'}} {green ${'value'}}
`)
  redisScan({
    redis: redis.client,
    pattern: '*',
    keys_only: false,
    each_callback: function (type, key, subkey, length, value, cb) {
      console.log(chalk`{magenta ${type}} {cyan ${key}} {blue ${subkey}} {yellow ${length}} {green ${value}}`)
      cb()
    },
    done_callback: function (err) {
      if (err) return res.status(500).send('Something went wrong')
      console.log() // Newline
      logger.debug(chalk` -=-=-=-=-=--=-=-=- {green.bold End Redis Scan}`)
      res.status(200).send('Scan complete')
    }
  })
})

module.exports = router
