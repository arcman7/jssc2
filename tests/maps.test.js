const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const utils = require(path.resolve(__dirname, './utils.js'))

const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb
const { assert, randomSample, sequentialTaskQueue } = pythonUtils
const msToS = 1 / 1000
let _sc2_proc = null
const testState = new utils.TestCase()

async function tearDown() {
  if (_sc2_proc) {
    await _sc2_proc.close()
    _sc2_proc = null
  }
  return true
}


async function mapsTest() {
  console.log('mapsTest:')
  const start_timer = performance.now() * msToS

  function get_maps(count = null, filter_fn = null) {
    //Test only a few random maps to minimize time.//
    const temp = maps.get_maps()
    const all_maps = {}
    Object.keys(temp).forEach((k) => {
      const v = temp[k]
      if (filter_fn === null || filter_fn(v)) {
        all_maps[k] = v
      }
    })
    count = count || Object.keys(all_maps).length
    return randomSample(Object.keys(all_maps), Math.min(count, Object.keys(all_maps).length))
  }

  function cache_sc2_proc(func) {
    //A decorator to replace setUp/tearDown so it can handle exceptions.//
    async function _cache_sc2_proc() {
      testState.setUp()
      if (!_sc2_proc) {
        const port = (await portspicker.pick_unused_ports(1))[0]
        _sc2_proc = await run_configs.get().start({ want_rgb: false, port })
      }
      try {
        return func(_sc2_proc.controller, ...arguments) //eslint-disable-line
      } catch (err) {
        await _sc2_proc.close()
        _sc2_proc = null
        console.error(err)
        throw err
      }
    }
    return _cache_sc2_proc
  }

  let count = 0

  function logFuncName() {
    console.log(` running: "${logFuncName.caller.name}`)
    count += 1
  }

  async function test_list_all_maps() {
    //Make sure all maps can be read.//
    logFuncName()
    const run_config = run_configs.get()
    const mapNames = get_maps()
    mapNames.forEach((map_name) => {
      try {
        const map_inst = maps.get(map_name)
        assert(map_inst.players !== null, 'map_inst.players !== null')
        assert(map_inst.players >= 1, 'map_inst.players >= 1')
        assert(map_inst.players <= 8, 'map_inst.players <= 8')
        assert(map_inst.data(run_config), `Failed to get map data on ${map_inst}`)
        console.info(`   SUCCEED: map: ${map_inst.name}`)
      } catch (err) {
        console.log(`    FAILED on ${map_name}\nerror: ${err.message}`)
      }
    })
  }
  await test_list_all_maps()
  async function test_list_battle_net_maps(controller) {
    // testState.setUp()
    logFuncName()
    const map_names = get_maps(null, (m) => m.battle_net)
    const map_list = new Set(...(map_names.map((m) => maps.get(m).battle_net)))

    let available_maps = await controller.available_maps()
    available_maps = new Set(available_maps.getBattlenetMapNamesList())
    const unavailable = Object.keys(map_list).filter((m) => !available_maps.has(m))
    assert(unavailable.length === 0, 'unavailable.length === 0')
    testState.tearDown()
  }
  await (cache_sc2_proc(test_list_battle_net_maps)())

  async function test_load_random_map(controller) {
    //Test loading a few random maps.//
    // testState.setUp()
    logFuncName()
    const run = async (map_name) => {
      const m = maps.get(map_name)
      const run_config = run_configs.get()

      console.info(`    Loading map: ${m.name}`)
      const create = new sc_pb.RequestCreateGame()
      const localMap = new sc_pb.LocalMap()
      localMap.setMapPath(m.path)
      localMap.setMapData(m.data(run_config))
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
      const Interface = new sc_pb.InterfaceOptions()
      Interface.setRaw(true)
      join.setOptions(Interface)
      join.setRace(sc_common.Race.RANDOM)
      await controller.create_game(create)
      await controller.join_game(join)

      // Verify it has the right mods and isn't running into licensing issues.
      const info = await controller.game_info()
      console.info(`Mods for ${m.name}  ${info.getModNamesList()}`)
      assert(info.getModNamesList().includes('Mods/Void.SC2Mod'), "info.getmodNamesList().match('Mods/Void.SC2Mod')")
      assert(info.getModNamesList().includes('Mods/VoidMulti.SC2Mod'), "info.getmodNamesList().match('Mods/VoidMulti.SC2Mod')")
      return true
    }

    const tasks = get_maps(5).map((map_name) => () => run(map_name))
    await sequentialTaskQueue(tasks)
    testState.tearDown()
  }
  await (cache_sc2_proc(test_load_random_map))()

  async function test_load_battle_net_map(controller) {
    //Test loading a few random battle.net maps.//
    // testState.setUp()
    logFuncName()
    const run = async (map_name) => {
      const m = maps.get(map_name)
      const run_config = run_configs.get()

      console.info(`    Loading battle.net map: ${m.name}`)
      const create = new sc_pb.RequestCreateGame()
      const localMap = new sc_pb.LocalMap()
      localMap.setMapPath(m.path)
      localMap.setMapData(m.data(run_config))
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
      const Interface = new sc_pb.InterfaceOptions()
      Interface.setRaw(true)
      join.setOptions(Interface)
      join.setRace(sc_common.Race.RANDOM)
      await controller.create_game(create)
      await controller.join_game(join)

      // Verify it has the right mods and isn't running into licensing issues.
      const info = await controller.game_info()
      console.info(`Mods for ${m.name}  ${info.getModNamesList()}`)
      assert(info.getModNamesList().includes('Mods/Void.SC2Mod'), "info.getmodNamesList().match('Mods/Void.SC2Mod')")
      assert(info.getModNamesList().includes('Mods/VoidMulti.SC2Mod'), "info.getmodNamesList().match('Mods/VoidMulti.SC2Mod')")
      return true
    }

    const tasks = get_maps(5, (m) => m.battle_net).map((map_name) => () => run(map_name))
    await sequentialTaskQueue(tasks)
    testState.tearDown()
  }
  await (cache_sc2_proc(test_load_battle_net_map))()

  console.log(`\n----------------------------------------------------------------------\nRan ${count} test(s) in ${(performance.now() * msToS) - start_timer}s\n\n`)
  return true
}

mapsTest().then(() => tearDown()).catch((err) => { tearDown(); console.error(err) })
