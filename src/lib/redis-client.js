'use strict'

const Redis = require('ioredis')

const logger = require('../lib/logger')
const config = require('../config/config').get()

let redis

if (!redis) initializeRedis()

function initializeRedis () {
  const redisConfig = {}
  if (config.redisPassword) redisConfig.password = config.redisPassword

  try {
    redis = new Redis(config.redisPort, config.redisHost, redisConfig)
  } catch (err) {
    logger.error('Error starting Redis:')
    logger.error(err)
    process.exit(1)
  }
}

module.exports = redis
