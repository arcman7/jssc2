// Run SC2 to play a game or a replay.
const path = require('path')
const flags = require('flags')
const os = require('os')
const fs = require('fs')
const s2clientprotocol = require('s2clientprotocol')
const { performance } = require('perf_hooks')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const renderer_human = require(path.resolve(__dirname, '..', 'lib', 'renderer_human', 'backend.js'))
const replay = require(path.resolve(__dirname, '..', 'lib', 'replay.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const sc_pb = s2clientprotocol.sc2api_pb

flags.defineBoolean('render', true, 'Whether to render with pygame.')
flags.defineBoolean('realtime', false, 'Whether to run in realtime mode.')
flags.defineBoolean('full_screen', false, 'Whether to run full screen.')

flags.defineNumber('fps', 22.4, 'Frames per second to run the game.')
flags.defineInteger('step_mul', 1, 'Game steps per observation.')
flags.defineBoolean('render_sync', false, 'Turn on sync rendering.')
point_flag.DEFINE_point('feature_screen_size', '84', 'Resolution for screen feature layers.')
point_flag.DEFINE_point('feature_minimap_size', '64', 'Resolution for minimap feature layers.')
flags.defineInteger('feature_camera_width', 24, 'Width of the feature layer camera.')
point_flag.DEFINE_point('rgb_screen_size', '256,192', 'Resolution for rendered screen.')
point_flag.DEFINE_point('rgb_minimap_size', '128', 'Resolution for rendered minimap.')
point_flag.DEFINE_point('window_size', '640,480', 'Screen size if not full screen.')
flags.defineString('video', null, 'Path to render a video of observations.')

flags.defineInteger('max_game_steps', 0, 'Total game steps to run.')
flags.defineInteger('max_episode_steps', 0, 'Total game steps per episode.')

flags.defineString('user_name', os.userInfo().username, 'Name of the human player for replays.')
flags.defineString('user_race', 'random', `User's race. Choices:\n${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`user_race must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.defineString('bot_race', 'random', `AI race. Choises:\n${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`bot_race must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.defineString('difficulty', 'very_easy', `Bot's strength. Choises:\n${sc2_env.Difficulty.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Difficulty.member_names_.includes(input)) {
    throw new Error(`Bot's difficulty must be one of:\n${sc2_env.Difficulty.member_names_.join(' ')}`)
  }
})
flags.defineString('bot_build', 'random', `Bot's build strategy. Choices:\n${sc2_env.BotBuild.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.BotBuild.member_names_.includes(input)) {
    throw new Error(`Bot's build strategy must be one of:\n${sc2_env.BotBuild.member_names_.join(' ')}`)
  }
})
flags.defineBoolean('disable_fog', false, 'Disable fog of war.')
flags.defineInteger('observed_player', 1, 'Which player to observe.')

flags.defineBoolean('profile', false, 'Whether to turn on code profiling.')
flags.defineBoolean('trace', false, 'Whether to trace the code execution.')

flags.defineBoolean('save_replay', true, 'Whether to save a replay at the end.')

flags.defineString('map', null, 'Name of a map to use to play.')
flags.defineBoolean('battle_net_map', false, 'Use the battle.net map version.')

flags.defineString('map_path', null, 'Override the map for this replay.')
flags.defineString('replay', null, 'Name of a replay to show.')

async function main() {
  // Run SC2 to play a game or a replay.
  if (flags.get('trace')) {
    stopwatch.sw.trace()
  } else if (flags.get('profile')) {
    stopwatch.sw.enable()
  }

  if ((flags.get('map') && flags.get('replay')) || (!flags.get('map') && !flags.get('replay'))) {
    process.on('exit', () => {
      console.log('Must supply either a map or replay.')
    })
  }

  if (flags.get('replay') && !flags.get('replay').toLowerCase().endsWith('sc2replay')) {
    process.on('exit', () => {
      console.log('Replay must end in .SC2Replay.')
    })
  }

  if (flags.get('realtime') && flags.get('replay')) {
    process.on('exit', () => {
      console.log(`realtime isn't possible for replays yet.`)
    })
  }

  if (flags.get('render') && (flags.get('realtime') || flags.get('full_screen'))) {
    process.on('exit', () => {
      console.log('disable pygame rendering if you want realime or full_screen.')
    })
  }

  if (process.platform == 'linux' && (flags.get('realtime') || flags.get('full_screen'))) {
    process.on('exit', () => {
      console.log('realtime and full_screen only makes sense on Windows/MacOS.')
    })
  }

  if (!flags.get('render') && flags.get('render_sync')) {
    process.on('exit', () => {
      console.log('render_sync only makes sense with pygame rendering on.')
    })
  }

  let run_config = run_configs.get()
  const interfacee = new sc_pb.InterfaceOptions()
  interfacee.setRaw(flags.get('render'))
  interfacee.setRawAffectsSelection(true)
  interfacee.setRawCropToPlayableArea(true)
  interfacee.setScore(true)
  interfacee.setShowCloaked(true)
  interfacee.setShowBurrowedShadows(true)
  interfacee.setShowPlaceholders(true)
  if (flags.get('feature_screen_size') && flags.get('feature_minimap_size')) {
    const featurelayer = new sc_pb.SpatialCameraSetup()
    featurelayer.setWidth(flags.get('feature_camera_width'))
    interfacee.setFeatureLayer(featurelayer)
    flags.get('feature_screen_size').assign_to(interfacee.getFeatureLayer().getResolution())
    flags.get('feature_minimap_size').assign_to(interfacee.getFeatureLayer().getMinimapResolution())
    featurelayer.setCropToPlayableArea(true)
    featurelayer.setAllowCheatingLayers(true)
    interfacee.setFeatureLayer(featurelayer)
  }

  if (flags.get('render') && flags.get('rgb_screen_size') && flags.get('rgb_minimap_size')) {
    const render = new sc_pb.SpatialCameraSetup()
    interfacee.setRender(render)
    flags.get('rgb_screen_size').assign_to(interfacee.getRender().getResolution())
    flags.get('rgb_minimap_size').assign_to(interfacee.getRender().getMinimapResolution())
  }

  let max_episode_steps = flags.get('max_episode_steps')

  if (flags.get('map')) {
    const create = new sc_pb.RequestCreateGame()
    create.setRealtime(flags.get('realtime'))
    create.setDisableFog(flags.get('disable_fog'))
    try { 
      var success = true
      try {
        const map_inst = maps.get(flags.get('map'))
      } catch (err) {
        success = false
        if (flags.get('battle_net_map')) {
          create.setBattlenetMapName(flags.get('map'))
        } else {
          console.Error(err)
        }
      }
      if (success) {
        if (map_inst.game_steps_per_episode) {
          max_episode_steps = map_inst.game_steps_per_episode
        }
        if (flags.get('battle_net_map')) {
          create.setLocalMap(map_inst.battle_net)
        } else {
          const localmap = new sc_pb.LocalMap()
          localmap.setMapPath(map_inst.path)
          localmap.setMapData(map_inst.data(run_config))
          create.setLocalMap(localmap)        
        }
      }
    } 

    let playersetup = new sc_pb.PlayerSetup()
    playersetup.setType(sc_pb.PlayerType.PARTICIPANT)
    create.addPlayerSetup(playersetup)
    
    playersetup.setType(sc_pb.PlayerType.COMPUTER)
    playersetup.setRace(sc2_env.Race[flags.get('bot_race')])
    playersetup.setDifficulty(sc2_env.Difficulty[flags.get('difficulty')])
    playersetup.setAiBuild(sc2_env.BotBuild[flags.get('bot_build')])
    create.addPlayerSetup(playersetup)

    const join = new sc_pb.RequestJoinGame()
    join.setOptions(interfacee)
    join.setRace(sc2_env.Race[flags.get('user_race')])
    join.setPlayerName(flags.get('user_name'))
    const version = null
  } else {
    const replay_data = run_config.replay_data(flags.get('replay'))
    const start_replay = new sc_pb.RequestStartReplay()
    start_replay.setReplayData(replaydata)
    start_replay.setOptions(interfacee)
    start_replay.setDisableFog(flags.get('disable_fog'))
    start_replay.setObservedPlayerId(flags.get('observed_player'))
    const version = replay.get_replay_version(replay_data)
    run_config = run_configs.get(version)
  }

  const port = (await portspicker.pick_unused_ports(1))[0]
  const sc_process = await run_config.start({
    full_screen: flags.get('full_screen'),
    window_size: flags.get('window_size'),
    want_rgb: interfacee.hasRender(),
    port
  })
  const controller = sc_process._controller
  if (flags.get('map')) {
    await controller.create_game(create)
    await controller.join_game(join)
  } else {
    const info = await controller.replay_info(replay_data)
    console.log(' replay info '.center(60, '_'))
    console.log(info)
    console.log('-'.repeat(60))
    const map_path = flags.get('map_path') || info.local_map_path
    if (map_path) {
      start_replay.map_path = run_config.map_data(map_path, info.player_info.length)
    }
    await controller.start_replay(start_replay) 
  }

  if (flags.get('render')) {
    const renderer = new renderer_human.InitializeServices()
    renderer.setUp(run_config, controller)
    const wss = new renderer_human.WsServer({port})
    const gameloop = new renderer_human.GameLoop(run_config, controller, wss)
    await gameloop.run({
      run_config: run_config,
      controller: controller,
      max_game_steps: flags.get('max_game_steps'),
      game_steps_per_episode: max_episode_steps,
      save_replay: flags.get('save_replay')
    })

  } else {
    try {
      while (true) {
        const frame_start_time = performance.now() / 1000
        if (!flags.get('realtime')) {
          await controller.step(flags.get('step_mul'))
        }
        const obs = await controller.observer()

        if (obs.player_result) {
          break
        }
        const sleeptime = Math.max(0, frame_start_time + 1 / flags.get('fps') - performance.now() / 1000)
        await new Promise((r) => setTimeout(r, sleeptime))
      }
    } catch (err) {
      console.error(err)
    }
    console.log('Score: ', obs.observation.score.score)
    console.log('Result: ', obs.player_result)
    if (flags.get('map') && flags.get('save_replay')) {
      const replay_save_loc = await run_config.save_replay(controller.save_replay(), 'local', flags.get('map'))
      console.log('Replay saved to: ', replay_save_loc)

      // python 
      // with open(replay_save_loc.replace("SC2Replay", "txt"), "w") as f:
      //     f.write("{}\n".format(obs.observation.score.score))
      // Save scores so we know how the human player did.
      fs.writeFileSync(`{obs.observation.score.score}\n` ,flags.get('map'))
    }
  }

  if (flags.get('profile')) {
    console.log(stopwatch.sw)
  }
}

flags.defineBool('m', false, 'treat file as module')
flags.parse()
if (flags.get('m')) {
  module.exports = {
    main,
  }
} else {
  main()
}