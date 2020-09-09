const path = require('path') //eslint-disable-line
const lib = require(path.resolve(__dirname, './lib.js'))

class Melee extends lib.Map {
  get directory() { return this.constructor.directory }

  get download() { return this.constructor.download }

  get players() { return this.constructor.players }

  get game_steps_per_episode() { return this.constructor.game_steps_per_episode }
}
Melee.directory = 'Melee'
Melee.download = 'https://github.com/Blizzard/s2client-proto#map-packs'
Melee.players = 2
Melee.game_steps_per_episode = 16 * 60 * 30 // 30 minute limit.
Melee._subclasses = []
lib.Map._subclasses.push(Melee)

const melee_maps = [
  // 'Empty128',  # Not really playable, but may be useful in the future.
  'Flat32',
  'Flat48',
  'Flat64',
  'Flat96',
  'Flat128',
  'Simple64',
  'Simple96',
  'Simple128',
]

const modExports = {
  Melee,
  melee_maps,
}

melee_maps.forEach((name) => {
  modExports[name] = class extends Melee {
    static get filename() { return name }

    get filename() { return name } //eslint-disable-line

    static get name() { return name }
  }
  lib.Map._subclasses.push(modExports[name])
  Melee._subclasses.push(modExports[name])
})

module.exports = modExports
