'use strict'

const chalk = require('chalk')
const config = require('../config/config').get()

const LEVELS = {
  SILLY: 'silly',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  IGNORE: 'ignore' // Don't print anything
}

let logger

if (!logger) initLogger(config.loggingLevel)
logger.initLogger = initLogger

function initLogger (loggingLevel) {
  const { createLogger, format, transports } = require('winston')

  if (!Object.values(LEVELS).includes(loggingLevel)) {
    console.error(`Logging level: "${loggingLevel}" is not supported. Defaulting to "${LEVELS.IGNORE}" level`)
    loggingLevel = LEVELS.IGNORE
  }

  if (loggingLevel === LEVELS.IGNORE) {
    const noop = () => { }
    return {
      'silly': noop,
      'debug': noop,
      'info': noop,
      'warn': noop,
      'error': noop
    }
  }

  logger = createLogger({
    level: loggingLevel,
    format: format.combine(
      format.colorize(),
      format.timestamp({
        format: 'HH:mm:ss'
      }),
      format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [new transports.Console()]
  })

  // // Print selected logging level at selected logging level
  // switch (loggingLevel) {
  //   case LEVELS.silly:
  //     logger.silly('Logging level set to: silly')
  //     break
  //   case LEVELS.debug:
  //     logger.debug('Logging level set to: debug')
  //     break
  //   case LEVELS.INFO:
  //     logger.info('Logging level set to: info')
  //     break
  //   case LEVELS.WARN:
  //     logger.warn('Logging level set to: warn')
  //     break
  //   case LEVELS.ERROR:
  //     logger.error('Logging level set to: error')
  //     break
  // }

  // Custom logger functions
  logger.missingEnvVar = (envVarName) => {
    logger.error(
      chalk`{red.bold You must define the ${envVarName} environment variable in the .env file.}`
    )
  }
}

module.exports = logger
