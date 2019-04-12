'use strict'

const Knex = require('knex')
const config = require('../config/config').get()
const logger = require('./logger')
const tables = require('./tables')

let knex

async function initializeKnex () {
  const connection = {
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName
  }

  try {
    knex = Knex({
      debug: false,
      client: 'pg',
      version: config.postgresVersion,
      connection,
      pool: {
        min: config.dbPoolMin,
        max: config.dbPoolMax
      }
    })
    try {
      await knex('pgmigrations').select('*').first()
    } catch (err) {
      logger.error(`Knex can't query migrations: `)
      logger.error(err)
    }
  } catch (err) {
    logger.error('Error starting Knex:')
    logger.error(err)
    process.exit(1)
  }

  return knex
}

function getKnex () {
  if (!knex) throw Error('Knex is not initialized. Call initializeKnex')
  return knex
}

module.exports = {
  initializeKnex,
  getKnex,
  tables
}
