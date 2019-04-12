'use strict'

const Octokit = require('@octokit/rest')
// const { getKnex, tables } = require('../lib/knex')
// const knex = getKnex()

// A new octokit instance should exist for each Owner/Repo
class OctokitWrapper {
  static get (opts) {
    return new OctokitWrapper(opts)
  }

  constructor (opts) {
    console.log(opts)
    this._oauthToken = opts.oauthToken
    console.log(this._oauthToken)
    this._octokit = opts.octokit
    this._user = opts.user
    this._owner = opts.owner
    this._repo = opts.repo
    this._redis = opts._redis
  }

  get user () {
    if (!this._user) throw Error('An OctokitWrapper instance must have a user')
    return this._user
  }

  get owner () {
    if (!this._owner) throw Error('An OctokitWrapper instance must have an owner')
    return this._owner
  }

  get repo () {
    if (!this._repo) throw Error('An OctokitWrapper instance must have an owner')
    return this._repo
  }

  get redis () {
    if (!this._redis) {
      this._redis = require('../lib/redis-wrapper').get({
        user: this.user
      })
    }
    return this._redis
  }

  get oauthToken () {
    if (!this._oauthToken) throw Error('Pass Github oauth token to Octokitwrapper')
    return this._oauthToken
  }

  async initialize () {
    // const app = new App({
    //   id: this.config.githubAppId,
    //   privateKey: privateKey
    // })

    // const jwt = app.getSignedJsonWebToken()

    // const octokit = Octokit({ // TODO: inject custom logger
    //   async auth () {
    //     let installId = await this.storage.getInstallKey()
    //     // If no installation is preset for the owner/repo combo, get one
    //     if (!installId) {
    //       console.log('Install Id:')
    //       console.log(installId)
    //       installId = await this.getNewInstallId(jwt)
    //       if (!installId) throw Error('Unable to get new install ID.')
    //       // Store new id in storage
    //       await this.storage.addInstallKey(installId)
    //     }

    //     console.log('install id fetched, ', installId)

    //     const installationAccessToken = await app.getInstallationAccessToken({
    //       installationId: installId
    //     })
    //     return `token ${installationAccessToken}`
    //   },
    //   previews: [
    //     'symmetra-preview' // TODO: Separate these
    //   ]
    // })

    console.log('has auth token: ')
    console.log(this.oauthToken)

    const octokit = Octokit({ // TODO: inject custom logger
      auth: `token ${this.oauthToken}`,
      previews: [
        'symmetra-preview' // TODO: Separate these
      ]
    })

    return octokit
  }

  // TODO: actually fix this
  async hasAuth () {
    if (!this._oauthToken) return false
    return true
  }

  // async getNewInstallId (jwt) {
  //   let req
  //   try {
  //     req = await request('GET /repos/:owner/:repo/installation', {
  //       owner: this.owner,
  //       repo: this.repo,
  //       headers: {
  //         authorization: `Bearer ${jwt}`,
  //         accept: 'application/vnd.github.machine-man-preview+json'
  //       }
  //     })
  //   } catch (error) {
  //     console.error(error)
  //     return
  //   }

  //   const { data } = req

  //   return data && data.id
  // }
}

module.exports = OctokitWrapper
