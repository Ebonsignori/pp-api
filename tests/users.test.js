'use strict'

/* globals describe, after, before, it */

const helper = require('./helper').get()
const assert = require('assert')

describe('/users', async () => {
  before(async () => {
    await helper.startServer()
  })
  after(async () => {
    await helper.stopServer()
  })
  describe('/users', async () => {
    it('should register a new user', async () => {
      const res = await helper.post('/users/register', helper.mockUser)
      helper.assertStatus(res, 201)
      const user = res.body
      assert.strictEqual(user.username, helper.mockUser.username, 'unexpected username')
      assert.strictEqual(user.password, undefined, 'Password included in response and should not be')
      assert.strictEqual(user.isGuest, false, 'Unexpected guest status of new user')
    })

    it('should login for new user', async () => {
      const res = await helper.post('/users/login', helper.mockUser, { cookieUser: helper.mockUser.username })
      helper.assertStatus(res, 200)
      const user = res.body
      assert.strictEqual(user.username, helper.mockUser.username, 'unexpected username')
      assert.strictEqual(user.password, undefined, 'Password included in response and should not be')
      assert.strictEqual(user.isGuest, false, 'Unexpected guest status of new user')
    })

    it('should logout for new user', async () => {
      const res = await helper.get('/users/logout', { cookieUser: helper.mockUser.username })
      helper.assertStatus(res, 200)
      const user = res.body && res.body.user
      assert.strictEqual(user.username, helper.mockUser.username, 'unexpected username')
      assert.strictEqual(user.password, undefined, 'Password included in response and should not be')
      assert.strictEqual(user.isGuest, false, 'Unexpected guest status of new user')
    })
  })
})
