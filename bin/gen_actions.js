// Generate the action definitions for actions.py.
const path = require('path')
const flags = require('flags')
const s2clientprotocol = require('s2clientprotocol')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const static_data = require(path.resolve(__dirname, '..', 'lib', 'static_data.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { getattr } = pythonUtils
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

function generate_name(ability) {
  return [ability.friendlyName || ability.buttonName || ability.linkName]
}

function sort_key(data, ability) {
  // Alphabetical, with specifics immediately after their generals.
  let name = generate_name(ability)
  if (ability.remapsToAbilityId) {
    const general = data.abilities[ability.remapsToAbilityId]
    name = `${generate_name(general)} ${name}`
  }
  return name
}

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
  const data = await controller.data()
  await controller.quit()
  await controller.close()
  return data
}

function check_mismatch(ability, parent, attr) {
  if (getattr(ability, attr) !== getattr(parent, attr)) {
    return `${attr}: ${getattr(ability, attr)}`
  }
}

function generate_csv(data) {
  // Generate a CSV of the abilities for easy commenting.
  console.log(['abilityId', 'linkName', 'linkIndex', 'buttonName', 'hotkey', 'friendlyName', 'remapTo', 'mismatch'].join(','))
  const abilities = Object.values(data.abilities).sort((a, b) => (sort_key(data, a) > sort_key(data, b)) ? 1 : -1)
  abilities.forEach((key) => {
    const ability = abilities[key]
    const ab_id = ability.abilityId
    if (skip_abilities.includes(ab_id) || (!data.general_abilities.includes(ab_id) && !used_abilities.includes(ab_id))) {
      return
    }

    let general = ''
    if (data.general_abilities.includes(ab_id)) {
      general = 'general'
    } else if (ability.remapsToAbilityId) {
      general = ability.remapsToAbilityId
    }
    let mismatch = ''
    if (ability.remapsToAbilityId) {
      const parent = data.abilities[ability.remapsToAbilityId]
      mismatch = [
        check_mismatch(ability, parent, 'available'),
        check_mismatch(ability, parent, 'target'),
        check_mismatch(ability, parent, 'allowMinimap'),
        check_mismatch(ability, parent, 'allowAutocast'),
        check_mismatch(ability, parent, 'isBuilding'),
        check_mismatch(ability, parent, 'footprintRadius'),
        check_mismatch(ability, parent, 'isInstantPlacement'),
        check_mismatch(ability, parent, 'castRange'),
      ].filter((v) => v !== null || v !== undefined).join('; ')
    }
    console.log([
      ability.abilityID,
      ability.linkName,
      ability.linkIndex,
      ability.buttonName,
      ability.hotkey,
      ability.friendlyName,
      general,
      mismatch,
    ].map((v) => String(v))).join(',')
  })
}

function print_action(func_id, name, func, ab_id, general_id) {
  const args = [func_id, `"${name}"`, func, ab_id]
  if (general_id) {
    args.push(general_id)
  }
  const print = []
  for (let i = 0; i < args.length; i += 1) {
    print.push(String(args[i]))
  }
  console.log(`   Function.ability(${print.join(', ')})`)
}

function generate_py_abilities(data) {
  // Generate the list of functions in actions.py.
  let func_ids = 12
  const abilities = Object.values(data.abilities).sort((a, b) => (sort_key(data, a) > sort_key(data, b)) ? 1 : -1)
  abilities.forEach((key) => {
    const ability = abilities[key]
    const ab_id = ability.abilityID
    if (skip_abilities.includes(ab_id) || (data.general_abilities.includes(ab_id) && used_abilities.includes(ab_id))) {
      return
    }
    const name = generate_name(ability).replace(' ', '_')

    if ([sc_data.AbilityData.Target['NONE'], sc_data.AbilityData.Target['POINTORNONE']].inclues(ability.target)) {
      print_action(func_ids, name + 'Quick', 'cmdQuick', ab_id, ability.remapsToAbilityId)
    }
    if (ability.target !== sc_data.AbilityData.Target['NONE']) {
      print_action(func_ids, name + 'Screen', 'cmdScreen', ab_id, ability.remapsToAbilityId)
      if (ability.allowMinimap) {
        print_action(func_ids, name + 'Minimap', 'cmdMinimap', ab_id, ability.remapsToAbilityId)
      }
    }
    if (ability.allowAutocast) {
      print_action(func_ids, name + 'Autocast', 'autocast', ab_id, ability.remapsToAbilityId)
    }
    func_ids += 1
  })
}

function main() {
  const data = get_data()
  console.log('-'.repeat(60))
  generate_csv(data)
  if (flags.get('command') == 'csv') {
    generate_csv(data)
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
