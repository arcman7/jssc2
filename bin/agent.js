const path = require('path') //eslint-disable-line
const flags = require('flags') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const available_actions_printer = require(path.resolve(__dirname, '..', 'env', 'available_actions_printer.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { withPythonAsync } = pythonUtils

// Run an agent.

flags.defineBool('render', true, 'heter to render with pygame.')
point_flag.DEFINE_point("feature_screen_size", "84", "Resolution for screen feature layers.")
point_flag.DEFINE_point("feature_minimap_size", "64", "Resolution for minimap feature layers.")
point_flag.DEFINE_point("rgb_screen_size", null, "Resolution for rendered screen.")
point_flag.DEFINE_point("rgb_minimap_size", null, "Resolution for rendered minimap.")
flags.defineString('action_space', null, `Which action space to use. Needed if you take both feature and rgb observations. Choices:\n${sc2_env.ActionSpace._member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race._member_names_.includes(input) && input !== null) {
    throw new Error(`action_spacee must be one of:\n${sc2_env.ActionSpace._member_names_.join(' ')}`)
  }
})

flags.defineBool("use_feature_units", false, "Whether to include feature units.")
flags.defineBool("use_raw_units", false, "Whether to include raw units.")
flags.defineBool("disable_fog", false, "Whether to disable Fog of War.")
flags.defineInteger('max_agent_steps', 0, 'Total agent steps.')
flags.defineInteger('game_steps_per_episode', null, 'Game steps per episode.')
flags.defineInteger('max_episodes', 0, 'Total episodes.')
flags.defineInteger('step_mul', 8, 'Game steps per agent step.')
flags.defineString('agent', 'pysc2.agents.random_agent.RandomAgent', 'Which agent to run, as a python path to an Agent class.')
flags.defineString('agent_name', null, 'Name of the agent in replays. Defaults to the class name.')
flags.defineString('agent_race', 'random', `Agent 1's race. Choices:\n ${sc2_env.Race._member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race._member_names_.includes(input)) {
    throw new Error(`agent_race must be one of:\n${sc2_env.Race._member_names_.join(' ')}`)
  }
})
flags.defineString('agent2', 'Bot', 'Second agent, either Bot or agent class.')
flags.defineString('agent2_name', null, 'Name of the agent in replays. Defaults to the class name.')
flags.defineString('agent2_race', 'random', `Agent 2's race. Choices:\n${sc2_env.Race._member_names_.join(' ')}`)
flags.defineString('difficulty', 'very_easy', `If agent2 is a built-in Bot, it's strength. Choices:\n ${sc2_env.Difficulty._member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race._member_names_.includes(input)) {
    throw new Error(`difficulty must be one of:\n${sc2_env.Race._member_names_.join(' ')}`)
  }
})
flags.defineString('bot_build', 'random', `${sc2_env.BotBuild._member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race._member_names_.includes(input)) {
    throw new Error(`bot_build must be one of:\n${sc2_env.Race._member_names_.join(' ')}`)
  }
})
flags.defineBool('profile', false, 'Whether to turn on code profiling.')
flags.defineBool('trace', false, 'Whether to trace the code execution.')
flags.defineInteger('parallel', 1, 'How many instances to run in parallel.')

flags.defineBool('save_replay', true, 'Whether to save a replay at the end.')

flags.defineString('map', null, 'Name of a map to use.').setValidator((input) => {
  if (input === null) {
    throw new Error(`A map is required.`)
  }
})
flags.defineBool('battle_net_map', false, 'Use the battle.net map version.')

async function run_thread(agent_classes, players, map_name, visualize) {
  // Run one thread worth of the environment with agents.
  const kwargs = {
    map_name: map_name,
    battle_net_map: flags.get('battle_net_map'),
    players: players,
    agent_interface_format: sc2_env.parse_agent_interface_format({
      feature_screen: flags.get('feature_screen_size'),
      feature_minimap: flags.get('feature_minimap_size'),
      rgb_screen: flags.get('rgb_screen_size'),
      rgb_minimap: flags.get('rgb_minimap_size'),
      action_space: flags.get('action_space'),
      use_feature_units: flags.get('use_feature_units'),
      use_raw_units: flags.get('use_raw_units'),
    }),
    step_mul: flags.get('step_mul'),
    game_steps_per_episode: flags.get('game_steps_per_episode'),
    disable_fog: flags.get('disable_fog'),
    visualize: visualize
  }
  await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
    env = available_actions_printer.AvailableActionsPrinter(env)
    const agents = []
    agent_classes.forEach((Agent_cls) => {
      agents.push(new Agent_cls())
    })
    await run_loop.run_loop(agents, env, flags.get('max_agent_steps'), flags.get('max_episodes'))
    if (flags.get('save_replay')) {
      await env.save_replay(agent_classes[0].name)
    }
  })
}

function main(unused_argv) {
  // Run an agent.
  if (flags.get('trace')) {
    stopwatch.sw.trace()
  } else if (flags.get('profile')) {
    stopwatch.sw.enable()
  }

  const map_inst = maps.get(flags.get('map'))

  const agent_classes = []
  const players = []

  // agent_module, agent_name = FLAGS.agent.rsplit(".", 1)
  // agent_cls = getattr(importlib.import_module(agent_module), agent_name)

  agent_classes.push(agent_cls)
  players.push(new sc2_env.Agent(sc2_env.Race[flags.get('agent2_race')], flags.get('agent_name') || agent_name))
}