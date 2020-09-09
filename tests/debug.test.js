const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const units = require(path.resolve(__dirname, '..', 'lib', 'units.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const sc_common = s2clientprotocol.common_pb
const sc_debug = s2clientprotocol.debug_pb
const sc_pb = s2clientprotocol.sc2api_pb

const { assert } = pythonUtils

async function main() {
  const msToS = 1 / 1000
  const start_timer = performance.now() * msToS
  async function test_multi_player() {
    console.log('test_multi_player run: 1')

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
    const Interface = new sc_pb.InterfaceOptions()
    Interface.setRaw(true)
    join.setOptions(Interface)

    await controller.create_game(create)
    await controller.join_game(join)

    const info = await controller.game_info()
    const map_size = info.getStartRaw().getMapSize()

    await controller.step(2)

    let obs = await controller.observe()

    function get_marines(observation) {
      const marines = {}
      const unitss = observation.getObservation().getRawData().getUnitsList()
      unitss.forEach((u) => {
        if (u.getUnitType() == units.Terran.Marine) {
          marines[u.getTag()] = u
        }
      })
      return marines
    }

    assert(Object.keys(get_marines(obs)).length === 0, 'no marine units on map')

    const pos = new sc_common.Point2D()
    pos.setX(map_size.getX() / 2)
    pos.setY(map_size.getY() / 2)
    const createUnitReq = new sc_debug.DebugCreateUnit()
    createUnitReq.setUnitType(units.Terran.Marine)
    createUnitReq.setOwner(1)
    createUnitReq.setPos(pos)
    createUnitReq.setQuantity(5)
    const req = new sc_debug.DebugCommand()
    req.setCreateUnit(createUnitReq)
    await controller.debug(req)

    await controller.step(2)

    obs = await controller.observe()

    let marines = get_marines(obs)
    assert(Object.keys(marines).length === 5, 'marines.length === 5')

    const tags = Object.keys(marines)

    const killUnitReq = new sc_debug.DebugKillUnit()
    killUnitReq.addTag(tags[0])
    const debugCommand1 = new sc_debug.DebugCommand()
    debugCommand1.setKillUnit(killUnitReq)
    const setUnitValueReq = new sc_debug.DebugSetUnitValue()
    setUnitValueReq.setUnitValue(sc_debug.DebugSetUnitValue.UnitValue.LIFE)
    setUnitValueReq.setValue(5)
    setUnitValueReq.setUnitTag(tags[1])
    const debugCommand2 = new sc_debug.DebugCommand()
    debugCommand2.setUnitValue(setUnitValueReq)
    await controller.debug([debugCommand1, debugCommand2])

    await controller.step(2)

    obs = await controller.observe()

    marines = get_marines(obs)
    assert(Object.keys(marines).length === 4, 'marines.length === 4')
    assert(!marines.hasOwnProperty(tags[0]), 'tags[0] not in marines')
    assert(marines[tags[1]].getHealth() === 5, 'marines[tags[1]].getHealth() === 5')

    await controller.quit()
    await sc_process.close()
  }
  await test_multi_player()
  console.log(`\n----------------------------------------------------------------------\nRan 1 test in ${(performance.now() * msToS) - start_timer}s\n\n`)
}

main()
