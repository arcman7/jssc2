const path = require('path') //eslint-disable-line
const ladder = require(path.resolve(__dirname, './ladder.js'))
const lib = require(path.resolve(__dirname, './lib.js'))
const melee = require(path.resolve(__dirname, './melee.js'))
const mini_games = require(path.resolve(__dirname, './mini_games.js'))

/*
  Register/import the maps, and offer a way to create one by name.

  Users of maps should import this module:
    from pysc2 import maps
  and create the maps by name:
    maps.get("MapName")

  If you want to create your own map, then import the map lib and subclass Map.
  Your subclass will be implicitly registered as a map that can be constructed by
  name, as long as it is imported somewhere.
*/

module.exports = {
  // Use `get` to create a map by name.
  'get': lib.get,
  get_maps: lib.get_maps,
  ladder,
  lib,
  melee,
  mini_games,
}
