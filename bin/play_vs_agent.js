/*
Play as a human against an agent by setting up a LAN game.

This needs to be called twice, once for the human, and once for the agent.

The human plays on the host. There you run it as:
$ python -m pysc2.bin.play_vs_agent --human --map <map> --remote <agent ip>

And on the machine the agent plays on:
$ python -m pysc2.bin.play_vs_agent --agent <import path>

The `--remote` arg is used to create an SSH tunnel to the remote agent's
machine, so can be dropped if it's running on the same machine.

SC2 is limited to only allow LAN games on localhost, so we need to forward the
ports between machines. SSH is used to do this with the `--remote` arg. If the
agent is on the same machine as the host, this arg can be dropped. SSH doesn't
forward UDP, so this also sets up a UDP proxy. As part of that it sets up a TCP
server that is also used as a settings server. Note that you won't have an
opportunity to give ssh a password, so you must use ssh keys for authentication.
*/
const path = require('path')
const s2clientprotocol = require('s2clientprotocol')
const flags = require('flags')
const os = require('os')
const fs = require('fs')
const { performance } = require('perf_hooks')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const lan_sc2_env = require(path.resolve(__dirname, '..', 'env', 'lan_sc2_env.js'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const renderer_human = require(path.resolve(__dirname, '..', 'lib', 'renderer_human', 'backend.js'))
const agents = require(path.resolve(__dirname, '..', 'agents'))
const pythonUtils = require(path.resovle(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const { withPythonAsync } = pythonUtils
const sc_pb = s2clientprotocol.sc2api_pb

flags.defineBoolean('render', os.platform() == 'linux', 'Whether to render with pygame.')
flags.defineBoolean('realtime', false, 'Whether to run in realtime mode.')

flags.defineString('agent', 'pysc2.agents.random_agent.RandomAgent', 'Which agent to run, as a python path to an Agent class.')
flags.defineString('agent_name', null, 'Name of the agent in replays. Defaults to the class name.')
flags.defineString('agent_race', 'random', `Agent's race. Choices:\n${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`agent_race must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.DEFINE_float('fps', 22.4, 'Frames per second to run the game.')
flags.defineInteger('step_mul', 8, 'Game steps per agent step.')

point_flag.DEFINE_point('feature_screen_size', '84', 'Resolution for screen feature layers.')
point_flag.DEFINE_point('feature_minimap_size', '64', 'Resolution for minimap feature layers.')
point_flag.DEFINE_point('rgb_screen_size', '256', 'Resolution for rendered screen.')
point_flag.DEFINE_point('rgb_minimap_size', '128', 'Resolution for rendered minimap.')
flags.defineString('action_space', 'FEATURES', `Which action space to use. Needed if you take both feature and rgb observations. Choices:\n${sc2_env.ActionSpace.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.ActionSpace.member_names_.includes(input)) {
    throw new Error(`action_space must be one of:\n${sc2_env.ActionSpace.member_names_.join(' ')}`)
  }
})
flags.defineBoolean('use_feature_units', false, 'Whether to include feature units.')
flags.defineString('user_name', os.userInfo().username, 'Name of the human player for replays.')
flags.defineString('user_race', 'random', `User's race. Choices:\n${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`user_race must be one of:\n${sc2_env.Race.member_names_}`)
  }
})
flags.defineString('host', '127.0.0.1', 'Game Host. Can be 127.0.0.1 or ::1')
flags.defineInteger('config_port', 14380, 'Where to set/find the config port. The host starts a tcp server to share the config with the client, and to proxy udp traffic if played over an ssh tunnel. This sets that port, and is also the start of the range of ports used for LAN play.')
flags.defineString('remote', null, 'Where to set up the ssh tunnels to the client.')
flags.defineString('map', null, 'Name of a map to use to play.')
flags.defineBoolean('human', false, 'Whether to host a game as a human.')

async function agent() {
  // Run the agent, connecting to a (remote) host started independently.
  const agent_list = flags.get('agent').split('.')
  const agent_name = agent_list.pop()
  const agent_module = agent_list.pop()
  const agent_cls = agents[agent_module][agent_name]

  console.log('Starting agent:')
  const kwargs = {
    host: flags.get('host'),
    config_port: flags.get('config_port'),
    race: sc2_env.Race[flags.get('agent_race')],
    step_mul: flags.get('step_mul'),
    realtime: flags.get('realtime'),
    agent_interface_format: sc2_env.parse_agent_interface_format({
      feature_screen: flags.get('feature_screen_size'),
      feature_minimap: flags.get('feature_minimap_size'),
      rgb_screen: flags.get('rgb_screen_size'),
      rgb_minimap: flags.get('rgb_minimap_size'),
      action_space: flags.get('action_space'),
      use_unit_counts: true,
      use_camera_position: true,
      show_cloaked: true,
      show_burrowed_shadows: true,
      show_placeholders: true,
      send_observation_proto: true,
      crop_to_playable_area: true,
      raw_crop_to_playable_area: true,
      allow_cheating_layers: true,
      add_cargo_to_units: true,
      use_feature_units: flags.get('use_feature_units')
    }),
    visualize: flags.get('render')
  }
  await withPythonAsync(lan_sc2_env.LanSC2EnvFactory(kwargs), async (env) => {
    const agentss = [new agent_cls()]
    console.info('Connected, starting run_loop.')
    try {
      await run_loop.run_loop(agentss, env)
    } catch (err) {
      console.error('restart Error', err)
    }
  })
  console.info('Done.')
}

async function human() {
  // Run a host which expects one player to connect remotely.
  const run_config = run_configs.get()
  const map_inst = maps.get(flags.get('map'))

  if (!flags.get('rgb_screen_size') || !flags.get('rgb_minimap_size')) {
    console.info('Use --rgb_screen_size and --rgb_minimap_size if you want rgb obervations.')
  }
  let ports = []
  for (let p = 0; p < 5; p += 1) {
    ports.push(flags.get('config_port') + p)
  }
  try {
    ports = await Promise.all(ports)
  } catch (err) {
    throw Error('Need 5 free ports after the config port.')
  }

  let proc = null
  let ssh_proc = null
  let tcp_conn = null
  let udp_sock = null
  try {
    proc = await run_config.start({
      extra_ports: ports.slice(1, ports.length),
      timeout_seconds: 300,
      host: flags.get('host'),
      window_loc: [50, 50]
    })
    const tcp_port = ports[0]
    const settings = {
      'remote': flags.get('remote'),
      'game_version': proc.version.game_version,
      'realtime': flags.get('realtime'),
      'map_name': map_inst.name,
      'map_path': map_inst.path,
      'map_data': map_inst.data(run_config),
      'ports': {
        'server': { 'game': ports[1], 'base': ports[2] },
        'client': { 'game': ports[3], 'base': ports[4] },
      }
    }
    const create = new sc_pb.RequestCreateGame()
    create.setRealtime(settings['realtime'])
    const localmap = new sc_pb.LocalMap()
    localmap.setMapPath(settings['map_path'])
    create.setLocalMap(localmap)
    const controller = proc.controller
    await controller.save_map(settings['map_path'], settings['map_data'])
    await controller.create_game(create)

    if (flags.get('remote')) {
      ssh_proc = lan_sc2_env.forward_ports(flags.get('remote'), proc.host, [settings['ports']['client']['base']], [settings['ports']]['server']['base'])
    }

    console.log('-'.repeat(80))
    console.log(`Join: play_vs_agent -- ${proc.host} --config_port ${tcp_port}`)
    console.log('-'.repeat(80))

    tcp_conn = lan_sc2_env.tcp_server(new lan_sc2_env.Addr(proc.host, tcp_port), settings)

    if (flags.get('remote')) {
      udp_sock = lan_sc2_env.udp_sever(new lan_sc2_env.Addr(proc.host, settings['ports']['client']['game']))
      // need to be fixed
      // lan_sc2_env.daemon_thread(lan_sc2_env.udp_to_tcp, (udp_sock, tcp_conn))
    }
    const join = new sc_pb.RequestJoinGame()
    join.setSharedPort(0)
    const portset = new sc_pb.PortSet()
    portset.setGamePort(settings['ports']['server']['game'])
    portset.setBasePort(settings['ports']['server']['base'])
    join.setServerPorts(portset)
    join.addClientPort(portset)
    join.setRace(sc2_env.Race[flags.get('user_race')])
    join.setPlayerName(flags.get('user_name'))

    if (flags.get('render')) {
      const interfaceoptions = new sc_pb.InterfaceOptions()
      interfaceoptions.setRaw(true)
      interfaceoptions.setScore(true)
      interfaceoptions.setRawAffectsSelection(true)
      interfaceoptions.setRawCropToPlayableArea(true)
      interfaceoptions.setShowBurrowedShadows(true)
      interfaceoptions.setShowCloaked(true)
      interfaceoptions.setShowPlaceholders(true)
      join.setOptions(interfaceoptions)
      if (flags.get('feature_screen_size') && flags.get('feature_minimap_size')) {
        const featurelayer = new sc_pb.SpatialCameraSetup()
        interfaceoptions.setFeatureLayer(featurelayer)
        join.setOptions(interfaceoptions)
        const fl = join.getOptions().getFeatureLayer()
        fl.setWidth(24)
        flags.get('feature_screen_size').assign_to(fl.getResolution())
        flags.get('feature_minimap_size').assign_to(fl.getMinimapResolution())
      }
      if (flags.get('rgb_screen_size') && flags.get('rgb_minimap_size')) {
        const render = new sc_pb.SpatialCameraSetup()
        interfaceoptions.setRender(render)
        join.setOptions(interfaceoptions)
        flags.get('rgb_screen_size').assign_to(join.getOptions().getRender().getResolution())
        flags.get('rgb_minimap_size').assign_to(join.getOptions().getRender().getMinimapResolution())
      }
    }
    await controller.join_game(join)

    if (flags.get('render')) {
      // renderer = renderer_human.RendererHuman(fps=FLAGS.fps, render_feature_grid=False)
      // renderer.run(run_configs.get(), controller, max_episodes=1)
      const renderer = new renderer_human.InitializeServices()
      renderer.setUp(run_config, controller)
      await renderer_human.GameLoop.run({
        run_config: run_configs.get(),
        controller: controller,
        max_episodes: 1
      })
    } else {
      while (true) {
        const frame_start_time = performance.now() / 1000
        if (!flags.get('realtime')) {
          await controller.step()
        }
        const obs = await controller.observe()

        if (obs.player_result) {
          break
        }
        const sleeptime = Math.max(0, frame_start_time - performance.now() / 1000 + 1 / flags.get('fps'))
        await new Promise((resolve) => setTimeout(resolve, sleeptime))
      }
    }
  } catch (err) {
    console.log(err)
  } finally {
    if (tcp_conn) {
      await tcp_conn.close()
    }
    if (proc) {
      await proc.close()
    }
    if (udp_sock) {
      await udp_sock.close()
    }
    if (ssh_proc) {
      await ssh_proc.terminate()
      for (let _ = 0; _ < 5; _ += 1) {
        if (ssh_proc.poll() !== null) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      if (ssh_proc.poll() !== null) {
        await ssh_proc.kill()
        await ssh_proc.wait()
      }
    }
  }
}

async function main() {
  if (flags.get('human')) {
    human()
  } else {
    agent()
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
