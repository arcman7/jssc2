// Run an agent.
const path = require('path')
const flags = require('flags')
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const available_actions_printer = require(path.resolve(__dirname, '..', 'env', 'available_actions_printer.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { withPythonAsync } =pythonUtils

// this needs to be done
// from absl import app


flags.defineBoolean('render', true, 'Whether to render with browser.')
point_flag.DEFINE_point('feature_screen_size', '84',
                        'Resolution for screen feature layers.')
point_flag.DEFINE_point('feature_minimap_size', '64',
                        'Resolution for minimap feature layers.')
point_flag.DEFINE_point('rgb_screen_size', null,
                        'Resolution for rendered screen.')
point_flag.DEFINE_point('rgb_minimap_size', null,
                        'Resolution for rendered minimap.')
flags.defineStringList('action_space', null, sc2_env.ActionSpace.member_names_, 'Which action space to use. Needed if you take both feature and rgb observations.')
flags.defineBoolean('use_feature_units', false,
                  'Whether to include feature units.')
flags.defineBoolean('use_raw_units', false,
                  'Whether to include raw units.')
flags.defineBoolean('disable_fog', false, 'Whether to disable Fog of War.')

flags.defineInteger('max_agent_steps', 0, 'Total agent steps.')
flags.defineInteger('game_steps_per_episode', null, 'Game steps per episode.')
flags.defineInteger('max_episodes', 0, 'Total episodes.')
flags.defineInteger('step_mul', 8, 'Game steps per agent step.')

flags.defineString('agent', 'pysc2.agents.random_agent.RandomAgent',
                    'Which agent to run, as a python path to an Agent class.')
flags.defineString('agent_name', null,
                    'Name of the agent in replays. Defaults to the class name.')
flags.defineStringList('agent_race', 'random', sc2_env.Race.member_names_, 'Agent 1\'s race.')

flags.defineString('agent2', 'Bot', 'Second agent, either Bot or agent class.')
flags.defineString('agent2_name', null,
                    'Name of the agent in replays. Defaults to the class name.')
flags.defineStringList('agent2_race', 'random', sc2_env.Race.member_names_, 'Agent 2\'s race.')
flags.defineStringList('difficulty', 'very_easy', sc2_env.Difficulty.member_names_, 'If agent2 is a built-in Bot, it\'s strength.')
flags.defineStringList('bot_build', 'random', sc2_env.BotBuild.member_names_, 'Bot\'s build strategy.')

flags.defineBoolean('profile', false, 'Whether to turn on code profiling.')
flags.defineBoolean('trace', false, 'Whether to trace the code execution.')
flags.defineInteger('parallel', 1, 'How many instances to run in parallel.')

flags.defineBoolean('save_replay', true, 'Whether to save a replay at the end.')

flags.defineString('map', null, 'Name of a map to use.')
flags.defineBoolean('battle_net_map', false, 'Use the battle.net map version.')

// this needs to be done
//flags.mark_flag_as_required('map')  



function run_thread(agent_classes, players, map_name, visualize) {
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
    agent_classes.forEach((agent_cls) => {
      agents.push(agent_cls())
    })
    run_loop.run_loop(agents, env, flags.get('max_agent_steps'), flags.get('max_episodes'))
    if (flags.get('save_replay')) {
      env.save_replay(agent_classes[0].name)
    }
  })
}

function main(unused_argv) {
  // Run an agent.
  if (flags.)
}