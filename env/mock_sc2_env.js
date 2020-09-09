const s2clientprotocol = require('s2clientprotocol')  //eslint-disable-line
const path = require('path') //eslint-disable-line
const environment = require(path.resolve(__dirname, './environment.js'))
const sc2_env = require(path.resolve(__dirname, './sc2_env.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const point = require(path.resolve(__dirname, '..', 'lib', 'point.js'))
const units = require(path.resolve(__dirname, '..', 'lib', 'units.js'))
const dummy_observation = require(path.resolve(__dirname, '..', 'tests', 'dummy_observation.js'))
const np = require(path.resolve(__dirname, '..', 'lib', 'numpy.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const common_pb = s2clientprotocol.common_pb
const { isinstance, ValueError } = pythonUtils

/* Mocking the Starcraft II environment. */

const DUMMY_MAP_SIZE = new point.Point(256, 256)

class _TestEnvironment extends environment.Base {
  /*
   simple generic test environment.

  This class is a lightweight implementation of `environment.Base` that returns
  the same timesteps on every observation call. By default, each returned
  timestep (one per agent) is reward 0., discount 1., and the observations are
  zero `np.ndarrays` of dtype `np.int32` and the shape specified by the
  environment's spec.

  However, the behavior of the `TestEnvironment` can be configured using the
  object's attributes.

  Attributes:
    next_timestep: The `environment.TimeStep`s to return on the next call to
      `step`. When necessary, some fields will be overridden to ensure the
      `step_type` contract.
    episode_length: if the episode length (number of transitions) exceeds
      `episode_length` on a call to `step`, the `step-type` will be set to
      `environment.StepType.LAST`, forcing an end of episode. This allows a
      stub of a production environment to have end_episodes. Will be ignored if
      set to `float('inf')` (the default).
  */
  constructor (num_agents, observation_spec, action_spec, agent_interface_format, _features) { //eslint-disable-line
    /*
    Initializes the TestEnvironment.

    The `next_observation` is initialized to be reward = 0., discount = 1.,
    and an appropriately sized observation of all zeros. `episode_length` is set
    to `float('inf')`.

    Args:
      num_agents: The number of agents.
      observation_spec: The observation specs for each player.
      action_spec: The action specs for each player.
    */
    super()
    this._num_agents = num_agents
    this._observation_spec = observation_spec
    this._action_spec = action_spec
    this._episode_steps = 0
    this.next_timestep = []
    this._agent_interface_format = agent_interface_format
    this._features = _features
    observation_spec.forEach((obs_spec, agent_index) => {
      const env = new environment.TimeStep({
        step_type: environment.StepType.MID,
        reward: 0.0,
        discount: 1.0,
        observation: this._default_observation(obs_spec, agent_index, agent_interface_format)
      })
      this.next_timestep.push(env)
    })
    this.episode_length = Infinity
  }

  reset() {
    /* Restarts episode and returns `next_observation` with `StepType.FIRST`. */
    this._episode_steps = 0
    return this.step(Array(this._num_agents).fill(null))
  }

  step(actions, step_mul = null) {
    /* Returns `next_observation` modifying its `step_type` if necessary. */

    if (actions.length !== this._num_agents) {
      throw new ValueError(`Expected ${this._num_agents} actions, received ${actions.length}.`)
    }

    let step_type
    if (this._episode_steps == 0) {
      step_type = environment.StepType.FIRST
    } else if (this._episode_steps >= this.episode_length) {
      step_type = environment.StepType.LAST
    } else {
      step_type = environment.StepType.MID
    }

    const timesteps = []
    this.next_timestep.forEach((timestep) => {
      if (step_type === environment.StepType.FIRST) {
        timestep.step_type = step_type
        timestep.reward = 0.0
        timestep.discount = 0.0
        timesteps.push(timestep)
      } else if (step_type === environment.StepType.LAST) {
        timestep.step_type = step_type
        timestep.discount = 0.0
        timesteps.push(timestep)
      } else {
        timesteps.push(timestep)
      }
    })

    if (timesteps[0].step_type === environment.StepType.LAST) {
      this._episode_steps = 0
    } else {
      this._episode_steps += 1
    }

    return timesteps
  }

  action_spec() {
    // See base class.
    return this._action_spec
  }

  observation_spec() {
    // See base class.
    return this._observation_spec
  }

  _default_observation(obs_spec, agent_index) { //eslint-disable-line
    // Returns an observation based on the observation spec.
    const observation = {}
    Object.keys(obs_spec).forEach((key) => {
      const shape = obs_spec[key]
      observation[key] = np.zeros(shape, 'int32')
    })
    return observation
  }
}

class SC2TestEnv extends _TestEnvironment {
  /* A TestEnvironment to swap in for `starcraft2.env.sc2_env.SC2Env`.

  Repeatedly returns a mock observation for 10 calls to `step` whereupon it
  sets discount to 0. and changes state to READY_TO_END_EPISODE.

  Example:

  ```
  @mock.patch(
      'starcraft2.env.sc2_env.SC2Env',
      mock_sc2_env.SC2TestEnv)
  def test_method(self):
    env = sc2_env.SC2Env('nonexisting map')  # Really a SC2TestEnv.
    ...
  ```

  See base class for more details. */
  constructor({
    map_name = null,
    players = null,
    agent_interface_format = null,
    discount = 1.0,
    discount_zero_after_timeout = false,
    visualize = false,
    step_mul = null,
    realtime = false,
    save_replay_episodes = 0,
    replay_dir = null,
    game_steps_per_episode = null,
    score_index = null,
    score_multiplier = null,
    random_seed = null,
    disable_fog = false,
    ensure_available_actions = true,
    version = null
  }, _only_use_kwargs = null) {
  /* intializes an SC2TestEnv.

    Args:
      _only_use_kwargs: Don't pass args, only kwargs.
      map_name: Map name. Ignored.
      players: A list of Agent and Bot instances that specify who will play.
      agent_interface_format: A sequence containing one AgentInterfaceFormat
        per agent, matching the order of agents specified in the players list.
        Or a single AgentInterfaceFormat to be used for all agents.
      discount: Unused.
      discount_zero_after_timeout: Unused.
      visualize: Unused.
      step_mul: Unused.
      realtime: Not supported by the mock environment, throws if set to true.
      save_replay_episodes: Unused.
      replay_dir: Unused.
      game_steps_per_episode: Unused.
      score_index: Unused.
      score_multiplier: Unused.
      random_seed: Unused.
      disable_fog: Unused.
      ensure_available_actions: Whether to throw an exception when an
        unavailable action is passed to step().
      version: Unused.
    Raises:
      ValueError: if args are passed. */
    map_name = null
    discount = null
    discount_zero_after_timeout = null
    visualize = null
    step_mul = null
    save_replay_episodes = null
    replay_dir = null
    game_steps_per_episode = null
    score_index = null
    score_multiplier = null
    random_seed = null
    disable_fog = null
    ensure_available_actions = null
    version = null

    if (_only_use_kwargs) {
      throw new ValueError("All arguments must be passed as keyword arguments.")
    }

    if (realtime) {
      throw new ValueError("realtime mode is not supported by the mock env.")
    }

    let num_agents
    if (!(players)) {
      num_agents = 1
    } else {
      num_agents = 0
      players.forEach((p) => {
        if (isinstance(p, sc2_env.Agent)) {
          num_agents += 1
        }
      })
    }

    if (agent_interface_format === null) {
      throw new ValueError("Please specify agent_interface_format.")
    }

    if (isinstance(agent_interface_format, sc2_env.AgentInterfaceFormat)) {
      agent_interface_format = Array(num_agents).fill(agent_interface_format)
    }

    if (agent_interface_format.length != num_agents) {
      throw new ValueError("The number of entries in agent_interface_format should correspond 1-1 with the number of agents.")
    }
    const _features = Object.keys(agent_interface_format).map((key) => {
      const interface_format = agent_interface_format[key]
      return new features.Features(interface_format, DUMMY_MAP_SIZE)
    })
    const action_spec = []
    Object.keys(_features).forEach((key) => {
      const f = _features[key]
      action_spec.push(f.action_spec())
    })
    const observation_spec = []
    Object.keys(_features).forEach((key) => {
      const f = _features[key]
      observation_spec.push(f.observation_spec())
    })
    super(num_agents, observation_spec, action_spec, agent_interface_format, _features)

    this._features = _features
    this.episode_length = 10
    this._agent_interface_formats = agent_interface_format
  }

  save_replay() { //eslint-disable-line
    // Does nothing.
  }

  _default_observation(obs_spec, agent_index, _agent_interface_formats) {
    // Returns a mock observation from an SC2Env.
    const builder = new dummy_observation.Builder(obs_spec).game_loop(0)
    const aif = (_agent_interface_formats || this._agent_interface_formats)[agent_index]
    if (aif.use_feature_units || aif.use_raw_units) {
      const unit_type = units.Neutral.LabBot
      const alliance = features.PlayerRelative.NEUTRAL
      const pos = new common_pb.Point()
      pos.setX(10)
      pos.setY(10)
      pos.setZ(10)
      const feature_units = [
        new dummy_observation.FeatureUnit({
          unit_type,
          alliance,
          owner: 16,
          pos,
          radius: 1.0,
          health: 5,
          health_max: 5,
          is_on_screen: true,
        })
      ]
      builder.feature_units(feature_units)
    }
    const response_observation = builder.build()
    const features_ = this._features[agent_index]
    const observation = features_.transform_obs(response_observation)

    // Add bounding box for the minimap camera in top left of feature screen.
    if (observation.hasOwnProperty("feature_minimap")) {
      const minimap_camera = observation.feature_minimap.camera
      const h = minimap_camera.length
      const w = minimap_camera[0].length
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          minimap_camera[i][j] = 0
        }
      }
      for (let i = 0; i < Math.floor(h / 2); i++) {
        for (let j = 0; j < Math.floor(w / 2); j++) {
          minimap_camera[i][j] = 1
        }
      }
    }
    return observation
  }
}

module.exports = {
  _TestEnvironment,
  SC2TestEnv
}
