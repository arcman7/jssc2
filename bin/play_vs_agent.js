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
const pythonUtils = require(path.resovle(__dirname, '..', 'lib','pythonUtils.js'))
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

function human() {
  // Run a host which expects one player to connect remotely.
  const run_config = run_configs.get()
  const map_inst = maps.get(flags.get('map'))

  if (!flags.get('rgb_screen_size') || ! flags.get('rgb_minimap_size')) {
    console.info('Use --rgb_screen_size and --rgb_minimap_size if you want rgb obervations.')
  }

  const ports = []
  for (let p = 0; p < 5; p += 1) {
    ports.push(flags.get('config_port') + p)
  }
  if (!) {
    
  }

}

function main() {
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
