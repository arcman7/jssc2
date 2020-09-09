const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const path = require('path') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
// const protocol = require(path.resolve(__dirname, '..', 'lib', 'protocol.js'))
const remote_controller = require(path.resolve(__dirname, '..', 'lib', 'remote_controller.js'))
const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

//Creates SC2 processes and games for remote agents to connect into.//

class VsAgent {
  /*
  Host a remote agent vs remote agent game.

  Starts two SC2 processes, one for each of two remote agents to connect to.
  Call create_game, then have the agents connect to their respective port in
  host_ports, specifying lan_ports in the join game request.

  Agents should leave the game once it has finished, then another game can
  be created. Note that failure of either agent to leave prior to creating
  the next game will lead to SC2 crashing.

  Best used as a context manager for simple and timely resource release.

  **NOTE THAT** currently re-connecting to the same SC2 process is flaky.
  If you experience difficulties the workaround is to only create one game
  per instantiation of VsAgent.
  */
  static get _num_agents() { return 2 }

  constructor({ lan_ports, sc_procs }) {
    this._num_agents = 2
    this._run_config = run_configs.get()
    this._processes = []
    this._controllers = []
    this._saved_maps = new Set()
    // Reserve LAN ports.
    if (!lan_ports) {
      throw new Error('Must provide lan_ports, none were provided')
    }
    if (lan_ports.length < this._num_agents * 2) {
      throw new Error(`Must provide the correct number of lan ports, expected ${this._num_agents * 2}, got: ${lan_ports.length}`)
    }
    if (this._num_agents !== sc_procs.length) {
      throw new Error(`Must provide correct number of sc_procs, expected ${this._num_agents}, got: ${sc_procs.length} `)
    }
    this.lan_ports = lan_ports
    this._processes = sc_procs
    // this._lan_ports = portspicker.pick_unused_ports(this._num_agents * 2)
    // Start SC2 processes.
    for (let i = 1; i < this._num_agents.length; i++) {
      // const process = this._run_config.start(extra_ports = this._lan_ports)
      // this._processes.push(process)
      const proc = this._processes[i]
      this._controllers.push(proc._controller)
    }
  }

  __enter__() {
    return this
  }

  __exit__() {
    return this.close()
  }

  async create_game(map_name) {
    /*
    Create a game for the agents to join.

    Args:
      map_name: The map to use.
    */
    await this._reconnect()

    const map_inst = maps.get(map_name)
    const map_data = map_inst.data(this._run_config)
    if (!this._saved_maps.has(map_name)) {
      await Promise.all(this._controllers.map((controller) => controller.save_map(map_inst.path, map_data)))
      this._saved_maps.add(map_name)
    }

    // Form the create game message.
    const create = new sc_pb.RequestCreateGame()
    const localMap = new sc_pb.LocalMap()
    localMap.setMapPath(map_inst.path)
    create.setLocalMap(localMap)
    create.setDisableFog(false)
    // Set up for two agents.
    for (let i = 1; i < this._num_agents.length; i++) {
      const playerSetup = new sc_pb.PlayerSetup()
      playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
      create.addPlayerSetup(playerSetup)
    }

    // Create the game.
    await this._controllers[0].create_game(create)
    await this._disconnect()
    return true
  }

  async _disconnect() {
    await Promise.all(this._controllers.map((c) => c.close()))
    this._controllers = []
    return true
  }

  async _reconnect() {
    if (!this._controllers.length) {
      this._controllers = await Promise.all(this._processes.map((p) => remote_controller
        .RemoteControllerFactory(p.host, p.port, p, ...arguments))) //eslint-disable-line
    }
    return true
  }

  async save_replay(replay_dir, replay_name) {
    await this._reconnect()
    return this._run_config.save_replay(
      this._controllers[0].save_replay(), replay_dir, replay_name
    )
  }

  get hosts() {
    // The hosts that the remote agents should connect to.
    return this._processes.map((proc) => proc._port)
  }

  get host_ports() {
    // The WebSocket ports that the remote agents should connect to.
    return this._processes.map((proc) => proc._port)
  }

  get lan_prots() {
    // The LAN ports which the remote agents should specify when joining
    return this._lan_ports
  }

  async close() {
    // Shutdown and free all resources.
    try {
      const timeout_seconds = 7
      await this._reconnect(timeout_seconds)
      await Promise.all(this._controllers.map((controller) => controller.quit()))
    } catch (err) {
      console.error(err)
    }

    this._controllers = []
    await Promise.all(this._processes.map((proc) => proc.close()))
    this._processes = []
    // portspicker.return_ports(this._lan_ports) // can't do this yet
    this._lan_ports = []
  }
}

class VsBot {
  /*
  Host a remote agent vs bot game.

  Starts a single SC2 process. Call create_game, then have the agent connect
  to host_port.

  The agent should leave the game once it has finished, then another game can
  be created. Note that failure of the agent to leave prior to creating
  the next game will lead to SC2 crashing.

  Best used as a context manager for simple and timely resource release.

  **NOTE THAT** currently re-connecting to the same SC2 process is flaky.
  If you experience difficulties the workaround is to only create one game
  per instantiation of VsBot.
  */
  constructor(sc_proc) {
    // Start the SC2 process.
    this._run_config = run_configs.get()
    if (!sc_proc) {
      throw new Error('sc_proc required, none was provided.')
    }
    this._process = sc_proc
    // this._process = this._run_config.start()
    this._controller = this._process.controller
    this._saved_maps = new Set()
  }

  __enter__() {
    return this
  }

  __exit__() {
    return this.close()
  }

  async create_game(
    map_name,
    bot_difficulty = sc_pb.Difficulty.VERYEASY,
    bot_race = sc_common.Race.RANDOM,
    bot_first = false
  ) {
    /*
    Create a game, one remote agent vs the specified bot.

    Args:
      map_name: The map to use.
      bot_difficulty: The difficulty of the bot to play against.
      bot_race: The race for the bot.
      bot_first: Whether the bot should be player 1 (else is player 2).
    */
    await this._reconnect()
    await this._controller.ping()

    // Form the create game message.
    const map_inst = maps.get(map_name)
    const map_data = map_inst.data(this._run_config)
    if (!this._saved_maps.has(map_name)) {
      await this._controller.save_map(map_inst.path, map_data)
      this._saved_maps.add(map_name)
    }

    const create = new sc_pb.RequestCreateGame()
    const localMap = new sc_pb.LocalMap()
    localMap.setMapData(map_data)
    localMap.setMapPath(map_inst.path)
    create.setLocalMap(localMap)
    create.setDisableFog(false)

    let playerSetup
    // Set up for one bot, one agent.
    if (!bot_first) {
      playerSetup = new sc_pb.PlayerSetup()
      playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
      create.addPlayerSetup(playerSetup)
    }

    playerSetup = new sc_pb.PlayerSetup()
    playerSetup.setType(sc_pb.PlayerType.COMPUTER)
    playerSetup.setRace(bot_race)
    playerSetup.setDifficulty(bot_difficulty)
    create.addPlayerSetup(playerSetup)

    if (bot_first) {
      playerSetup = new sc_pb.PlayerSetup()
      playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
      create.addPlayerSetup(playerSetup)
    }

    // Create the game.
    await this._controller.create_game(create)
    await this._disconnect()
    return true
  }

  async _disconnect() {
    await this._controller.close()
    this._controller = null
  }

  async _reconnect() {
    if (!this._controller) {
      this._controller = await remote_controller.RemoteControllerFactory(
        this._process.host, this._process.port, this._process, ...arguments) //eslint-disable-line
    }
    return true
  }

  async save_replay(replay_dir, replay_name) {
    await this._reconnect()
    return this._run_config.save_replay(
      (await this._controller.save_replay()),
      replay_dir,
      replay_name
    )
  }

  get host() {
    // The host that the remote agent should connect to.
    return String(this._process.host)
  }

  get host_port() {
    // The WebSocket port that the remote agent should connect to.
    return this._process.port
  }

  async close() {
    // Shutdown and free all resources.
    if (this._process !== null) {
      try {
        const timeout_seconds = 7
        await this._reconnect(timeout_seconds)
        await this._controller.quit()
      } catch (err) {
        console.error(err)
      }
      this._controller = null
      await this._process.close()
      this._process = null
    }
  }
}

async function VsAgentFactory() {
  const lan_ports = await portspicker.pick_unused_ports((VsAgent._num_agents * 2) + VsAgent._num_agents)
  let sc_procs = []
  const run_config = run_configs.get()
  for (let i = 0; i < VsAgent._num_agents; i++) {
    const port = lan_ports.pop()
    sc_procs.push(run_config.start({ extra_ports: lan_ports, port }))
  }
  sc_procs = await Promise.all(sc_procs)
  return new VsAgent({ lan_ports, sc_procs })
}

async function VsBotFactory() {
  const port = (await portspicker.pick_unused_ports(1))[0]
  const run_config = run_configs.get()
  const sc_proc = await run_config.start({ port })
  return new VsBot(sc_proc)
}

module.exports = {
  VsAgent,
  VsAgentFactory,
  VsBot,
  VsBotFactory,
}
