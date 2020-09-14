// Print the list of defined maps.
const path = require('path')
const flags = require('flags')

const maps = require(path.resolve(__dirname, '..', 'maps'))

function main() {
  const map = maps.get_maps()
  Object.keys(map).sort().forEach((keys) => {
    const mp = new map[keys]()
    if (mp.path) {
      console.log(mp.toString())
    }
  })
}

flags.defineBool('m', false, 'treat file as module')
flags.parse()
if (flags.get('m')) {
  module.exports = {
    main,
  }
} else {
  main()
}
