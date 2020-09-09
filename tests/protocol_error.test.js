const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
// const protocol = require(path.resolve(__dirname, '..', 'lib', 'protocol.js'))
// const remote_controller = require(path.resolve(__dirname, '..', 'lib', 'remote_controller.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const utils = require(path.resolve(__dirname, './utils.js'))

const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb
const { assert, sequentialTaskQueue } = pythonUtils
const msToS = 1 / 1000
const testState = new utils.TestCase()

async function testProtocolError() {
  console.log('testProtocolError:')
  let count = 0
  const start_timer = performance.now() * msToS
  //Verify that we blow up if SC2 thinks we did something wrong.//
  async function test_error() {
    console.log(' running "test_error"')
    count += 1
    testState.setUp()
    const port = (await portspicker.pick_unused_ports(1))[0]
    const sc_process = await run_configs.get().start({ want_rgb: false, port })
    const controller = sc_process._controller
    let errCount = 0
    try {
      await controller.create_game(new sc_pb.RequestCreateGame()) // Missing map, etc.
    } catch (err) {
      console.log('Expected error *******************************')
      console.log(err)
      errCount += 1
    }

    try {
      await controller.join_game(new sc_pb.RequestJoinGame()) // No game to join.
    } catch (err) {
      console.log('Expected error *******************************')
      console.log(err)
      errCount += 1
    }

    await sc_process.close()
    controller.quit()
    testState.tearDown()
    assert(errCount === 2, 'errCount === 2')
  }
  await test_error()

  async function test_replay_a_replay() {
    console.log(' running "test_replay_a_replay"')
    count += 1
    testState.setUp()
    const run_config = run_configs.get()
    const port = (await portspicker.pick_unused_ports(1))[0]
    const sc_process = await run_config.start({ want_rgb: false, port })
    const controller = sc_process._controller
    const map_inst = maps.get('Flat64')
    const map_data = map_inst.data(run_config)
    const Interface = new sc_pb.InterfaceOptions()
    Interface.setRaw(true)
    // Play a quick game to generate a replay.
    const create = new sc_pb.RequestCreateGame()
    const localMap = new sc_pb.LocalMap()
    localMap.setMapPath(map_inst.path)
    localMap.setMapData(map_data)
    create.setLocalMap(localMap)

    let playerSetup = new sc_pb.PlayerSetup()
    playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
    create.addPlayerSetup(playerSetup)
    playerSetup = new sc_pb.PlayerSetup()
    playerSetup.setType(sc_pb.PlayerType.COMPUTER)
    playerSetup.setRace(sc_common.Race.TERRAN)
    playerSetup.setDifficulty(sc_pb.Difficulty.VERYEASY)
    create.addPlayerSetup(playerSetup)

    const join = new sc_pb.RequestJoinGame()
    join.setRace(sc_common.Race.TERRAN)
    join.setOptions(Interface)

    await controller.create_game(create)
    await controller.join_game(join)
    await controller.step(100)
    const obs = await controller.observe()
    const replay_data = await controller.save_replay()

    // Run through the replay the first time, verifying that it finishes, but
    // wasn't recording a replay.
    const start_replay = new sc_pb.RequestStartReplay()
    start_replay.setReplayData(replay_data)
    start_replay.setMapData(map_data)
    start_replay.setOptions(Interface)
    start_replay.setObservedPlayerId(1)
    console.log('A1')
    await controller.start_replay(start_replay)
    await controller.step(1000)
    const obs2 = await controller.observe()
    assert(
      obs.getObservation().getGameLoop() === obs2.getObservation().getGameLoop(),
      'obs.getObservation().getGameLoop() === obs2.getObservation().getGameLoop()'
    )

    let errCount = 0
    try {
      await controller.save_replay()
    } catch (err) {
      console.log('Expected error *******************************')
      console.log(err)
      errCount += 1
    }
    console.log('A2')

    // Run through the replay a second time, verifying that it finishes, and
    // *was* recording a replay.
    start_replay.setRecordReplay(false)
    await controller.start_replay(start_replay)
    await controller.step(1000)
    const obs3 = await controller.observe()
    assert(
      obs.getObservation().getGameLoop() === obs3.getObservation().getGameLoop(),
      'obs.getObservation().getGameLoop() === obs3.getObservation().getGameLoop()'
    )
    console.log('A3')

    try {
      await controller.save_replay()
    } catch (err) {
      console.log('Expected error *******************************')
      console.log(err)
      errCount += 1
    }

    console.log('A4')

    await sc_process.close()
    controller.quit()
    assert(errCount === 2, `errCount === 2, got: ${errCount}`)
    testState.tearDown()
  }
  await test_replay_a_replay()

  console.log(`\n----------------------------------------------------------------------\nRan ${count} test(s) in ${(performance.now() * msToS) - start_timer}s\n\n`)
}

testProtocolError()
