const path = require('path') //eslint-disable-line
const sc2clientprotocol = require('sc2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const sc2_env = require(path.resolve(__dirname, './sc2_env.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const remote_controller = require(path.resolve(__dirname, '..', 'lib', 'remote_controller.js'))
const run_parallel = require(path.resolve(__dirname, '..', 'lib', 'run_parallel.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { ValueError } = pythonUtils
const sc_pb = sc2clientprotocol.sc2api_pb

// A Starcraft II environment for playing using remote SC2 instances.

class RestartError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'RestartError'
  }
}

class RemoteSC2Env extends sc2_env.SC2Env {
  /*
  A Remote Starcraft II environment for playing vs other agents or humans.

  Unlike SC2Env, this doesn't actually start any instances and only connects
  to a remote instance.

  This assumes a 2 player game, and works best with play_vs_agent.py.
  */
  constructor({
    map_name = null,
    save_map = true,
    host = '127.0.0.1',
    host_port = null,
    lan_port = null,
    race = null,
    name = "<unknown>",
    agent_interface_format = null,
    discount = 1.0,
    visualize = false,
    step_mul = null,
    realtime = false,
    replay_dir = null,
    replay_prefix = null
  }, _only_use_kwargs = null) {
    /*
    Create a SC2 Env that connects to a remote instance of the game.

    This assumes that the game is already up and running, and that it only
    needs to join the game - and leave once the game has ended. You need some
    other script to launch the SC2 process and call RequestCreateGame. Note
    that you must call close to leave the game when finished. Not doing so
    will lead to issues when attempting to create another game on the same
    SC2 process.

    This class assumes that the game is multiplayer. LAN ports may be
    specified either as a base port (from which the others will be implied),
    or as an explicit list.

    You must specify an agent_interface_format. See the `AgentInterfaceFormat`
    documentation for further detail.

    Args:
      _only_use_kwargs: Don't pass args, only kwargs.
      map_name: Name of a SC2 map. Run bin/map_list to get the full list of
          known maps. Alternatively, pass a Map instance. Take a look at the
          docs in maps/README.md for more information on available maps.
      save_map: Whether to save map data before joining the game.
      host: Host where the SC2 process we're connecting to is running.
      host_port: The WebSocket port for the SC2 process we're connecting to.
      lan_port: Either an explicit sequence of LAN ports corresponding to
          [server game port, ...base port, client game port, ...base port],
          or an int specifying base port - equivalent to specifying the
          sequence [lan_port, lan_port+1, lan_port+2, lan_port+3].
      race: Race for this agent.
      name: The name of this agent, for saving in the replay.
      agent_interface_format: AgentInterfaceFormat object describing the
          format of communication between the agent and the environment.
      discount: Returned as part of the observation.
      visualize: Whether to pop up a window showing the camera and feature
          layers. This won't work without access to a window manager.
      step_mul: How many game steps per agent step (action/observation). None
          means use the map default.
      realtime: Whether to use realtime mode. In this mode the game simulation
          automatically advances (at 22.4 gameloops per second) rather than
          being stepped manually. The number of game loops advanced with each
          call to step() won't necessarily match the step_mul specified. The
          environment will attempt to honour step_mul, returning observations
          with that spacing as closely as possible. Game loops will be skipped
          if they cannot be retrieved and processed quickly enough.
      replay_dir: Directory to save a replay.
      replay_prefix: An optional prefix to use when saving replays.

    Raises:
      ValueError: if the race is invalid.
      ValueError: if the resolutions aren't specified correctly.
      ValueError: if lan_port is a sequence but its length != 4.
      */
    super()

    if (_only_use_kwargs) {
      throw new ValueError('Alll arguments must be passed as keyword arguments.')
    }

    if (agent_interface_format == null) {
      throw new ValueError('Please specify agent_interface_format.')
    }

    if (!race) {
      race = sc2_env.Race.random
    }

    const map_inst = map_name && maps.get(map_name)
    this._map_name = map_name
    this._game_info = null
    this._num_agents = 1
    this._discount = discount
    this._step_mul = step_mul || (map_inst ? map_inst.step_mul : 8)
    this._realtime = realtime
    this._last_step_time = null
    this._save_replay_episodes = replay_dir ? 1 : 0
    this._replay_dir = replay_dir
    this._replay_prefix = replay_prefix

    this._score_index = -1 // Win/loss only.
    this._score_multiplier = 1
    this._episode_length = sc2_env.MAX_STEP_COUNT
    this._ensure_available_actions = false
    this._discount_zero_after_timeout = false

    this._run_config = run_configs.get()
    this._parallel = run_parallel.RunParallel() // Needed for multiplayer.
    this._in_game = false
    this._action_delay_fns = [null]

    const required_raw = visualize
    const interfacee = this._get_interface(agent_interface_format, required_raw)
    let ports
    if (Array.isArray(lan_port)) {
      if (lan_port.lenth != 4) {
        throw new ValueError('lan_port sequence must be of length 4')
      }
      ports = lan_port
    } else {
      ports = []
      for (let p = 0; p < 4; p++) {
        ports.push(lan_port + p) // 2 * num players *in the game*.
      }
    }

    // call in factory method _setup
    // this._connect_remote(host, host_port, ports, race, name, map_inst, save_map, interfacee, agent_interface_format)
    // this._finalize(visualize)
    this._setup = async () => {
      await this._connect_remote(host, host_port, ports, race, name, map_inst, save_map, interfacee, agent_interface_format)
      await this._finalize(visualize)
    }
  }

  async close() {
    // Leave the game so that another may be created in the same SC2 process.
    if (this._in_game) {
      console.info('Leaving game.')
      await this._controllers[0].leave()
      this._in_game = false
      console.info('Left game.')
    }
    await this._controllers[0].close()
    // We don't own the SC2 process, we shouldn't call quit in the super class.
    this._controller = null
    this._game_info = null
    super.close()
  }

  async _connect_remote(host, host_port, lan_ports, race, name, map_inst, save_map, interfacee, agent_interface_format) {
    // Make sure this stays synced with bin/agent_remote.py.
    // Connect!
    console.info('Connecting...')
    this._controllers = [await remote_controller.RemoteControllerFactory(host, host_port)]
    console.info('Connected')

    if (map_inst && save_map) {
      const run_config = run_configs.get()
      await this._controllers[0].save_map(map_inst.path, map_inst.data(run_config))
    }
    // Create the join request.
    const join = new sc_pb.RequestJoinGame()
    join.setOptions(interfacee)
    join.setRace(race)
    join.setPlayerName(name)
    join.setSharedPort(0) //unused
    const serverPorts = new sc_pb.PortSet()
    serverPorts.setGamePort(lan_ports.pop())
    serverPorts.setBasePort(lan_ports.pop())
    join.setServerPorts(serverPorts)
    const clientPorts = new sc_pb.PortSet()
    clientPorts.setGamePort(lan_ports.pop())
    clientPorts.setBasePort(lan_ports.pop())
    join.addClientPorts(clientPorts)

    console.log('Joining game.')
    await this._controllers[0].join_game(join)

    this._game_info = [await this._controllers[0].game_info()]

    if (!this._map_name) {
      this._map_name = this._game_info[0].map_name
    }

    this._features = [features.features_from_game_info({
      game_info: this._game_info[0],
      agent_interface_format,
    })]

    this._in_game = true
    console.info('Game joined.')
  }

  _restart() { //eslint-disable-line
    // Can't restart since it's not clear how you'd coordinate that with the other players.
    throw new RestartError("Can't restart")
  }
}

async function RemoteSC2EnvFactory() {
  const rse = new RemoteSC2Env(...arguments) //eslint-disable-line
  await rse._setup()
  return rse
}

module.exports = {
  RemoteSC2Env,
  RemoteSC2EnvFactory,
}
