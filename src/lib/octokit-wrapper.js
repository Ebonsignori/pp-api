'use strict'

const Generic = require('./generic-class')
// const App = require('@octokit/app')
const Octokit = require('@octokit/rest')
// const request = require('@octokit/request')

// const fs = require('fs')
// const path = require('path')
// const privateKey = fs.readFileSync(path.join(__dirname, '..', '..', 'pkey.pem'))

// A new octokit instance should exist for each Owner/Repo
class OctokitWrapper extends Generic {
  static get (opts) {
    return Generic.get(OctokitWrapper, opts)
  }

  constructor (opts) {
    super(opts)

    this._oauthToken = opts.oauthToken
    this._octokit = opts.octokit
    this._user = opts.user
    this._owner = opts.owner
    this._repo = opts.repo
    this._storage = opts.storage
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

  get storage () {
    if (!this._storage) {
      this._storage = require('../lib/storage').get({
        user: this.user
      })
    }
    return this._storage
  }

  async getOauthToken () {
    if (!this._oauthToken) this._oauthToken = await this.storage.getOauthToken()
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

    let oauthToken = await this.getOauthToken()
    if (!oauthToken) {
      console.error('No Auth token for user. Use OctokitWrapper.hasAuth() to verify before init.')
      return
    }

    console.log('has auth token: ')
    console.log(oauthToken)

    const octokit = Octokit({ // TODO: inject custom logger
      auth: `token ${oauthToken}`,
      previews: [
        'symmetra-preview' // TODO: Separate these
      ]
    })

    return octokit
  }

  async hasAuth () {
    if (!await this.getOauthToken()) return false
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
