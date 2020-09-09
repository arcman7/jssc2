const path = require('path') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const actions = require(path.resolve(__dirname, '..', 'lib', 'actions.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const utils = require(path.resolve(__dirname, './utils.js'))

const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

const { assert } = pythonUtils

async function test_general_actions() {
  //Verify that the general ids in stable ids match what we expect.//

  const testState = new utils.TestCase()
  testState.setUp()
  const run_config = run_configs.get()
  const port = (await portspicker.pick_unused_ports(1))[0]

  const sc_process = await run_config.start({ want_rgb: false, port })
  const controller = sc_process._controller
  testState._sc2_proces = [sc_process]
  testState._controllers = [controller]

  const map_inst = maps.get('Simple64')
  const create = new sc_pb.RequestCreateGame()
  create.setRealtime(false)
  create.setDisableFog(false)
  const localMap = new sc_pb.LocalMap()
  localMap.setMapPath(map_inst.path)
  localMap.setMapData(map_inst.data(run_config))
  create.setLocalMap(localMap)

  let playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
  create.addPlayerSetup(playerSetup)
  playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.COMPUTER)
  playerSetup.setRace(sc_common.Race.RANDOM)
  playerSetup.setDifficulty(sc_pb.Difficulty.VERYEASY)
  create.addPlayerSetup(playerSetup)

  const join = new sc_pb.RequestJoinGame()
  join.setRace(sc_common.Race.RANDOM)
  const Interface = new sc_pb.InterfaceOptions()
  Interface.setRaw(true)
  join.setOptions(Interface)

  await controller.create_game(create)
  await controller.join_game(join)

  const abilities = (await controller.data()).abilities

  await controller.quit()
  await sc_process.close()

  const errors = []

  for (let i = 0; i < actions.FUNCTIONS.length; i++) {
    const f = actions.FUNCTIONS[i]
    if ((abilities[f.ability_id].remapsToAbilityId || 0) != f.general_id) {
      errors.push(`FUNCTIONS ${f.id}/${f.name} has ability ${f.ability_id}, general ${f.general_id}, expected general ${abilities[f.ability_id].remapsToAbilityId}`)
    }
  }

  for (let i = 0; i < actions.RAW_FUNCTIONS.length; i++) {
    const f = actions.RAW_FUNCTIONS[i]
    if ((abilities[f.ability_id].remapsToAbilityId || 0) != f.general_id) {
      errors.push(`RAW_FUNCTIONS ${f.id}/${f.name} has ability ${f.ability_id}, general ${f.general_id}, expected general ${abilities[f.ability_id].remapsToAbilityId}`)
    }
  }
  const errStr = errors.join('\n')

  try {
    assert(!errStr, 'expected no errors!')
    testState.tearDown()
  } catch (err) {
    throw new Error(errStr)
  }
}

test_general_actions()
