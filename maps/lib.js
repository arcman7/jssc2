const os = require('os') //eslint-disable-line
const path = require('path') //eslint-disable-line
/*
  The library and base Map for defining full maps.

  To define your own map just import this library and subclass Map. It will be
  automatically registered for creation by `get`.

    class NewMap(lib.Map):
      prefix = "map_dir"
      filename = "map_name"
      players = 3

  You can build a hierarchy of classes to make your definitions less verbose.

  To use a map, either import the map module and instantiate the map directly, or
  import the maps lib and use `get`. Using `get` from this lib will work, but only
  if you've imported the map module somewhere.
*/
/*eslint-disable class-methods-use-this*/

class DuplicateMapError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'DuplicateMapError'
  }
}

class NoMapError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'NoMapError'
  }
}

class Map {
  /*
  Base map object to configure a map. To define a map just subclass this.

  Attributes:
    name: The name of the map/class.
    path: Where to find the map file.
    directory: Directory for the map
    filename: Actual filename. You can skip the ".SC2Map" file ending.
    download: Where to download the map.
    game_steps_per_episode: Game steps per episode, independent of the step_mul.
        0 (default) means no limit.
    step_mul: How many game steps per agent step?
    score_index: Which score to give for this map. -1 means the win/loss
        reward. >=0 is the index into score_cumulative.
    score_multiplier: A score multiplier to allow make small scores good.
    players: Max number of players for this map.
    battle_net: The map name on battle.net, if it exists.
  */
  get directory() {
    return Map.directory
  }

  get filename() {
    return Map.filename
  }

  get download() {
    return Map.download
  }

  get game_steps_per_episode() {
    return Map.game_steps_per_episode
  }

  get step_mul() {
    return Map.step_mul
  }

  get score_index() {
    return Map.score_index
  }

  get score_multiplier() {
    return Map.score_multiplier
  }

  get players() {
    return Map.players
  }

  get battle_net() {
    return Map.battle_net
  }

  get path() {
    //The full path to the map file: directory, filename and file ending.//
    if (this.filename) {
      let map_path = path.join(this.directory, this.filename.replace(/\s/g, '').replace(/'/g, ''))
      if (map_path.slice(map_path.length - 7, map_path.length) !== '.SC2Map') {
        map_path += '.SC2Map'
      }
      return map_path
    }
    return ''
  }

  data(run_config) {
    //Return the map data.//
    try {
      return run_config.map_data(this.path, this.players)
    } catch (err) {
      if (this.download && err.message.match('filename')) {
        console.info(`Error reading map '${this.name}' from: ${this.path}`)
      }
      throw err
    }
  }

  get name() {
    return this.constructor.name
  }

  toString() {
    return [
      this.path ? ` file: ${this.path}` : null,
      this.battle_net ? ` battle_net: ${this.battle_net}` : null,
      ` players: ${this.players}, score_index: ${this.score_index}, score_multiplier: ${this.score_multiplier}\n\tstep_mul: ${this.step_mul}, game_steps_per_episode: ${this.game_steps_per_episode}`,
    ].filter((str) => str !== null).join('\n')
  }

  static all_subclasses() {
    return Map._subclasses
  }
}

Map._subclasses = []
Map.directory = ''
Map.filename = null
Map.download = null
Map.game_steps_per_episode = 0
Map.step_mul = 8
Map.score_index = -1
Map.score_multiplier = 1
Map.players = null
Map.battle_net = null

function get_maps() {
  //Get the full dict of maps {map_name: map_class}.//
  const maps = {}
  for (let i = 0; i < Map._subclasses.length; i++) {
    const mp = Map._subclasses[i]
    if (mp.filename || mp.battle_net) {
      const map_name = mp.name
      if (maps[map_name]) {
        throw new DuplicateMapError(`Duplicate map found: "${map_name}"\n  existing:\n${mp}\n  Duplicate:\n${maps[map_name]}`)
      }
      maps[map_name] = mp
    }
  }
  return maps
}

function get(map_name = '') {
  //Get an instance of a map by name. Errors if the map doesn't exist.//
  if (map_name instanceof Map) {
    return map_name
  }
  // Get the list of maps. This isn't at module scope to avoid problems of maps
  // being defined after this module is imported.
  const maps = get_maps()
  const map_class = maps[map_name]
    || maps[map_name.replace(/'/g, '')]
    || maps[map_name.replace(/\s/g, '')]
  if (map_class) {
    return new map_class() //eslint-disable-line
  }
  throw new NoMapError(`Map doesn't exist: ${map_name}`)
}

module.exports = {
  DuplicateMapError,
  'get': get,
  get_maps,
  Map,
  NoMapError,
}
