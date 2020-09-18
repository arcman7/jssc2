// Generate the unit definitions for units.js.
const path = require('path')
const s2clientprotocol = require('s2clientprotocol')
const flags = require('flags')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const static_data = require(path.resolve(__dirname, '..', 'lib', 'static_data.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb
const { DefaultDict } = pythonUtils

async function get_data() {
  // Get the game's static data from an actual game.
  const run_config = run_configs.get()
  const port = (await portspicker.pick_unused_ports(1))[0]
  const sc_process = await run_config.start({ want_rgb: false, port })
  const controller = sc_process._controller
  const m = maps.get('SequencerLE')
  const create = new sc_pb.RequestCreateGame()
  const localmap = new sc_pb.LocalMap()
  localmap.setMapPath(m.path)
  localmap.setMapData(m.data(run_config))
  create.setLocalMap(localmap)
  const playersetup1 = new sc_pb.PlayerSetup()
  playersetup1.setType(sc_pb.PlayerType.PARTICIPANT)
  create.addPlayerSetup(playersetup1)
  const playersetup2 = new sc_pb.PlayerSetup()
  playersetup2.setType(sc_pb.PlayerType.COMPUTER)
  playersetup2.setRace(sc_common.Race.RANDOM)
  playersetup2.setDifficulty(sc_pb.Difficulty.VERYEASY)
  create.addPlayerSetup(playersetup2)
  const join = new sc_pb.RequestJoinGame()
  join.setRace(sc_common.Race.RANDOM)
  const interfaceoptions = new sc_pb.InterfaceOptions()
  interfaceoptions.setRaw(true)
  join.setOptions(interfaceoptions)

  await controller.create_game(create)
  await controller.join_game(join)
  const data = await controller.data_raw()
  await controller.quit()
  await controller.close()
  return data.toObject()
}

function generate_py_units(data) {
  // Generate the list of units in units.js.
  const units = new DefaultDict(Array)
  const sortedUnits = Object.values(data.unitsList).sort((a, b) => (a.name > b.name) ? 1 : -1)
  for (let i = 0; i < sortedUnits.length; i += 1) {
    const unit = sortedUnits[i]
    if (static_data.UNIT_TYPES.includes(unit.unitId)) {
      units[unit.race].push(unit)
    }
  }
  function print_race(name, race) {
    console.log(`const ${name} = Enum.IntEnum(${name}, {`)
    console.log(` // ${name} units.`)
    units[race].forEach((unit) => {
      console.log(`  ${unit.name} = ${unit.unitId}`)
    })
    console.log('})')
    console.log('\n')
  }

  console.log(' units.js '.center(60, '-'))
  print_race('Neutral', sc_common.Race.NORACE)
  print_race('Protoss', sc_common.Race.PROTOSS)
  print_race('Terra', sc_common.Race.TERRAN)
  print_race('Zerg', sc_common.Race.ZERG)
}

function generate_py_buffs(data) {
  // Generate the list of buffs in buffs.js.
  console.log(' buffs.js'.center(60, '-'))
  console.log(`const Buffs = Enum.IntEnum('Buffs', {`)
  console.log(` // The list of buffs, as returned from RequestData.`)
  const sortedBuffs = Object.values(data.buffsList).sort((a, b) => (a.name > b.name) ? 1 : -1)
  for (let i = 0; i < sortedBuffs.length; i += 1) {
    const buff = sortedBuffs[i]
    if (static_data.BUFFS.includes(buff.name && buff.buffId)) {
      console.log(`  ${buff.name} = ${buff.buffId}`)
    }
  }
  console.log('})')
  console.log('\n')
}

function generate_py_upgrades(data) {
  // Generate the list of upgrades in upgrades.js.
  console.log(' upgrades.js'.center(60, '-'))
  console.log(`const Upgrades = Enum.IntEnum('Upgrades', {`)
  console.log(' // The list of upgrades, as returned from RequestData.')
  const sortedUpgrades = Object.values(data.upgradesList).sort((a, b) => (a.name > b.name) ? 1 : -1)
  for (let i = 0; i < sortedUpgrades.length; i += 1) {
    const upgrade = sortedUpgrades[i]
    if (static_data.UPGRADES.includes(upgrade.name && upgrade.upgradeId)) {
      console.log(`  ${upgrade.name} = ${upgrade.upgradeId}`)
    }
  }
  console.log('})')
  console.log('\n')
}

async function main() {
  const data = await get_data()
  generate_py_units(data)
  generate_py_buffs(data)
  generate_py_upgrades(data)
}

flags.defineBoolean('m', false, 'treat file as module')
flags.parse()
if (flags.get('m')) {
  module.exports = {
    main,
  }
} else {
  main()
}
