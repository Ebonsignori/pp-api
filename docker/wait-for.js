const args = process.argv.slice(2)

setTimeout(() => {
  process.exit(0)
}, args[0])
