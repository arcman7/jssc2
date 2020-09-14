const path = require('path')
const flags = require('flags')
// const { fork } = require('child_process')
const { ThreadWrapper } = require(path.resolve(__dirname, 'thread_wrapper.js'))
const agents = require(path.resolve(__dirname, '..', 'agents'))
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const available_actions_printer = require(path.resolve(__dirname, '..', 'env', 'available_actions_printer.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point = require(path.resolve(__dirname, '..', 'lib', 'point.js'))
// const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { withPythonAsync } = pythonUtils

// Run an agent.

flags.defineBoolean('render', true, 'heter to render with pygame.')
flags.defineStringList('feature_screen_size', '84', 'Resolution for screen feature layers.')
// point_flag.DEFINE_point("feature_screen_size", "84", "Resolution for screen feature layers.")
flags.defineStringList('feature_minimap_size', '64', 'Resolution for minimap feature layers.')
// point_flag.DEFINE_point('feature_minimap_size', '64', 'Resolution for minimap feature layers.')
flags.defineStringList('rgb_screen_size', null, 'Resolution for rendered screen.')
// point_flag.DEFINE_point('rgb_screen_size', null, 'Resolution for rendered screen.')
flags.defineStringList('rgb_minimap_size', null, 'Resolution for rendered minimap.')
// point_flag.DEFINE_point('rgb_minimap_size', null, 'Resolution for rendered minimap.')
flags.defineString('action_space', null, `Which action space to use. Needed if you take both feature and rgb observations. Choices:\n${sc2_env.ActionSpace.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input) && input !== null) {
    throw new Error(`action_space must be one of:\n${sc2_env.ActionSpace.member_names_.join(' ')}`)
  }
})

flags.defineBoolean('use_feature_units', false, 'Whether to include feature units.')
flags.defineBoolean('use_raw_units', false, 'Whether to include raw units.')
flags.defineBoolean('disable_fog', false, 'Whether to disable Fog of War.')
flags.defineInteger('max_agent_steps', 0, 'Total agent steps.')
flags.defineInteger('game_steps_per_episode', null, 'Game steps per episode.')
flags.defineInteger('max_episodes', 0, 'Total episodes.')
flags.defineInteger('step_mul', 8, 'Game steps per agent step.')
flags.defineString('agent', 'jssc2.agents.random_agent.RandomAgent', 'Which agent to run, as a python path to an Agent class.')
flags.defineString('agent_name', null, 'Name of the agent in replays. Defaults to the class name.')
flags.defineString('agent_race', 'random', `Agent 1's race. Choices:\n ${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`agent_race must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.defineString('agent2', 'Bot', 'Second agent, either Bot or agent class.')
flags.defineString('agent2_name', null, 'Name of the agent in replays. Defaults to the class name.')
flags.defineString('agent2_race', 'random', `Agent 2's race. Choices:\n${sc2_env.Race.member_names_.join(' ')}`)
flags.defineString('difficulty', 'very_easy', `If agent2 is a built-in Bot, it's strength. Choices:\n ${sc2_env.Difficulty.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`difficulty must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.defineString('bot_build', 'random', `${sc2_env.BotBuild.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`bot_build must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.defineBoolean('profile', false, 'Whether to turn on code profiling.')
flags.defineBoolean('trace', false, 'Whether to trace the code execution.')
flags.defineInteger('parallel', 1, 'How many instances to run in parallel.')

flags.defineBoolean('save_replay', true, 'Whether to save a replay at the end.')

flags.defineString('map', null, 'Name of a map to use.').setValidator((input) => {
  if (input === null) {
    throw new Error(`A map is required.`)
  }
})
flags.defineBoolean('battle_net_map', false, 'Use the battle.net map version.')

function getAllAgentFlags() {
  return {
    render: flags.get('render'),
    feature_screen_size: flags.get('feature_screen_size'),
    feature_minimap_size: flags.get('feature_minimap_size'),
    rgb_screen_size: flags.get('rgb_screen_size'),
    rgb_minimap_size: flags.get('rgb_minimap_size'),
    action_space: flags.get('action_space'),
    use_feature_units: flags.get('use_feature_units'),
    use_raw_units: flags.get('use_raw_units'),
    disable_fog: flags.get('disable_fog'),
    max_agent_steps: flags.get('max_agent_steps'),
    game_steps_per_episodes: flags.get('game_steps_per_episode'),
    max_episodes: flags.get('max_episodes'),
    step_mul: flags.get('step_mul'),
    agent: flags.get('agent'),
    agent_name: flags.get('agent_name'),
    agent_race: flags.get('agent_race'),
    agent2: flags.get('agent2'),
    agent2_name: flags.get('agent2_name'),
    agent2_race: flags.get('agent2_race'),
    difficulty: flags.get('difficulty'),
    bot_build: flags.get('bot_build'),
    profile: flags.get('profile'),
    trace: flags.get('trace'),
    parallel: flags.get('parallel'),
    save_replay: flags.get('save_replay'),
    map: flags.get('map'),
    battle_net_map: flags.get('battle_net_map'),
  }
}

// method is duplicated in agent_run_thread.js
async function run_thread(agent_classes, players, map_name, visualize) {
  // Run one thread worth of the environment with agents.
  const kwargs = {
    map_name,
    battle_net_map: flags.get('battle_net_map'),
    players: players,
    agent_interface_format: sc2_env.parse_agent_interface_format({
      feature_screen: flags.get('feature_screen_size')
        .map((str) => new point.Point(Number(str))),
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
    const usedAgents = []
    agent_classes.forEach((Agent_cls) => {
      usedAgents.push(new Agent_cls())
    })
    await run_loop.run_loop(usedAgents, env, flags.get('max_agent_steps'), flags.get('max_episodes'))
    if (flags.get('save_replay')) {
      await env.save_replay(agent_classes[0].name)
    }
  })
}

async function main() {
  flags.parse()
  // Run an agent.
  if (flags.get('trace')) {
    stopwatch.sw.trace()
  } else if (flags.get('profile')) {
    stopwatch.sw.enable()
  }
  // duplicated code (agent_run_thread.js) - start
  const map_inst = maps.get(flags.get('map'))

  const agent_classes = []
  const players = []

  let temp = flags.get('agent').split('.')
  // default string value 'jssc2.agents.random_agent.RandomAgent'
  let agent_name = temp.pop()
  let agent_module = temp.pop()
  let agent_cls = agents[agent_module][agent_name]
  agent_classes.push(agent_cls)
  players.push(new sc2_env.Agent(sc2_env.Race[flags.get('agent_race')], flags.get('agent_name') || agent_name))

  if (map_inst.players >= 2) {
    if (flags.get('agent2') === 'Bot') {
      players.push(new sc2_env.Bot(
        sc2_env.Race[flags.get('agent2_race')],
        sc2_env.Difficulty[flags.get('difficulty')],
        sc2_env.BotBuild[flags.get('bot_build')]
      ))
    }
  } else {
    temp = flags.get('agent2').split('.')
    agent_name = temp.pop()
    agent_module = temp.pop()
    agent_cls = agents[agent_module][agent_name]
    players.push(sc2_env.Agent(
      sc2_env.Race[flags.get('agent2_race')],
      flags.get('agent2_name') || agent_name
    ))
  }

  // duplicated code - end

  const threads = []
  for (let _ = 0; _ < flags.get('parallel') - 1; _++) {
    const thread = new ThreadWrapper('agent_run_thread.js')
    await thread.ready()
    await thread.start(getAllAgentFlags())
    threads.push(thread)
  }

  await run_thread(agent_classes, players, flags.get('map'), flags.get('render'))
  if (flags.get('profile')) {
    console.log(stopwatch.sw.toString())
  }
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
