const path = require('path')
// const flags = require('flags')

const agents = require(path.resolve(__dirname, '..', 'agents'))
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const available_actions_printer = require(path.resolve(__dirname, '..', 'env', 'available_actions_printer.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
// const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { withPythonAsync } = pythonUtils

// mock flags npm module to keep function signatures the same
const flags = {
  get: function(key) {
    return flags[key]
  },
  set: function(kwargs) {
    Object.keys(kwargs).forEach((key) => {
      flags[key] = kwargs[key]
    })
  }
}

// method is duplicated in bin/agent.js
async function run_thread({
  agent_classes,
  players,
  map_name,
  visualize,
}) {
  // Run one thread worth of the environment with agents.
  const kwargs = {
    map_name,
    battle_net_map: flags.get('battle_net_map'),
    players,
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
    visualize,
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

async function start() {
  if (flags.get('trace')) {
    stopwatch.sw.trace()
  } else if (flags.get('profile')) {
    stopwatch.sw.enable()
  }

  const map_inst = maps.get(flags.get('map'))
  const agent_classes = []
  const players = []
  // default string value "jssc2.agents.random_agent.RandomAgent"
  let temp = flags.get('agent').split('.')
  let agent_name = temp.pop()
  let agent_module = temp.pop()
  let agent_cls = agents[agent_module][agent_name]
  agent_classes.push(agent_cls)
  players.push(new sc2_env.Agent(sc2_env.Race[flags.get('agent_race')], flags.get('agent_name') || agent_name))

  if (map_inst.players >= 2) {
    if (flags.get('agent2') === 'Bot') {
      players.push(sc2_env.Bot(
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

  await run_thread(agent_classes, players, flags.get('map'), flags.get('render'))
  if (flags.get('profile')) {
    console.log(stopwatch.sw.toString())
  }
}

process.send('ready')
let startProm
function processMessage(msgStr) {
  const msg = JSON.parse(msgStr)
  const { message, data } = msg
  // all necessary routing follows:
  /** start **/
  if (message === 'start') {
    flags.set(data)
    startProm = start()
    process.send('started')
    startProm.then(() => {
      process.send('finished')
    })
  }
}
process.on('message', processMessage)
