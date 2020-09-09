const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const Deque = require('double-ended-queue') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps')) //eslint-disable-line
const run_configs = require(path.resolve(__dirname, '..', 'run_configs')) //eslint-disable-line
const environment = require(path.resolve(__dirname, 'environment.js'))
const actions = require(path.resolve(__dirname, '..', 'lib', 'actions.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const metrics = require(path.resolve(__dirname, '..', 'lib', 'metrics.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const renderer_human = require(path.resolve(__dirname, '..', 'lib', 'renderer_human', 'backend.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const { any, assert, DefaultDict, getattr, isinstance, namedtuple, withPython, randomChoice, sequentialTaskQueue, setattr, ValueError, zip } = pythonUtils
const { common_pb, sc2api_pb } = s2clientprotocol
const sc_common = common_pb
const sc_pb = sc2api_pb
const sw = stopwatch.sw
const actions_lib = actions

/* A Starcraft II environment. */

const possible_results = {}
possible_results[sc_pb.Result.VICTORY] = 1
possible_results[sc_pb.Result.DEFEAT] = -1
possible_results[sc_pb.Result.TIE] = 0
possible_results[sc_pb.Result.UNDECIDED] = 0

const Race = Enum.IntEnum('Race', {
  random: sc_common.Race.RANDOM,
  protoss: sc_common.Race.PROTOSS,
  terran: sc_common.Race.TERRAN,
  zerg: sc_common.Race.ZERG,
})

const Difficulty = Enum.IntEnum('Difficulty', {
  // Bot difficulties.
  very_easy: sc_pb.Difficulty.VERYEASY,
  easy: sc_pb.Difficulty.EASY,
  medium: sc_pb.Difficulty.MEDIUM,
  medium_hard: sc_pb.MEDIUMHARD,
  hard: sc_pb.Difficulty.HARD,
  harder: sc_pb.Difficulty.HARDER,
  very_hard: sc_pb.Difficulty.VERYHARD,
  cheat_vision: sc_pb.Difficulty.CHEATVISION,
  cheat_money: sc_pb.Difficulty.CHEATMONEY,
  cheat_insane: sc_pb.Difficulty.CHEATINSANE,
})

const BotBuild = Enum.IntEnum('BotBuild', {
  // Bot build strategies.
  random: sc_pb.AIBuild.RANDOMBUILD,
  rush: sc_pb.AIBuild.RUSH,
  timing: sc_pb.AIBuild.TIMING,
  power: sc_pb.AIBuild.POWER,
  macro: sc_pb.AIBuild.MACRO,
  air: sc_pb.AIBuild.AIR,
})

// Re-export these names to make it easy to construct the environment.
const ActionSpace = actions_lib.ActionSpace //eslint-disable-line
const Dimensions = features.Dimensions //eslint-disable-line
const AgentInterfaceFormat = features.AgentInterfaceFormat
const parse_agent_interface_format = features.parse_agent_interface_format //eslint-disable-line

let crop_and_deduplicate_names

function to_list(arg) {
  if (arg instanceof actions.FunctionCall || !Array.isArray(arg)) {
    return [arg]
  }
  return arg
}

function get_default(a, b) {
  if (a === null || a === undefined) {
    return b
  }
  return a
}

class Agent extends namedtuple('Agent', ['race', 'name']) {
// Define an Agent. It can have a single race or a list of races.
  constructor(race, name = null) {
    super(to_list(race), name || '<unknown>')
  }
}

class Bot extends namedtuple('Bot', ['race', 'difficulty', 'build']) {
// Define a Bot. It can have a single or list of races or builds.
  constructor(race, difficulty, build = null) {
    super(to_list(race), difficulty, to_list(build || BotBuild.random))
  }
}

const _DelayedAction = namedtuple('DelayedAction', ['game_loop', 'action', 'field_name'])

const REALTIME_GAME_LOOP_SECONDS = 1 / 22.4
const MAX_STEP_COUNT = 524000 // The game fails above 2^19=524288 steps.
const NUM_ACTION_DELAY_BUCKETS = 10

class SC2Env extends environment.Base {
  /*
  A Starcraft II environment.

  The implementation details of the action and observation specs are in
  lib/features.py
  */
  constructor({
    map_name = null,
    battle_net_map = false,
    players = null,
    agent_interface_format = null,
    discount = 1.0,
    discount_zero_after_timeout = false,
    visualize = false,
    step_mul = null,
    realtime = false,
    save_replay_episodes = 0,
    replay_dir = null,
    replay_prefix = null,
    game_steps_per_episode = null,
    score_index = null,
    score_multiplier = null,
    random_seed = null,
    disable_fog = false,
    ensure_available_actions = true,
    version = null
  }, _only_use_kwargs = null) {
    /*
    Create a SC2 Env.

    You must pass a resolution that you want to play at. You can send either
    feature layer resolution or rgb resolution or both. If you send both you
    must also choose which to use as your action space. Regardless of which you
    choose you must send both the screen and minimap resolutions.

    For each of the 4 resolutions, either specify size or both width and
    height. If you specify size then both width and height will take that value.

    Args:
      _only_use_kwargs: Don't pass args, only kwargs.
      map_name: Name of a SC2 map. Run bin/map_list to get the full list of
          known maps. Alternatively, pass a Map instance. Take a look at the
          docs in maps/README.md for more information on available maps. Can
          also be a list of map names or instances, in which case one will be
          chosen at random per episode.
      battle_net_map: Whether to use the battle.net versions of the map(s).
      players: A list of Agent and Bot instances that specify who will play.
      agent_interface_format: A sequence containing one AgentInterfaceFormat
        per agent, matching the order of agents specified in the players list.
        Or a single AgentInterfaceFormat to be used for all agents.
      discount: Returned as part of the observation.
      discount_zero_after_timeout: If True, the discount will be zero
          after the `game_steps_per_episode` timeout.
      visualize: Whether to pop up a window showing the camera and feature
          layers. This won't work without access to a window manager.
      step_mul: How many game steps per agent step (action/observation). null
          means use the map default.
      realtime: Whether to use realtime mode. In this mode the game simulation
          automatically advances (at 22.4 gameloops per second) rather than
          being stepped manually. The number of game loops advanced with each
          call to step() won't necessarily match the step_mul specified. The
          environment will attempt to honour step_mul, returning observations
          with that spacing as closely as possible. Game loops will be skipped
          if they cannot be retrieved and processed quickly enough.
      save_replay_episodes: Save a replay after this many episodes. Default of 0
          means don't save replays.
      replay_dir: Directory to save replays. Required with save_replay_episodes.
      replay_prefix: An optional prefix to use when saving replays.
      game_steps_per_episode: Game steps per episode, independent of the
          step_mul. 0 means no limit. null means use the map default.
      score_index: -1 means use the win/loss reward, >=0 is the index into the
          score_cumulative with 0 being the curriculum score. null means use
          the map default.
      score_multiplier: How much to multiply the score by. Useful for negating.
      random_seed: Random number seed to use when initializing the game. This
          lets you run repeatable games/tests.
      disable_fog: Whether to disable fog of war.
      ensure_available_actions: Whether to throw an exception when an
          unavailable action is passed to step().
      version: The version of SC2 to use, defaults to the latest.

    Raises:
      ValueError: if no map is specified.
      ValueError: if wrong number of players are requested for a map.
      ValueError: if the resolutions aren't specified correctly.
    */
    super()

    if (_only_use_kwargs) {
      throw new ValueError('All arguments must be passed as keyword arguments.')
    }

    if (!players) {
      throw new ValueError('You must spesify the lsit of players.')
    }

    players.forEach((p) => {
      if (!isinstance(p, [Agent, Bot])) {
        throw new Error(`ValueError: Expected players to be of type Agent or Bot. Got: ${p}`)
      }
    })

    const num_players = players.length
    let n_agents = 0
    players.forEach((p) => {
      if (p instanceof Agent) {
        n_agents += 1
      }
    })
    this._num_agents = n_agents
    this._players = players

    if (!(1 <= num_players && num_players <= 2) || !(this._num_agents)) {
      throw new ValueError('Only 1 or 2 players with at least one agent is supported at the moment')
    }

    if (!map_name) {
      throw new ValueError('Missing a map name.')
    }

    this._battle_net_map = battle_net_map
    this._maps = []
    to_list(map_name).forEach((name) => {
      this._maps.push(maps.get(name))
    })
    const playercollect = []
    this._maps.forEach((m) => {
      playercollect.push(m.players)
    })
    const min_players = Math.min(...playercollect)
    const max_players = Math.max(...playercollect)

    if (this._battle_net_map) {
      this._maps.forEach((m) => {
        if (!m.battle_net_map) {
          throw new ValueError(`${m.name} isn't known on Battle.net`)
        }
      })
    }

    if (max_players === 1) {
      if (this._num_agents !== 1) {
        throw new ValueError('Single player maps require exactly one Agent.')
      }
    } else if (!(2 <= num_players && num_players <= min_players)) {
      throw new ValueError(`Maps support 2 - ${min_players} players, but trying to join with ${num_players}`)
    }

    if (save_replay_episodes && !replay_dir) {
      throw new ValueError('Missing replay_dir')
    }

    this._realtime = realtime
    this._last_step_time = null
    this._save_replay_episodes = save_replay_episodes
    this._replay_dir = replay_dir
    this._replay_prefix = replay_prefix
    this._random_seed = random_seed
    this._disable_fog = disable_fog
    this._ensure_available_actions = ensure_available_actions
    this._discount = discount
    this._discount_zero_after_timeout = discount_zero_after_timeout
    this._default_step_mul = step_mul
    this._default_score_index = score_index
    this._default_score_multiplier = score_multiplier
    this._default_episode_length = game_steps_per_episode
    this._run_config = run_configs.get(version)
    this._game_info = null

    if (agent_interface_format == null) {
      throw new Error("ValueError: Please specify agent_interface_format.")
    }

    if (agent_interface_format instanceof AgentInterfaceFormat) {
      const tempAgents = [agent_interface_format]
      for (let i = 1; i < this._num_agents; i++) {
        tempAgents.push(new AgentInterfaceFormat(...agent_interface_format._pickle_args))
      }
      agent_interface_format = tempAgents
    }

    if (agent_interface_format.length !== this._num_agents) {
      throw new Error("ValueError: The number of entries in agent_interface_format should be correspond 1-1 with the number of agents.")
    }

    this._action_delay_fns = []
    agent_interface_format.forEach((aif) => {
      this._action_delay_fns.push(aif._action_delay_fns)
    })
    this._interface_formats = agent_interface_format

    this._interface_options = []
    const self = this
    agent_interface_format.forEach((interface_format, i) => {
      const require_raw = visualize && i === 0
      self._interface_options.push(self._get_interface(interface_format, require_raw))
    })

    // apply @sw.decorate
    this.reset = sw.decorate(this.reset.bind(this))
    this.step = sw.decorate('step_env')(this.step.bind(this))

    /** the rest of the set up logic is done in _setUpGame which is called inside of the factory function SC2EnvFactory **/
    // this._launch_game()
    // this._create_join()
    // this._finalize_join()
  }

  async _setUpGame() {
    await this._launch_game()
    await this._create_join()
    this._finalize()
    return true
  }

  _finalize(visualize) {
    this._delayed_actions = []
    for (let i = 0; i < this._action_delay_fns.length; i++) {
      this._delayed_actions.push(new Deque(200))
    }

    if (visualize) {
      this._renderer_human = new renderer_human.InitalizeServices()
      this._renderer_human.setUp(
        this._run_config,
        this._controllers[0]
      )
    } else {
      this._renderer_human = null
    }

    this._metrics = new metrics.Metrics(this._map_name)
    this._metrics.increment_instance()

    this._last_score = null
    this._total_steps = 0
    this._episode_steps = 0
    this._episode_count = 0
    this._obs = Array(this._num_agents).fill(null)
    this._agent_obs = Array(this._num_agents).fill(null)
    this._state = environment.StepType.LAST // Want to jump to `reset`.
    console.info('Environment is ready')
  }

  static _get_interface(agent_interface_format, require_raw) {
    const aif = agent_interface_format
    const interfacee = new sc_pb.InterfaceOptions()
    interfacee.setRaw(aif.use_feature_units
      || aif.use_unit_counts
      || aif.use_raw_units
      || require_raw)
    interfacee.setShowCloaked(aif.show_cloaked)
    interfacee.setShowBurrowedShadows(aif.show_burrowed_shadows)
    interfacee.setShowPlaceholders(aif.show_placeholders)
    interfacee.setRawAffectsSelection(true)
    interfacee.setRawCropToPlayableArea(aif.raw_crop_to_playable_area)
    interfacee.setScore(true)
    if (aif.feature_dimensions) {
      const feature_layer = new sc_pb.SpatialCameraSetup()
      interfacee.setFeatureLayer(feature_layer)
      feature_layer.setWidth(aif.camera_width_world_units)
      feature_layer.setResolution(new sc_pb.Size2DI())
      feature_layer.setMinimapResolution(new sc_pb.Size2DI())
      aif.feature_dimensions.screen.assign_to(
        feature_layer.getResolution()
      )
      aif.feature_dimensions.minimap.assign_to(
        feature_layer.getMinimapResolution()
      )
      feature_layer.setCropToPlayableArea(aif.crop_to_playable_area)
      feature_layer.setAllowCheatingLayers(aif.allow_cheating_layers)
    }

    if (aif.rgb_dimensions) {
      const render = new sc_pb.SpatialCameraSetup()
      render.setResolution(new sc_pb.Size2DI())
      render.setMinimapResolution(new sc_pb.Size2DI())
      interfacee.setRender(render)
      aif.rgb_dimensions.screen.assign_to(render.getResolution())
      aif.rgb_dimensions.minimap.assign_to(render.getMinimapResolution())
    }

    return interfacee
  }

  _get_interface(agent_interface_format, require_raw) { //eslint-disable-line
    return SC2Env._get_interface(agent_interface_format, require_raw)
  }

  async _launch_game() {
    // Reserve a whole bunch of ports for the weird multiplayer implementation.
    if (this._num_agents > 1) {
      this._ports = await portspicker.pick_unused_ports(this._num_agents * 4)
      console.info(`Ports used for multiplayer: ${this._ports}`)
    } else {
      this._ports = []
    }
    const proc_ports = await portspicker.pick_unused_ports(this._players.length || 1)

    // Actually launch the game processes.
    this._sc2_procs = []
    this._interface_options.forEach((interfacee) => {
      this._sc2_procs.push(this._run_config.start({
        port: proc_ports.pop(),
        want_rgb: interfacee.hasRender(),
        // passedSw: new stopwatch.StopWatch(true),
      }))
    })
    this._sc2_procs = await Promise.all(this._sc2_procs)
    this._controllers = []
    this._sc2_procs.forEach((p) => {
      this._controllers.push(p.controller)
    })

    if (this._battle_net_map) {
      let available_maps = this._controllers[0].available_maps()
      available_maps = new Set(available_maps.battlenet_map_names)
      const unavailable = []
      this._maps.forEach((m) => {
        if (!available_maps.has(m.battle_net)) {
          unavailable.push(m.name)
        }
      })

      if (unavailable.length) {
        throw new Error(`ValueError: Requested map(s) not in the battle.net cache: ${unavailable.join(',')}`)
      }
    }
  }

  async _create_join() {
    // Create the game, and join it.//
    const map_inst = randomChoice(this._maps)
    this._map_name = map_inst.name
    this._step_mul = Math.max(1, this._default_step_mul || map_inst.step_mul)
    this._score_index = get_default(this._default_score_index, map_inst.score_index)
    this._score_multiplier = get_default(this._default_score_multiplier, map_inst.score_multiplier)
    this._episode_length = get_default(this._default_episode_length, map_inst.game_steps_per_episode)
    if (this._episode_length <= 0 || this._episode_length > MAX_STEP_COUNT) {
      this._episode_length = MAX_STEP_COUNT
    }

    // Create the game. Set the first instance as the host.
    const create = new sc_pb.RequestCreateGame()
    create.setDisableFog(this._disable_fog)
    create.setRealtime(this._realtime)
    if (this._battle_net_map) {
      create.setBattlenetMapName(map_inst.battle_net)
    } else {
      const localMap = new sc_pb.LocalMap()
      create.setLocalMap(localMap)
      create.getLocalMap().setMapPath(map_inst.path)
      const map_data = map_inst.data(this._run_config)
      if (this._num_agents === 1) {
        create.getLocalMap().setMapData(map_data)
      } else {
        // Save the maps so they can access it. Don't do it in parallel since SC2
        // doesn't respect tmpdir on windows, which leads to a race condition:
        // https://github.com/Blizzard/s2client-proto/issues/102
        try {
          await sequentialTaskQueue(this._controllers.map((c) => () => c.save_map(map_inst.path, map_data)))
        } catch (err) {
          console.error('bad map data: ', map_data, 'using map_inst: ', map_inst)
          throw err
        }
      }
    }

    if (this._random_seed !== null) {
      create.setRandomSeed(this._random_seed)
    }

    this._players.forEach((p) => {
      const playerSetup = new sc_pb.PlayerSetup()
      if (p instanceof Agent) {
        playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
        create.addPlayerSetup(playerSetup)
      } else {
        playerSetup.setType(sc_pb.PlayerType.COMPUTER)
        playerSetup.setDifficulty(Array.isArray(p.build) ? Number(randomChoice(p.build)) : Number(p.build))
        playerSetup.setAiBuild(Array.isArray(p.build) ? Number(randomChoice(p.build)) : Number(p.build))
        playerSetup.setRace(Array.isArray(p.race) ? Number(randomChoice(p.race)) : Number(p.race))
        create.addPlayerSetup(playerSetup)
      }
    })
    await this._controllers[0].create_game(create)
    // Create the join requests.
    const agent_players = this._players.filter((p) => p instanceof Agent)
    const sanitized_names = crop_and_deduplicate_names(agent_players.map((p) => p.name))
    const join_reqs = []
    zip(agent_players, sanitized_names, this._interface_options)
      .forEach(([p, name, interfacee]) => {
        const join = new sc_pb.RequestJoinGame()
        join.setOptions(interfacee)
        join.setRace(Array.isArray(p.race) ? Number(randomChoice(p.race)) : Number(p.race))
        join.setPlayerName(name)
        if (this._ports.length) {
          join.setServerPorts(new sc_pb.PortSet())
          join.setSharedPort(0)
          join.getServerPorts().setGamePort(this._ports[0])
          join.getServerPorts().setBasePort(this._ports[1])
          for (let i = 0; i < this._num_agents; i++) {
            const ports = new sc_pb.PortSet()
            ports.setGamePort(this._ports[i * 2 + 2])
            ports.setBasePort(this._ports[i * 2 + 3])
            join.addClientPorts(ports)
          }
        }
        join_reqs.push(join)
      })
    await Promise.all(zip(this._controllers, join_reqs).map(([c, join]) => c.join_game(join)))
    // #python_problems lol
    // Join the game. This must be run in parallel because Join is a blocking call to the game that waits until all clients have joined.
    this._game_info = await Promise.all(this._controllers.map((c) => c.game_info()))
    zip(this._game_info, this._interface_options).forEach(([g, interfacee]) => {
      const optionsRender = JSON.stringify(g.getOptions().getRender() ? g.getOptions().getRender().toObject() : 'undefined')
      const interfaceeRender = JSON.stringify(interfacee.getRender() ? interfacee.getRender().toObject() : 'undefined')
      if (optionsRender !== interfaceeRender) {
        console.warn(`Actual interface options don't match requested options: \n
          Requested: ${interfacee.toObject()} \n\nActual: ${g.options.toObject()}`)
      }
    })

    this._features = zip(this._game_info, this._interface_formats)
      .map(([g, aif]) => {
        const game_info = g
        const agent_interface_format = aif
        const map_name = this._map_name
        return features.features_from_game_info({
          game_info,
          agent_interface_format,
          map_name,
        })
      })
  }

  get map_name() {
    return this._map_name
  }

  get game_info() {
  // A list of ResponseGameInfo, one per agent.
    return this._game_info
  }

  static_data() {
    return this._controllers[0].data()
  }

  observation_spec() {
    // Look at Features for full specs.//
    return this._features.map((f) => f.observation_spec())
  }

  action_spec() {
    //Look at Features for full specs.//
    return this._features.map((f) => f.action_spec())
  }

  action_delays() {
    /*
    In realtime we track the delay observation -> action executed.

    Returns:
      A list per agent of action delays, where action delays are a list where
      the index in the list corresponds to the delay in game loops, the value
      at that index the count over the course of an episode.

    Raises:
      ValueError: If called when not in realtime mode.
    */
    if (!this._realtime) {
      throw new Error("ValueError: This method is only supported in realtime mode.")
    }
    return this._action_delays
  }

  async _restart() {
    if (this._players.length === 1 && this._players[0].race.length == 1 && this._maps.length == 1) {
      // Need to support restart for fast-restart of mini-games.
      await this._controllers[0].restart()
    } else {
      if (this._controllers.length > 1) {
        await Promise.all(this._controllers.map((c) => c.leave()))
      }
      await this._create_join()
    }
    return true
  }

  async reset() {
    // Start a new episode.
    this._episode_steps = 0
    if (this._episode_count) {
      // No need to restart for the first episode.
      await this._restart()
    }

    this._episode_count += 1
    const sorted = Object.keys(this._features[0].requested_races)
      .sort()
      .map((key) => [key, this._features[0].requested_races[key]]) // [key, value]
    const races = sorted.map(([_, r]) => Race(r).key) //eslint-disable-line
    console.info(`Starting episode ${this._episode_count}: [${races.join(', ')}] on ${this._map_name}`)
    this._metrics.increment_episode()
    this._last_score = Array(this._num_agents).fill(0)
    this._state = environment.StepType.FIRST
    if (this._realtime) {
      this._last_step_time = performance.now() * 1000
      this._last_obs_game_loop = null
      this._action_delays = Array(this._num_agents).fill(Array(NUM_ACTION_DELAY_BUCKETS).fill(0))
    }
    const target_game_loop = 0
    return this._observe(target_game_loop)
  }

  async step(actionss, step_mul = null) {
    /*
    Apply actions, step the world forward, and return observations.

    Args:
      actions: A list of actions meeting the action spec, one per agent, or a
          list per agent. Using a list allows multiple actions per frame, but
          will still check that they're valid, so disabling
          ensure_available_actions is encouraged.
      step_mul: If specified, use this rather than the environment's default.

    Returns:
      A tuple of TimeStep namedtuples, one per agent.
    */
    if (this._state == environment.StepType.LAST) {
      return this.reset()
    }

    const skip = !this._ensure_available_actions
    let actionsss = []
    zip(this._features, this._obs, actionss).forEach(([f, o, acts]) => {
      to_list(acts).forEach((a) => {
        const obs = o.getObservation()
        const func_call = a
        const skip_available = skip
        actionsss.push(f.transform_action(obs, func_call, skip_available))
      })
    })

    if (!this._realtime) {
      actionsss = this._apply_action_delays(actionsss)
    }

    await Promise.all(zip(this._controllers, actionsss).map(([c, a]) => {
      const actReq = new sc_pb.RequestAction()
      actReq.addActions(a)
      return c.actions(actReq)
    }))

    this._state = environment.StepType.MID
    return this._step(step_mul)
  }

  async _step(step_mul = null) {
    step_mul = step_mul || this._step_mul
    if (step_mul <= 0) {
      throw new ValueError(`step_mul should be positive, got ${step_mul}`)
    }
    const target_game_loop = this._episode_steps + step_mul
    if (!(this._realtime)) {
      // Send any delayed actions that were scheduled up to the target game loop.
      const up_to_game_loop = target_game_loop
      const current_game_loop = await this._send_delayed_actions(
        up_to_game_loop,
        this._episode_steps, //current game_loop
      )
      const game_loop = target_game_loop
      await this._step_to(
        game_loop,
        current_game_loop,
      )
    }

    return this._observe(target_game_loop)
  }

  _apply_action_delays(actionss) {
    // Apply action delays to the requested actions, if configured to.
    assert(!this._realtime, '!this._realtime')
    const actions_now = []
    zip(actionss, this._action_delay_fns, this._delayed_actions)
      .forEach(([actions_for_player, delay_fn, delayed_actions]) => {
        const actions_now_for_player = new sc_pb.Action()
        const acts = actions_for_player.toObject()
        Object.keys(acts).forEach((field_name) => {
          const usedAction = getattr(actions_for_player, field_name)
          const action = acts[field_name]
          const delay = delay_fn ? delay_fn() : 1
          //action.ListFields() //Skip no-ops
          if (delay > 1 && Object.keys(action).filter((aKey) => action[aKey] !== undefined).length) {
            let game_loop = this._episode_steps + delay - 1

            // Randomized delays mean that 2 delay actions can be reversed.
            // Make sure that doesn't happen.
            if (delayed_actions) {
              game_loop = Math.max(game_loop, delayed_actions[delayed_actions.length - 1].game_loop)
            }

            // Don't send an action this frame.
            // using field name to aid in reconstruction of proto object
            delayed_actions.push(new _DelayedAction(game_loop, usedAction, field_name))
          } else {
            setattr(actions_now_for_player, field_name, usedAction)
          }
        })
        actions_now.push(actions_now_for_player)
      })
    return actions_now
  }

  async _send_delayed_actions(up_to_game_loop, current_game_loop) {
    // Send any delayed actions scheduled for up to the specified game loop.
    assert(!this._realtime, '!this._realtime')
    while (true) {
      let hasAny = false
      for (let i = 0; i < this._delayed_actions.length; i++) {
        if (this._delayed_actions[i].length) {
          hasAny = true
          break
        }
      }
      if (!hasAny) {
        //We haven't observed and may have hit game end.
        return current_game_loop
      }

      const act_game_loop = Math.min(...(this._delayed_actions.map((deque) => deque.get(0) ? deque.get(0).game_loop : Infinity))) //eslint-disable-line
      if (act_game_loop > up_to_game_loop) {
        return current_game_loop
      }
      await this._step_to(act_game_loop, current_game_loop)
      current_game_loop = act_game_loop
      const actionss = []
      for (let i = 0; i < this._delayed_actions.length; i++) {
        const deque = this._delayed_actions[i]
        if (deque.length && deque[0].game_loop === current_game_loop) {
          const delayed_action = deque.shift()
          const act = new sc_pb.Action()
          setattr(act, delayed_action.field_name, delayed_action.action)
          actionss.push(act)
        } else {
          actionss.push(null)
        }
      }
      await Promise.all(zip(this._controllers, actionss).map(([c, a]) => c.act(a)))
    }
  }

  async _step_to(game_loop, current_game_loop) {
    const step_mul = game_loop - current_game_loop
    if (step_mul < 0) {
      throw new ValueError('We should never need to step backwards')
    }
    if (step_mul > 0) {
      await withPython(this._metrics.measure_step_time(step_mul), async () => {
        if (!this._controllers[0].status_ended) { // May already have ended.
          await Promise.all(this._controllers.map((c) => c.step(step_mul)))
        }
        return true
      })
    }
    return true
  }

  async _get_observations(target_game_loop) {
    // Transform in the thread so it runs while waiting for other observations.
    const disable_fog = false
    async function parallel_observe(c, f) {
      const obs = await c.observe(disable_fog, target_game_loop)
      const agent_obs = f.transform_obs(obs)
      return [obs, agent_obs]
    }

    await withPython(this._metrics.measure_observation_time(), async () => {
      const parallelRuns = await Promise.all(zip(this._controllers, this._features)
        .map(([c, f]) => parallel_observe(c, f)))

      const results = zip(...parallelRuns)
      this._obs = results[0]
      this._agent_obs = results[1]
    })
    const bucket = []
    const game_loop = this._agent_obs[0].game_loop[0]
    this._obs.forEach((o) => {
      if (o.getPlayerResultList().length) {
        bucket.push(o.getPlayerResultList())
      }
    })
    if (game_loop < target_game_loop && !any(bucket)) {
      throw new ValueError(`The game didn't advance to the expected game loop.\n
        Expected: ${target_game_loop}, got: ${game_loop}`)
    } else if (game_loop > target_game_loop && target_game_loop > 0) {
      console.warn(`Received observation ${game_loop - target_game_loop} step(s) late: ${game_loop} rather than ${target_game_loop}`)
    }

    if (this._realtime) {
      /*
      Track delays on executed actions.
      Note that this will underestimate e.g. action sent, new observation taken before action executes, action executes, observation taken with action. This is difficult to avoid without changing the SC2 binary - e.g. send the observation game loop with each action, return them in the observation action proto.
      */
      if (this._last_step_time !== null) {
        for (let i = 0; i < this._obs.length; i++) {
          const obs = this._obs.length[i]
          const actionsList = obs.getActionsList()
          for (let j = 0; j < actionsList.length; j++) {
            const action = actionsList[j]
            if (action.hasGameLoop()) {
              let delay = action.getGameLoop() - this._last_obs_game_loop
              if (delay > 0) {
                const num_slots = this._action_delays[i].length
                delay = Math.min(delay, num_slots - 1) // Cap to num buckets.
                this._action_delays[i][delay] += 1
                break
              }
            }
          }
        }
      }
      this._last_obs_game_loop = game_loop
    }
  }

  async _observe(target_game_loop) {
    await this._get_observations(target_game_loop)
    // TODO(tewalds): How should we handle more than 2 agents and the case where the episode can end early for some agents?
    const outcome = Array(this._num_agents).fill(0)
    let discount = this._discount
    let episode_complete = false
    this._obs.forEach((o) => {
      if (o.getPlayerResultList().length) {
        episode_complete = true
      }
    })

    if (episode_complete) {
      this._state = environment.StepType.LAST
      discount = 0
      for (let i = 0; i < this._obs.length; i++) {
        const o = this._obs[i]
        const playerResultList = o.getPlayerResultList()
        const player_id = o.getObservation().getPlayerCommon().getPlayerId()
        for (let j = 0; j < playerResultList.length; j++) {
          const result = playerResultList[j]
          if (result.getPlayerId() == player_id) {
            outcome[i] = possible_results[result.getResult()] || 0
          }
        }
      }
    }

    let reward
    if (this._score_index >= 0) { // Game score, not win/loss reward.
      const cur_score = this._agent_obs.map((o) => {
        return o['score_cumulative'][this._score_index]
      })
      if (this._episode_steps == 0) { // First reward is always 0.
        reward = Array(this._num_agents).fill(0)
      } else {
        reward = zip(cur_score, this._last_score).map(([cur, last]) => cur - last)
      }
      this._last_score = cur_score
    } else {
      reward = outcome
    }
    if (this._renderer_human) {
      this._renderer_human.render(this._obs[0])
      const cmd = this._renderer_human.get_actions(
        this._run_config, this._controllers[0],
      )
      if (cmd == renderer_human.ActionCmd.STEP) {
        // pass
      } else if (cmd == renderer_human.ActionCmd.RESTART) {
        this._state = environment.StepType.LAST
      } else if (cmd == renderer_human.ActionCmd.QUIT) {
        throw new Error('KeyboardInterrup: Quit?')
      }
    }

    this._total_steps += this._agent_obs[0].game_loop[0] - this._episode_steps
    this._episode_steps = this._agent_obs[0].game_loop[0]
    if (this._episode_steps >= this._episode_length) {
      this._state = environment.StepType.LAST
      if (this._discount_zero_after_timeout) {
        discount = 0.0
      }
      if (this._episode_steps >= MAX_STEP_COUNT) {
        console.info('Cut short to avoid SC2\'s max step count of 2^19=524288.')
      }
    }

    if (this._state == environment.StepType.LAST) {
      if (this._save_replay_episodes > 0
        && (this._episode_count % this._save_replay_episodes) == 0) {
        await this.save_replay(this._replay_dir, this._replay_prefix)
      }
      const score_val = []
      this._agent_obs.forEach((o) => {
        score_val.push(o['score_cumulative'][0])
      })
      console.info(`Episode ${this._episode_count} finished after ${this._episode_steps} game steps.\n
        Outcome: [${outcome}], reward: [${reward}], score: [${score_val}]`)
    }

    const self = this
    function zero_on_first_step(value) {
      if (self._state == environment.StepType.FIRST) {
        return 0.0
      }
      return value
    }
    return zip(reward, this._agent_obs).map(([r, o]) => { //eslint-disable-line
      return new environment.TimeStep({
        step_type: this._state,
        reward: zero_on_first_step(r * this._score_multiplier),
        discount: zero_on_first_step(discount),
        observation: o
      })
    })
  }

  async send_chat_message(messages, broadcast = true) {
    // Useful for logging messages into the replay.
    await Promise.all(zip(this._controllers, messages).map(([c, message]) => {
      const channel = broadcast ? sc_pb.ActionChat.Broadcast : sc_pb.ActionChat.Team
      return c.chat(message, channel)
    }))
    return true
  }

  async save_replay(replay_dir, prefix = null) {
    if (prefix === null) {
      prefix = this._map_name
    }
    const replay_path = await this._run_config.save_replay(
      this._controllers[0].save_replay(),
      replay_dir,
      prefix,
    )
    console.info(`Wrote replay to: ${replay_path}`)
    return replay_path
  }

  async close() {
    console.info('Environment Close')
    if (this._metrics) {
      this._metrics.close()
      this._metrics = null
    }
    if (this._renderer_human) {
      this._renderer_human.close()
      this._renderer_human = null
    }
    // Don't use parallel since it might be broken by an exception.
    if (this._controllers) {
      await Promise.all(this._controllers.map((c) => c.quit()))
      this._controllers = null
    }
    if (this._sc2_procs) {
      await Promise.all(this._sc2_procs.map((p) => p.close()))
      this._sc2_procs = null
    }
    if (this._ports) {
      // portspicker.return_ports(this._ports) // can't do this yet
      this._ports = null
    }
    this._game_info = null
  }
}

async function SC2EnvFactory(
  _only_use_kwargs,
  map_name,
  battle_net_map,
  players,
  agent_interface_format,
  discount,
  discount_zero_after_timeout,
  visualize,
  step_mul,
  realtime,
  save_replay_episodes,
  replay_dir,
  replay_prefix,
  game_steps_per_episode,
  score_index,
  score_multiplier,
  random_seed,
  disable_fog,
  ensure_available_actions,
  version
) {
  const sc2Env = new SC2Env(
    _only_use_kwargs,
    map_name,
    battle_net_map,
    players,
    agent_interface_format,
    discount,
    discount_zero_after_timeout,
    visualize,
    step_mul,
    realtime,
    save_replay_episodes,
    replay_dir,
    replay_prefix,
    game_steps_per_episode,
    score_index,
    score_multiplier,
    random_seed,
    disable_fog,
    ensure_available_actions,
    version
  )
  await sc2Env._setUpGame()
  return sc2Env
}

crop_and_deduplicate_names = function(names) {
  /*
  Crops and de-duplicates the passed names.

  SC2 gets confused in a multi-agent game when agents have the same
  name. We check for name duplication to avoid this, but - SC2 also
  crops player names to a hard character limit, which can again lead
  to duplicate names. To avoid this we unique-ify names if they are
  equivalent after cropping. Ideally SC2 would handle duplicate names,
  making this unnecessary.

  TODO(b/121092563): Fix this in the SC2 binary.

  Args:
    names: List of names.

  Returns:
    De-duplicated names cropped to 32 characters.
  */
  const max_name_length = 32
  // Crop.
  const cropped = names.map((n) => n.slice(0, max_name_length))

  // De-duplicate.
  const deduplicated = []
  const name_counts = new DefaultDict(0)
  cropped.forEach((n) => {
    name_counts[n] += 1
  })

  const name_index = new DefaultDict(1)
  cropped.forEach((n) => {
    if (name_counts[n] == 1) {
      deduplicated.push(n)
    } else {
      deduplicated.push(`(${name_index[n]}) ${n}`)
      name_index[n] += 1
    }
  })

  // Crop again.
  const recropped = deduplicated.map((n) => n.slice(0, max_name_length))
  if (new Set(recropped).size !== recropped.length) {
    throw new ValueError("Failed to de-duplicate names")
  }
  return recropped
}

module.exports = {
  possible_results,
  Race,
  BotBuild,
  ActionSpace,
  Dimensions,
  AgentInterfaceFormat,
  parse_agent_interface_format,
  crop_and_deduplicate_names,
  Difficulty,
  Agent,
  Bot,
  MAX_STEP_COUNT,
  NUM_ACTION_DELAY_BUCKETS,
  REALTIME_GAME_LOOP_SECONDS,
  SC2Env,
  SC2EnvFactory,
}
