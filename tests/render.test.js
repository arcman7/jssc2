const path = require('path') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const np = require(path.resolve(__dirname, '..', 'lib', 'numpy.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const utils = require(path.resolve(__dirname, './utils.js'))

const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

const { arrayCompare, assert, sequentialTaskQueue } = pythonUtils

async function testRender() {
  const testState = new utils.TestCase()
  testState.setUp()

  const Interface = new sc_pb.InterfaceOptions()
  Interface.setRaw(true)
  Interface.setScore(true)
  const featureLayer = new sc_pb.SpatialCameraSetup()
  featureLayer.setWidth(24)
  featureLayer.setCropToPlayableArea(true)
  featureLayer.setAllowCheatingLayers(true)
  let resolution = new sc_pb.Size2DI()
  resolution.setX(84)
  resolution.setY(84)
  featureLayer.setResolution(resolution)
  let minimapResolution = new sc_pb.Size2DI()
  minimapResolution.setX(64)
  minimapResolution.setY(64)
  featureLayer.setMinimapResolution(minimapResolution)
  Interface.setFeatureLayer(featureLayer)
  const render = new sc_pb.SpatialCameraSetup()
  resolution = new sc_pb.Size2DI()
  resolution.setX(256)
  resolution.setY(256)
  render.setResolution(resolution)
  minimapResolution = new sc_pb.Size2DI()
  minimapResolution.setX(128)
  minimapResolution.setY(128)
  render.setMinimapResolution(minimapResolution)
  Interface.setRender(render)

  function or_zeros(layer, size) {
    if (layer !== null) {
      return layer
    }
    return np.zeros([size.y, size.x], 'int32')
  }

  const run_config = run_configs.get()
  const port = (await portspicker.pick_unused_ports(1))[0]
  const sc_process = await run_config.start({ want_rgb: false, port, passedSw: stopwatch.sw })
  const controller = sc_process._controller
  testState._sc2_procs = [sc_process]
  testState._controllers = [controller]

  const map_inst = maps.get('Simple64')

  const create = new sc_pb.RequestCreateGame()
  const localMap = new sc_pb.LocalMap()
  localMap.setMapPath(map_inst.path)
  localMap.setMapData(map_inst.data(run_config))
  create.setLocalMap(localMap)
  create.setRealtime(false)
  create.setDisableFog(false)
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
  join.setOptions(Interface)

  await controller.create_game(create)
  await controller.join_game(join)

  const game_info = await controller.game_info()

  assert(
    Interface.getRaw() === game_info.getOptions().getRaw(),
    'Interface.getRaw() === game_info.getOptions().getRaw()'
  )

  function objectEq(a, b, strict = false, verbose = false) {
    if (verbose) {
      console.log('a: ', a.toObject())
      console.log('b: ', b.toObject())
    }
    const termA = a.toString()
    const termB = b.toString()
    if (!strict) {
      const [big, small] = termA.length > termB.length ? [termA, termB] : [termB, termA]
      if (verbose) {
        console.log('string compare:\n', small, '\n', big.slice(0, small.length))
      }
      return small === big.slice(0, small.length)
    }
    return termA === termB
  }

  try {
    // Can fail if rendering is disabled.
    assert(
      objectEq(Interface.getFeatureLayer(), game_info.getOptions().getFeatureLayer(), true),
      `Interface.getFeatureLayer().toObject() === game_info.getOptions().getFeatureLayer()
      got:
      ${Interface.getFeatureLayer()}
      expected:
      ${game_info.getOptions().getFeatureLayer()}
      `
    )
    assert(
      objectEq(Interface.getRender(), game_info.getOptions().getRender(), true),
      `Interface.getRender() === game_info.getOptions().getRender()
      got:
      ${Interface.getRender()}
      expected:
      ${game_info.getOptions().getRender()}
      `
    )
  } catch (err) {
    await controller.quit()
    await sc_process.close()
    throw err
  }

  const tasks = []
  for (let i = 0; i < 50; i++) {
    tasks.push(async () => { //eslint-disable-line
      await controller.step(8)
      const observation = await controller.observe()
      const obs = observation.getObservation()
      const rgb_screen = features.Feature.unpack_rgb_image(
        obs.getRenderData().getMap()
      )
      const rgb_minimap = features.Feature.unpack_rgb_image(
        obs.getRenderData().getMinimap()
      )

      const fl_screen = np.stack(features.SCREEN_FEATURES.map((f) => or_zeros(
        f.unpack(obs),
        Interface.getFeatureLayer().getResolution()
      )))

      const fl_minimap = np.stack(features.MINIMAP_FEATURES.map((f) => or_zeros(
        f.unpack(obs),
        Interface.getFeatureLayer().getMinimapResolution()
      )))

      // Right shapes.
      assert(
        arrayCompare(rgb_screen.shape, [256, 256, 3]),
        'rgb_screen.shape === [256, 256, 3]'
      )
      assert(
        arrayCompare(rgb_minimap.shape, [128, 128, 3]),
        'arrayCompare(rgb_minimap.shape === [128, 128, 3]'
      )

      assert(
        arrayCompare(
          fl_screen.shape,
          [features.SCREEN_FEATURES.length, 84, 84]
        ),
        'fl_screen.shape === [features.SCREEN_FEATURES.length, 84, 84]'
      )

      assert(
        arrayCompare(
          fl_minimap.shape,
          [features.MINIMAP_FEATURES.length, 64, 64]
        ),
        'fl_minimap.shape === [features.MINIMAP_FEATURES.length, 64, 64]'
      )

      // Not all black.
      assert(np.any(rgb_screen), 'any(rgb_screen)')
      assert(np.any(rgb_minimap), 'any(rgb_minimap)')
      assert(np.any(fl_screen), 'any(fl_screen)')
      assert(np.any(fl_minimap), 'any(fl_minimap)')
    })
  }

  try {
    await sequentialTaskQueue(tasks)
  } catch (err) {
    await controller.quit()
    await sc_process.close()
    throw err
  }

  await controller.quit()
  await sc_process.close()

  testState.tearDown()
}

testRender()
