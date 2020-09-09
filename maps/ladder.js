const path = require('path') //eslint-disable-line
const lib = require(path.resolve(__dirname, './lib.js'))

class Ladder extends lib.Map {
  static get players() { return 2 }

  get players() { return 2 } //eslint-disable-line

  static get game_steps_per_episode() {
    return 16 * 60 * 30 // 30 minute limit.
  }

  get game_steps_per_episode() { //eslint-disable-line
    return 16 * 60 * 30 // 30 minute limit.
  }

  static get download() {
    return 'https://github.com/Blizzard/s2client-proto#map-packs'
  }

  get download() { //eslint-disable-line
    return 'https://github.com/Blizzard/s2client-proto#map-packs'
  }
}

Ladder._subclasses = []
lib.Map._subclasses.push(Ladder)

const ladder_seasons = [
  'Ladder2017Season1',
  'Ladder2017Season2',
  'Ladder2017Season3',
  'Ladder2017Season4',
  'Ladder2018Season1',
  'Ladder2018Season2',
  'Ladder2018Season3',
  'Ladder2018Season4',
  'Ladder2019Season1',
  'Ladder2019Season2',
  'Ladder2019Season3',
]
const modExports = {
  ladder_seasons,
  Ladder,
}

ladder_seasons.forEach((name) => {
  modExports[name] = class extends Ladder {
    static get directory() { return name }

    get directory() { return name } //eslint-disable-line

    static get name() { return name }
  }
  lib.Map._subclasses.push(modExports[name])
  Ladder._subclasses.push(modExports[name])
})

const ladder_maps = [
  [modExports.Ladder2018Season2, '16-Bit LE', 2],
  [modExports.Ladder2018Season1, 'Abiogenesis LE', 2],
  [modExports.Ladder2017Season4, 'Abyssal Reef LE', 2],
  [modExports.Ladder2018Season3, 'Acid Plant LE', 2],
  [modExports.Ladder2017Season3, 'Acolyte LE', 2],
  [modExports.Ladder2019Season3, 'Acropolis LE', 2],
  [modExports.Ladder2017Season4, 'Ascension to Aiur LE', 2],
  [modExports.Ladder2019Season1, 'Automaton LE', 2],
  [modExports.Ladder2018Season1, 'Backwater LE', 2],
  [modExports.Ladder2017Season4, 'Battle on the Boardwalk LE', 2],
  [modExports.Ladder2017Season1, 'Bel\'Shir Vestige LE', 2],
  [modExports.Ladder2017Season2, 'Blood Boil LE', 2],
  [modExports.Ladder2018Season4, 'Blueshift LE', 2],
  [modExports.Ladder2017Season1, 'Cactus Valley LE', 4],
  [modExports.Ladder2018Season2, 'Catalyst LE', 2],
  [modExports.Ladder2018Season4, 'Cerulean Fall LE', 2],
  [modExports.Ladder2019Season2, 'Cyber Forest LE', 2],
  [modExports.Ladder2018Season2, 'Darkness Sanctuary LE', 4],
  [modExports.Ladder2017Season2, 'Defender\'s Landing LE', 2],
  [modExports.Ladder2019Season3, 'Disco Bloodbath LE', 2],
  [modExports.Ladder2018Season3, 'Dreamcatcher LE', 2],
  [modExports.Ladder2018Season1, 'Eastwatch LE', 2],
  [modExports.Ladder2019Season3, 'Ephemeron LE', 2],
  [modExports.Ladder2018Season3, 'Fracture LE', 2],
  [modExports.Ladder2017Season3, 'Frost LE', 2],
  [modExports.Ladder2017Season1, 'Honorgrounds LE', 4],
  [modExports.Ladder2017Season3, 'Interloper LE', 2],
  [modExports.Ladder2019Season2, 'Kairos Junction LE', 2],
  [modExports.Ladder2019Season2, 'King\'s Cove LE', 2],
  [modExports.Ladder2018Season3, 'Lost and Found LE', 2],
  [modExports.Ladder2017Season3, 'Mech Depot LE', 2],
  [modExports.Ladder2018Season1, 'Neon Violet Square LE', 2],
  [modExports.Ladder2019Season2, 'New Repugnancy LE', 2],
  [modExports.Ladder2017Season1, 'Newkirk Precinct TE', 2],
  [modExports.Ladder2017Season4, 'Odyssey LE', 2],
  [modExports.Ladder2017Season1, 'Paladino Terminal LE', 2],
  [modExports.Ladder2018Season4, 'Para Site LE', 2],
  [modExports.Ladder2019Season1, 'Port Aleksander LE', 2],
  [modExports.Ladder2017Season2, 'Proxima Station LE', 2],
  [modExports.Ladder2018Season2, 'Redshift LE', 2],
  [modExports.Ladder2017Season2, 'Sequencer LE', 2],
  [modExports.Ladder2018Season4, 'Stasis LE', 2],
  [modExports.Ladder2019Season3, 'Thunderbird LE', 2],
  [modExports.Ladder2019Season3, 'Triton LE', 2],
  [modExports.Ladder2019Season2, 'Turbo Cruise \'84 LE', 2],
  [modExports.Ladder2019Season3, 'Winter\'s Gate LE', 2],
  [modExports.Ladder2019Season3, 'World of Sleepers LE', 2],
  [modExports.Ladder2019Season1, 'Year Zero LE', 2],

  /*
   Disabled due to being renamed to Neo Seoul
   [Ladder2018Season1, 'Blackpink LE', 2],
  */
]

modExports.ladder_maps = ladder_maps

/*
 Create the classes dynamically, putting them into the module scope. They all
 inherit from a parent and set the players based on the map filename.
*/

ladder_maps.forEach(([parent, bnet, players]) => {
  const name = bnet.replace(/[ '-]|[LTRS]E$/, '')
  const map_file = bnet.replace(/'[ ']/, '')
  // console.log('map_file: ', map_file)
  modExports[name] = class extends parent {
    static get filename() { return map_file }

    get filename() { return map_file } //eslint-disable-line

    static get players() { return players }

    get players() { return players } //eslint-disable-line

    static get battle_net() { return bnet }

    get battle_net() { return bnet } //eslint-disable-line

    static get name() { return name }
  }
  lib.Map._subclasses.push(modExports[name])
  Ladder._subclasses.push(modExports[name])
})

module.exports = modExports
