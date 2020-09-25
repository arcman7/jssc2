/*
Play an agent with an SC2 instance that isn't owned.

This can be used to play on the sc2ai.net ladder, as well as to play vs humans.

To play on ladder:
  $ python -m pysc2.bin.agent_remote --agent <import path> \
      --host_port <GamePort> --lan_port <StartPort>

To play vs humans:
  $ python -m pysc2.bin.agent_remote --human --map <MapName>
then copy the string it generates which is something similar to above

If you want to play remotely, you'll need to port forward (eg with ssh -L or -R)
the host_port from localhost on one machine to localhost on the other.

You can also set your race, observation options, etc by cmdline flags.

When playing vs humans it launches both instances on the human side. This means
you only need to port-forward a single port (ie the websocket betwen SC2 and the
agent), but you also need to transfer the entire observation, which is much
bigger than the actions transferred over the lan connection between the two SC2
instances. It also makes it easy to maintain version compatibility since they
are the same binary. Unfortunately it means higher cpu usage where the human is
playing, which on a Mac becomes problematic as OSX slows down the instance
running in the background. There can also be observation differences between
Mac/Win and Linux. For these reasons, prefer play_vs_agent which runs the
instance next to the agent, and tunnels the lan actions instead.
*/

const path = require('path')
const flags = require('flags')
const s2clientprotocol = require('s2clientprotocol')

const { performance } = require('perf_hooks')
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const remote_sc2_env = require(path.resolve(__dirname, '..', 'env', 'remote_sc2_env.js'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const renderer_human = require(path.resolve(__dirname, '..', 'lib', 'renderer_human.ja'))
const sc_pb = s2clientprotocol.sc2api_pb

flags.defineBoolean("render", process.platform == "linux", "Whether to render with pygame.")
flags.defineBoolean("realtime", false, "Whether to run in realtime mode.")
flags.defineString("agent", "pysc2.agents.random_agent.RandomAgent", "Which agent to run, as a python path to an Agent class.")
flags.defineString("agent_name", null, "Name of the agent in replays. Defaults to the class name.")
flags.defindString("agent_race", "random", `Agent's race. Choices:\n ${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`agent_race must be one of:\n${sc2_env.Race.member_names_.join(' ')}`)
  }
})
flags.defindNumber("fps", 22.4, "Frames per second to run the game.")
flags.defineInteger("step_mul", 8, "Game steps per agent step.")

point_flag.DEFINE_point("feature_screen_size", "84", "Resolution for screen feature layers.")
point_flag.DEFINE_point("feature_minimap_size", "64", "Resolution for minimap feature layers.")
point_flag.DEFINE_point("rgb_screen_size", "256", "Resolution for rendered screen.")
point_flag.DEFINE_point("rgb_minimap_size", "128", "Resolution for rendered minimap.")

flags.defindString("action_space", "FEATURES", `Which action space to use. Needed if you take both feature and rgb observations. Choices:\n ${sc2_env.ActionSpace.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.ActionSpace.member_names_.includes(input) && input !== null) {
    throw new Error(`action_space must be one of:\n${sc2_env.ActionSpace.member_names_.join(' ')}`)
  }
})
flags.defineBoolean("use_feature_units", false, "Whether to include feature units.")

flags.defineString("user_name", os.userInfo(), "Name of the human player for replays.")
flags.defindString("user_race", "random", `User's race. Choices:\n ${sc2_env.Race.member_names_.join(' ')}`).setValidator((input) => {
  if (!sc2_env.Race.member_names_.includes(input)) {
    throw new Error(`user_race must be one of:\n${sc2_env.Race.member_names_}`)
  }
})
flags.defineString("host", "127.0.0.1", "Game Host")
flags.defineInteger("host_port", null, "Host port")
flags.defineInteger("lan_port", null, "Host port")
flags.defineString("map", null, "Name of a map to use to play.")
flags.defineBoolean("human", false, "Whether to host a game as a human.")
flags.defineInteger("timeout_seconds", 300, "Time in seconds for the remote agent to connect to the game before an exception is raised.")


async function agent() {
  // Run the agent, connecting to a (remote) host started independently.
  const agent_list = flags.get('agent').split('.')
  const agent_name = agent_list.pop()
  const agent_module = agent_list.pop()
  const agent_cls = 
}

async function human() {

}

async function main() {
  if (flags.get('human')) {
    human()
  } else {
    agent()
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



