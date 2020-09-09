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
const { assert, sequentialTaskQueue } = pythonUtils
const msToS = 1 / 1000
const testState = new utils.TestCase()

async function testObserver() {
  //Test that two built in bots can be watched by an observer.//
  console.log('testObserver:')
  const start_timer = performance.now() * msToS
  testState.setUp()

  const run_config = run_configs.get()
  const map_inst = maps.get('Simple64')
  const port = (await portspicker.pick_unused_ports(1))[0]
  const sc_process = await run_config.start({ want_rgb: false, port })
  const controller = sc_process._controller

  const create = new sc_pb.RequestCreateGame()
  const localMap = new sc_pb.LocalMap()
  localMap.setMapPath(map_inst.path)
  localMap.setMapData(map_inst.data(run_config))
  create.setLocalMap(localMap)
  create.setRealtime(false)
  create.setDisableFog(false)
  let playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.OBSERVER)
  create.addPlayerSetup(playerSetup)
  // player 1 very easy comp
  playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.COMPUTER)
  playerSetup.setRace(sc_common.Race.RANDOM)
  playerSetup.setDifficulty(sc_pb.Difficulty.VERYHARD)
  create.addPlayerSetup(playerSetup)
  // player 2 very hard comp
  playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.COMPUTER)
  playerSetup.setRace(sc_common.Race.RANDOM)
  playerSetup.setDifficulty(sc_pb.Difficulty.VERYHARD)
  create.addPlayerSetup(playerSetup)

  const Interface = new sc_pb.InterfaceOptions() //cheap observations
  Interface.setRaw(true)

  const join = new sc_pb.RequestJoinGame()
  join.setObservedPlayerId(0)
  join.setOptions(Interface)

  await controller.create_game(create)
  await controller.join_game(join)

  let outcome = false
  const tasks = []
  const resultStatus = { 1: 'VICTORY', 2: 'DEFEAT', 3: 'TIE', 4: 'UNDECIDED' }
  for (let i = 0; i < 60 * 60; i++) { //60 minutes should be plenty.
    tasks.push(async () => { //eslint-disable-line
      if (outcome) {
        return true
      }
      await controller.step(16)
      const obs = await controller.observe()
      if (obs.getPlayerResultList().length) {
        console.log(`Outcome after ${obs.getObservation().getGameLoop()} steps (${obs.getObservation().getGameLoop() / (16 * 60)}`)
        obs.getPlayerResultList().forEach((r) => {
          console.log(`Player ${r.getPlayerId()}: ${resultStatus[r.getResult()]}`)
        })
        outcome = true
      }
      return true
    })
  }
  await sequentialTaskQueue(tasks)
  await sc_process.close()
  controller.quit()
  assert(outcome, 'outcome')
  testState.tearDown()
  console.log(`\n----------------------------------------------------------------------\nRan 1 test(s) in ${(performance.now() * msToS) - start_timer}s\n\n`)
}

testObserver()
