const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const actions = require(path.resolve(__dirname, '..', 'lib', 'actions.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const point = require(path.resolve(__dirname, '..', 'lib', 'point.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const { assert, getattr, sequentialTaskQueue, snakeToPascal } = pythonUtils //eslint-disable-line

const sc_common = s2clientprotocol.common_pb
const sc_debug = s2clientprotocol.debug_pb
const sc_error = s2clientprotocol.error_pb
const sc_raw = s2clientprotocol.raw_pb
const sc_pb = s2clientprotocol.sc2api_pb

const msToS = 1 / 1000

class TestCase {
  //A test base class that enables stopwatch profiling.

  setUp() { //eslint-disable-line
    stopwatch.sw.clear()
    stopwatch.sw.enable()
    this._start_timer = performance.now() * msToS
  }
  tearDown(moreTestsNext = false) { //eslint-disable-line
    // const s = stopwatch.sw.toString()
    let sw
    if (this._sc2_procs) {
      sw = this._sc2_procs[0]._sw
      for (let i = 1; i < this._sc2_procs.length; i++) {
        sw.merge(this._sc2_procs[i]._sw)
      }
      if (this._sc2_procs[0]._sw !== stopwatch.sw) {
        sw.merge(stopwatch.sw)
      }
    }
    sw = sw || stopwatch.sw
    const s = sw.toString()
    if (s) {
      console.info(`Stop watch profile:\n${s}`)
    }
    stopwatch.sw.disable();
    (this._sc2_procs || []).forEach((p) => p._sw.disable())
    const duration = (performance.now() * msToS) - this._start_timer
    this._tests_ran = (this._tests_ran || 0) + 1
    if (moreTestsNext === false) {
      console.log(`\n----------------------------------------------------------------------\nRan ${this._tests_ran} test in ${duration}s\n\n`)
    } else {
      this._total_time = (this._total_time || 0) + duration
    }
  }
}

function get_units({ obs, filter_fn = null, owner = null, unit_type = null, tag = null }) {
  //Return a dict of units that match the filter.//
  let checkUnitType
  if (unit_type) {
    if (Array.isArray(unit_type)) {
      checkUnitType = (type) => {
        for (let i = 0; i < unit_type.length; i++) {
          if (unit_type[i] == type) {
            return true
          }
        }
      }
    } else if (typeof unit_type === 'function') {
      checkUnitType = (type) => unit_type(type)
    } else {
      checkUnitType = (type) => unit_type == type
    }
  }
  const out = {}
  const units = obs.getObservation().getRawData().getUnitsList()
  units.forEach((u) => {
    if ((filter_fn === null || filter_fn(u))
      && (owner === null || u.getOwner() === owner)
      && (unit_type === null || checkUnitType(u.getUnitType()))
      && (tag === null || u.getTag() === tag)) {
      out[u.getTag()] = u
    }
  })
  return out
}

function get_unit(kwargs) {
  //Return the first unit that matches, or None.//
  const out = get_units(kwargs) //eslint-disable-line
  return out[Object.keys(out)[0]] || null
}

// tensor flow version of xy_locs is twice as slow
// async function xy_locs(mask) {
//   // Javascript: Assuming mask is an array of bools
//   // Mask should be a set of bools from comparison with a feature layer.//
//   return (await np.whereAsync(mask)).arraySync().map(([x, y]) => new point.Point(x, y))
// }
function xy_locs(grid, compare) {
//   // Javascript: Assuming mask is an array of bools
//   // Mask should be a set of bools from comparison with a feature layer.//
  const result = []
  grid.forEach((row, y) => {
    row.forEach((colVal, x) => {
      if (colVal == compare) {
        result.push(new point.Point(x, y))
      }
    })
  })
  return result
}

function only_in_game(func) {
  function decorator() {
    if (this.in_game) {
      return func(...arguments) //eslint-disable-line
    }
  }
  return decorator
}

const noPlayerIdNeeded = 0

class GameReplayTestCase extends TestCase {
  //Tests that run through a game, then verify it still works in a replay.//
  constructor() {
    super()
    this.move_camera = only_in_game.call(this, this.move_camera.bind(this))
    this.raw_unit_command = only_in_game.call(this, this.raw_unit_command.bind(this))
    this.debug = only_in_game.call(this, this.debug.bind(this))
  }

  static setup() {
    //A decorator to replace unittest.setUp so it can take args.//
    const kwargs = arguments[0] || {} //eslint-disable-line
    function decorator(func) {
      async function _setup(self) {
        async function test_in_game() {
          console.log(` ${func.name}: Starting game `.center(80, '-'))
          await self.start_game(kwargs) //eslint-disable-line
          await func(self)
          return true
        }

        async function test_in_replay() {
          console.log(`${func.name}: Starting replay `.center(80, '-'))
          await self.start_replay()
          await func(self)
          return true
        }

        self.setUp()
        try {
          await test_in_game()
          await test_in_replay()
          self.tearDown()
          self.close()
          return true
        } catch (err) {
          console.error(err)
          self.close()
          return false
        }
      }
      return _setup
    }
    return decorator
  }

  async start_game({ show_cloaked = true, disable_fog = false, players = 2 }) {
    //Start a multiplayer game with options.//
    this._disable_fog = disable_fog
    const run_config = run_configs.get()
    const map_inst = maps.get('Flat64')
    this._map_data = map_inst.data(run_config)

    this._ports = players === 2 ? await portspicker.pick_unused_ports(4) : []
    // using an extra 2 to ensure each sc_process is started on a unique port
    const unique_ports = await portspicker.pick_unused_ports(players || 1)
    this._sc2_procs = []
    for (let i = 0; i < players; i++) {
      this._sc2_procs.push(run_config.start({ want_rgb: false, port: unique_ports[i], passedSw: new stopwatch.StopWatch(true) }))
    }
    this._sc2_procs = await Promise.all(this._sc2_procs)
    this._sc2_procs.forEach((p) => p._sw.enable())
    this._controllers = this._sc2_procs.map((p) => p._controller)

    if (players === 2) {
      // Serial due to a race condition on Windows.
      await this._controllers[0].save_map(map_inst.path, this._map_data)
      await this._controllers[1].save_map(map_inst.path, this._map_data)
    }

    this._interface = new sc_pb.InterfaceOptions()
    this._interface.setRaw(true)
    this._interface.setRawCropToPlayableArea(true)
    this._interface.setShowCloaked(show_cloaked)
    this._interface.setScore(false)
    const featureLayer = new sc_pb.SpatialCameraSetup()
    featureLayer.setWidth(24)
    const resolution = new sc_pb.Size2DI()
    resolution.setX(64)
    resolution.setY(64)
    featureLayer.setResolution(resolution)
    const minimapResolution = new sc_pb.Size2DI()
    minimapResolution.setX(64)
    minimapResolution.setY(64)
    featureLayer.setMinimapResolution(minimapResolution)
    this._interface.setFeatureLayer(featureLayer)

    const create = new sc_pb.RequestCreateGame()
    create.setRandomSeed(1)
    create.setDisableFog(this._disable_fog)
    const localMap = new sc_pb.LocalMap()
    localMap.setMapPath(map_inst.path)
    create.setLocalMap(localMap)
    for (let i = 0; i < players; i++) {
      const playerSetup = new sc_pb.PlayerSetup()
      playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
      create.addPlayerSetup(playerSetup)
    }

    if (players === 1) {
      create.getLocalMap().setMapData(this._map_data)
      const playerSetup = new sc_pb.PlayerSetup()
      playerSetup.setType(sc_pb.PlayerType.COMPUTER)
      playerSetup.setRace(sc_common.Race.RANDOM)
      playerSetup.setDifficulty(sc_pb.Difficulty.VERYEASY)
      create.addPlayerSetup(playerSetup)
    }

    const join = new sc_pb.RequestJoinGame()
    join.setRace(sc_common.Race.PROTOSS)
    join.setOptions(this._interface)

    if (players === 2) {
      join.setSharedPort(0) //unused
      const serverPorts = new sc_pb.PortSet()
      serverPorts.setGamePort(this._ports[0])
      serverPorts.setBasePort(this._ports[1])
      join.setServerPorts(serverPorts)
      const clientPorts = new sc_pb.PortSet()
      clientPorts.setGamePort(this._ports[2])
      clientPorts.setBasePort(this._ports[3])
      join.addClientPorts(clientPorts)
    }

    await this._controllers[0].create_game(create)

    // must be done in tandem
    await Promise.all(this._controllers.map((c) => c.join_game(join)))

    this._info = await this._controllers[0].game_info()
    this._features = features.features_from_game_info({
      game_info: this._info,
      kwargs: { use_raw_units: true },
    })

    this._map_size = point.Point.build(this._info.getStartRaw().getMapSize())
    this.in_game = true
    await this.step() // Get into the game properly.
    return true
  }

  async start_replay() {
    //Switch from the game to a replay.//
    await this.step(300)
    const replay_data = await this._controllers[0].save_replay()
    await Promise.all(this._controllers.map((c) => c.leave()))
    await Promise.all(this._controllers.map((controller, player_id) => {
      const req = new sc_pb.RequestStartReplay()
      req.setReplayData(replay_data)
      req.setMapData(this._map_data)
      req.setOptions(this._interface)
      req.setDisableFog(this._disable_fog)
      req.setObservedPlayerId(player_id + 1)
      return controller.start_replay(req)
    }))
    this.in_game = false
    await this.step() // Get into the game properly.
    return true
  }

  async close() { // Instead of tearDown.
    //Shut down the SC2 instances."//
    // Don't use parallel since it might be broken by an exception.
    if (this._controllers && this._controllers.length) {
      await Promise.all(this._controllers.map((c) => c.quit()))
      this._controllers = null
    }
    if (this._sc2_procs && this._sc2_procs.length) {
      await Promise.all(this._sc2_procs.map((p) => p.close()))
      this._sc2_procs = null
    }

    if (this._ports && this._ports.length) {
      //portspicker.return_ports(self._ports) // can't do this yet
      this._ports = null
    }
    this._parallel = null
  }

  step(count = 4) {
    return Promise.all(this._controllers.map((c) => c.step(count)))
  }

  observe(disable_fog = false) {
    return Promise.all(this._controllers.map((c) => c.observe(disable_fog)))
  }

  move_camera(x, y) {
    const action = new sc_pb.Action()
    const actionRaw = new sc_raw.ActionRaw()
    const cameraMove = new sc_raw.ActionRawCameraMove()
    const centerWorldSpace = new sc_raw.Point()
    centerWorldSpace.setX(x)
    centerWorldSpace.setY(y)
    cameraMove.setCenterWorldSpace(centerWorldSpace)
    actionRaw.setCameraMove(cameraMove)
    action.setActionRaw(actionRaw)
    return Promise.all(this._controllers.map((c) => c.act(action)))
  }

  async raw_unit_command(player, ability_id, unit_tags, pos = null, target = null) {
    //Issue a raw unit command.//
    if (typeof ability_id === 'string') {
      ability_id = actions.FUNCTIONS[ability_id].ability_id
    }
    const action = new sc_pb.Action()
    const actionRaw = new sc_raw.ActionRaw()
    const cmd = new sc_raw.ActionRawUnitCommand()
    actionRaw.setUnitCommand(cmd)
    action.setActionRaw(actionRaw)
    cmd.setAbilityId(ability_id)
    if (Array.isArray(unit_tags)) {
      unit_tags.forEach((unit_tag) => cmd.addUnitTags(unit_tag))
    } else {
      cmd.addUnitTags(unit_tags)
    }
    if (pos) {
      const targetWorldSpacePos = new sc_raw.Point2D()
      targetWorldSpacePos.setX(pos[0])
      targetWorldSpacePos.setY(pos[1])
      cmd.setTargetWorldSpacePos(targetWorldSpacePos)
    } else if (target) {
      cmd.setTargetUnitTag(target)
    }
    const response = await this._controllers[player].act(action)
    const resultList = response.getResultList()
    for (let i = 0; i < resultList.length; i++) {
      const result = resultList[i]
      assert(result == sc_error.ActionResult.SUCCESS, `result == sc_error.ActionResult.SUCCESS, got: ${result}`)
    }
    return true
  }

  debug(player = 0, { create_unit, draw, end_game, game_state, kill_unit, test_process, score, unit_value }) {
    const req = new sc_debug.DebugCommand()
    if (create_unit) {
      req.setCreateUnit(create_unit)
    } else if (draw) {
      req.setDraw(draw)
    } else if (end_game) {
      req.setEndGame(end_game)
    } else if (game_state) {
      req.setGameState(game_state)
    } else if (kill_unit) {
      req.setKillUnit(kill_unit)
    } else if (test_process) {
      req.setTestProcess(test_process)
    } else if (score) {
      req.setScore(score)
    } else if (unit_value) {
      req.setUnitValue(unit_value)
    } else {
      const key = Object.keys(arguments[1])[0] //eslint-disable-line
      const value = arguments[1][key] //eslint-disable-line
      throw new Error(`Unrecognized debug command '${key}': ${value}`)
    }
    return this._controllers[player].debug([req])
  }

  async god() {
    //Stop the units from killing each other so we can observe them.//
    await this.debug(0, { game_state: sc_debug.DebugGameState.GOD })
    await this.debug(1, { game_state: sc_debug.DebugGameState.GOD })
  }

  create_unit(unit_type, owner, pos, quantity = 1) {
    const usedPos = new sc_common.Point2D()
    if (Array.isArray(pos)) {
      usedPos.setX(pos[0])
      usedPos.setY(pos[1])
    } else if (pos instanceof sc_common.Point) {
      usedPos.setX(pos.getX())
      usedPos.setY(pos.getY())
    }
    const debugReq = new sc_debug.DebugCreateUnit()
    debugReq.setUnitType(unit_type)
    debugReq.setOwner(owner)
    debugReq.setPos(usedPos)
    debugReq.setQuantity(quantity)
    return this.debug(noPlayerIdNeeded, { create_unit: debugReq })
  }

  kill_unit(unit_tags) {
    const debugReq = new sc_debug.DebugKillUnit()
    if (!Array.isArray(unit_tags)) {
      debugReq.addTag(unit_tags)
    } else {
      unit_tags.forEach((unit_tag) => {
        debugReq.addTag(unit_tag)
      })
    }
    return this.debug(noPlayerIdNeeded, { kill_unit: debugReq })
  }

  set_energy(tag, energy) {
    const debugReq = new sc_debug.DebugSetUnitValue()
    debugReq.setUnitValue(sc_debug.DebugSetUnitValue.UnitValue.ENERGY)
    debugReq.setValue(energy)
    debugReq.setUnitTag(tag)
    return this.debug(noPlayerIdNeeded, { unit_value: debugReq })
  }

  assert_point(proto_pos, pos) { //eslint-disable-line
    assert(proto_pos.getX().toFixed(7) === pos[0].toFixed(7), 'assertAlmostEqual')
    assert(proto_pos.getY().toFixed(7) === pos[1].toFixed(7), 'assertAlmostEqual')
  }

  assert_layers(layers, pos, kwargs) { //eslint-disable-line
    const keys = Object.keys(kwargs)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const v = kwargs[k]
      assert(layers[k][pos.y][pos.x] == v, `${k}[${pos.y}, ${pos.x}]: expected: ${v}, got: ${layers[k][pos.y][pos.x]}`)
    }
  }

  assert_unit(unit, kwargs) {
    assert(unit, 'unit')
    assert(unit instanceof sc_raw.Unit, `unit instanceof sc_raw.Unit, got: ${unit && unit.toObject ? unit.toObject() : unit}`)
    const keys = Object.keys(kwargs)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      let v = kwargs[k]
      if (k === 'pos') {
        this.assert_point(unit.getPos(), v)
      } else {
        let compare = getattr(unit, k) || unit[k]
        if (compare && compare.toObject) {
          compare = compare.toObject()
        }
        if (v.toObject) {
          v = v.toObject()
        }
        if (typeof compare === 'object') {
          const compareKeys = Object.keys(compare)
          for (let j = 0; j < compareKeys; j++) {
            const cKey = compareKeys[j]
            assert(compare[cKey] == v[cKey], `${k}: expected: ${v}, got: ${compare}`)
          }
        } else {
          if (v == 0 & compare === undefined) {
            return
          }
          assert(compare == v, `${k}: expected: ${v}, got: ${compare}`)
        }
      }
    }
  }
}

module.exports = {
  get_unit,
  get_units,
  GameReplayTestCase,
  TestCase,
  xy_locs,
}
