// Benchmark observation times.
const path = require('path')
const flags = require('flags')
const s2clientprotocol = require('s2clientprotocol')
const { performance } = require('perf_hooks')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const replay = require(path.resolve(__dirname, '..', 'lib', 'replay.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { isinstance } = pythonUtils
const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

flags.defineInteger("count", 1000, "How many observations to run.")
flags.defineInteger("step_mul", 16, "How many game steps per observation.")
flags.defineString("replay", null, "Which replay to run.")
flags.defineString("map", "Catalyst", "Which map to run.")

function interface_options({ score = false, raw = false, features = null, rgb = null, crop = true }) {
  // Get an InterfaceOptions for the config.
  const interfacee = new sc_pb.InterfaceOptions()
  interfacee.setScore(score)
  interfacee.setRaw(raw)
  const featurelayer = new sc_pb.SpatialCameraSetup()
  const ft_resolution = new sc_common.Size2DI()
  const ft_minimapresolution = new sc_common.Size2DI()
  let screen
  let minimap
  if (features) {
    if (isinstance(features, Number)) {
      screen = features
      minimap = features
    } else {
      screen = features[0]
      minimap = features[1]
    }
    ft_resolution.setX(screen)
    ft_resolution.setY(screen)
    ft_minimapresolution.setX(minimap)
    ft_minimapresolution.setY(minimap)
    featurelayer.setWidth(24)
    featurelayer.setResolution(ft_resolution)
    featurelayer.setMinimapResolution(ft_minimapresolution)
    featurelayer.setCropToPlayableArea(crop)
    interfacee.setFeatureLayer(featurelayer)
  }
  const render = new sc_pb.SpatialCameraSetup()
  const ren_resolution = new sc_common.Size2DI()
  const ren_minimapresolution = new sc_common.Size2DI()
  if (rgb) {
    if (isinstance(rgb, Number)) {
      screen = rgb
      minimap = rgb
    } else {
      screen = rgb[0]
      minimap = rgb[1]
    }
    ren_resolution.setX(screen)
    ren_resolution.setY(screen)
    ren_minimapresolution.setX(minimap)
    ren_minimapresolution.setY(minimap)
    render.setResolution(ren_resolution)
    render.setMinimapResolution(ren_minimapresolution)
    interfacee.setRender(render)
  }
  return interfacee
}

const configs = [
  ['raw', interface_options({ raw: true })],
  ['raw-feat-48', interface_options({ raw: true, features: 48 })],
  ['raw-feat-128', interface_options({ raw: true, features: 128 })],
  ['raw-feat-128-48', interface_options({ raw: true, features: (128, 48) })],
  ['feat-32', interface_options({ features: 32 })],
  ['feat-48', interface_options({ features: 48 })],
  ['feat-72-no-crop', interface_options({ features: 72, crop: false })],
  ['feat-72', interface_options({ features: 72 })],
  ['feat-96', interface_options({ features: 96 })],
  ['feat-128', interface_options({ features: 128 })],
  ['rgb-64', interface_options({ rgb: 64 })],
  ['rgb-128', interface_options({ rgb: 128 })],
]

async function main() {
  stopwatch.sw.enable()
  const results = []
  try {
    for (let i = 0; i < configs.length; i += 1) {
      const config = configs[i][0]
      const interfacee = configs[i][1]
      console.log(` Starting: ${config}`.center(60, '-'))
      const timeline = []

      let run_config = run_configs.get()

      if (flags.get('replay')) {
        const replay_data = run_config.replay_data(flags.get('replay'))
        const start_replay = new sc_pb.RequestStartReplay()
        start_replay.setRepplayData(replay_data)
        start_replay.setOptions(interfacee)
        start_replay.setDisableFog(false)
        start_replay.setObservedPlayerId(2)
        const version = replay.get_replay_version(replay_data)
        run_config = run_configs.get(version)
      } else {
        const map_inst = maps.get(flags.get('map'))
        const create = new sc_pb.RequestCreateGame()
        create.setRealtime(false)
        create.setDisableFog(false)
        create.setRandomSeed(1)
        const localmap = new sc_pb.LocalMap()
        localmap.setMapPath(map_inst.path)
        localmap.setMapData(map_inst.data(run_config))
        create.setLocalMap(localmap)
        const p_playersetup = new sc_pb.PlayerSetup()
        p_playersetup.setType(sc_pb.PlayerType.PARTICIPANT)
        create.addPlayerSetup(p_playersetup)
        const c_playersetup = new sc_pb.PlayerSetup()
        c_playersetup.setType(sc_pb.PlayerType.COMPUTER)
        c_playersetup.setRace(sc_common.Race.TERRAN)
        c_playersetup.setDifficulty(sc_pb.Difficulty.VERYEASY)
        create.addPlayerSetup(c_playersetup)
        const join = new sc_pb.RequestJoinGame()
        join.setOptions(interfacee)
        join.setRace(sc_common.Race.PROTOSS)
      }

      const sc_process = await run_config.start({ want_rgb: interfacee.hasRender() })
      const controller = sc_process._controller
      if (flags.get('replay')) {
        const info = controller.replay_info(replay_data)
        console.log(' Replay info '.center(60, '-'))
        console.log(info)
        console.log('-'.repeat(60))
        if (info.local_map_path) {
          start_replay.setMapData(run_config.map_data(info.local_map_path))
        }
        await controller.start_replay(start_replay)
      } else {
        await controller.create_game(create)
        await controller.join_game(join)
      }

      for (let _ = 0; _ < flags.get('count'); _ += 1) {
        await controller.step(flags.get('step_mul'))
        const start = performance.now() / 1000
        const obs = await controller.observe()
        timeline.push((performance.now() / 1000) - start)
        if (obs.player_result) {
          break
        }
      }
      results.push([config, timeline])
    }
  } catch (err) {
    console.Error(err)
  }
  //python note
  // zip(*iterator) => unzip

  const names = []
  const values = []
  results.map(([n, v]) => { //eslint-disable-line
    names.push(n)
    values.push(v)
  })

  console.log('\n\nTimeline:\n')
  console.log(names.join(','))
  for (let i = 0; i < values.length; i += 1) {
    console.log(values[i].map((v) => (v * 1000).toFixed(2)).join(','))
  }
  console.log(stopwatch.sw)
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
