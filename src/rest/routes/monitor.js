const router = require('express').Router()

router.get('/beep', (req, res) => {
  res.type('text')
  return res.send('boop')
})

module.exports = router
