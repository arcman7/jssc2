// Generate the action definitions for actions.py.
const path = require('path')
const flags = require('flags')
const s2clientprotocol = require('s2clientprotocol')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const static_data = require(path.resolve(__dirname, '..', 'lib', 'static_data.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const sc_common = s2clientprotocol.common_pb
const sc_data = s2clientprotocol.data_pb
const sc_pb = s2clientprotocol.sc2api_pb


flags.defineString('command', null, `What to generate. Choices: ['csv', 'python']`).setValidator((input) => {
  if (input == null) {
    throw new Error(`command must be one of: ['csv', 'python']`)
  }
})
flags.defineString('map', 'AcropolisLE', 'Which map to use.')

const used_abilities = Array.from(new Set(static_data.ABILITIES))
const frivolous = [6, 7]
const cancel_slot = [313, 1039, 305, 307, 309, 1832, 1834, 3672]
const unload_unit = [410, 415, 397, 1440, 2373, 1409, 914, 3670]
const skip_abilities = cancel_slot.concat(unload_unit).concat(frivolous)

// function iteritems(d, **kw) {
//     return iter(d.items(**kw))
// }

async function get_data() {
  // Retrieve static data from the game.
  const run_config = run_configs.get()
  const port = (await portspicker.pick_unused_ports(1))[0]
  const sc_process = await run_config.start({ want_rgb: false, port })
  const controller = sc_process._controller
  const m = maps.get(flags.get('map'))
  const create = new sc_pb.RequestCreateGame()
  const localmap = new sc_pb.LocalMap()
  localmap.setMapPath(m.path)
  localmap.setMapData(m.data(run_config))
  create.setLocalMap(localmap)
  const playersetup = new sc_pb.PlayerSetup()
  playersetup.setType(sc_pb.PlayerType.PARTICIPANT)
  create.addPlayerSetup(playersetup)
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
  await controller.quit()
  await controller.close()
  return controller.data()
}

function generate_name(ability) {
  return [ability.friendly_name || ability.button_name || ability.link_name]
}

function sort_key(data, ability) {
  // Alphabetical, with specifics immediately after their generals.
  let name = generate_name(ability)
  if (ability.remaps_to_abililty_id) {
    const general = data.abilities[ability.remaps_to_ability_id]
    name = `${generate_name(general)} ${name}`
  }
  return name
}

function generate_csv(data) {
  // Generate a CSV of the abilities for easy commenting.
  console.log(['ability_id', 'link_name', 'link_index', 'button_name', 'hotkey', 'friendly_name', 'remap_to', 'mismatch'].join(','))

}

function generate_py_ability(data) {

}

function main() {
  const data = get_data()
  console.log('-'.repeat(60))

  if (flags.get('command') == 'csv') {
    generate_scv(data)
  } else if (flags.get('command') == 'python') {
    generate_py_abilities(data)
  }
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
