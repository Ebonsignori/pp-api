'use strict'

class Generic {
  static get (Child, opts = {}) {
    return new Child(opts)
  }

  constructor (opts) {
    this._config = opts.config
    this._logger = opts.logger
  }

  get config () {
    if (!this._config) this._config = require('../config').get()
    return this._config
  }

  get logger () {
    if (!this._logger) this._logger = require('../config/logging')(this.config.loggingLevel)
    return this._logger
  }
}

module.exports = Generic
