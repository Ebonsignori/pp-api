'use strict'

const chalk = require('chalk')
const axios = require('axios')

async function determineDevUrl (config, logger) {
  let ngrokUp = false
  let firstError = true
  while (!ngrokUp) {
    let resp
    try {
      resp = await axios.get(`http://localhost:${config.ngrokHelperPort}/api/tunnels`)
      const tunnels = resp.data && resp.data.tunnels
      const httpTunnel = tunnels[0].public_url
      // const httpsTunnel = tunnels[1].public_url
      config.setHostname(httpTunnel)
      if (!firstError) {
        logger.info('Ngrok connection found!')
      }
      logger.info(chalk`Ngrok Url: {blue.bold ${config.hostname}}.`)
      ngrokUp = true
      return
    } catch (err) {
      if (firstError) {
        logger.error(chalk`{red.bold Ngrok is not running.} Please start with script: {blue.bold npm run dev.up}`)
        firstError = false
        logger.debug('Waiting for ngrok connection...')
      }
      await sleep(1000) // Check every 1 seconds for ngrok connection
    }
  }
}

async function sleep (ms) {
  return new Promise(resolve => setTimeout(() => { resolve() }, ms))
}

module.exports = {
  determineDevUrl
}
