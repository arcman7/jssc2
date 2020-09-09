const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const random_agent = require(path.resolve(__dirname, '..', 'agents', 'random_agent.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const utils = require(path.resolve(__dirname, './utils.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { assert, arrayCompare, arrayShape, withPythonAsync, zip } = pythonUtils

// Verify that the observations match the observation spec.

async function TestObservationSpec() {
  const testCase = new utils.TestCase()
  testCase.setUp()
  console.log('TestObservationSpec')

  function check_observation_matches_spec(obs, obs_spec) {
    assert(arrayCompare(Object.keys(obs_spec).sort(), Object.keys(obs).sort()) == true, 'Object.keys(obs_spec) == Object.keys(obs)')
    Object.keys(obs).forEach((k) => {
      const o = obs[k]
      if (k == 'map_name') {
        assert(typeof o == 'string', 'o instanceof String')
        return
      }
      const descr = `${k}: spec: ${obs_spec[k]} != obs: ${arrayShape(o)}`
      if (arrayCompare(arrayShape(o), [0]) == true) {
        assert(obs_spec[k].includes(0) == true, descr)
      } else {
        assert(obs_spec[k].length == arrayShape(o).length, descr)
        zip(obs_spec[k], arrayShape(o)).forEach(([a, b]) => {
          if (a != 0) {
            assert(a == b, descr)
          }
        })
      }
    })
  }

  async function test_observation_matches_obs_spec() {
    console.log('[ RUN     ]test_observation_matches_obs_spec')
    const kwargs = {
      map_name: 'Simple64',
      players: [
        new sc2_env.Agent(Number(sc2_env.Race.random)),
        new sc2_env.Bot(Number(sc2_env.Race.random), Number(sc2_env.Difficulty.easy))
      ],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(
          [84, 87],
          [64, 67]
        )
      })
    }
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      let multiplayer_obs_spec = env.observation_spec()
      assert(multiplayer_obs_spec instanceof Array, 'multiplayer_obs_spec instanceof Array')
      assert(multiplayer_obs_spec.length == 1, 'multiplayer_obs_spec.length == 1')
      const obs_spec = multiplayer_obs_spec[0]

      multiplayer_obs_spec = env.action_spec()
      assert(multiplayer_obs_spec instanceof Array, 'multiplayer_obs_spec instanceof Array')
      assert(multiplayer_obs_spec.length == 1, 'multiplayer_obs_spec.length == 1')
      const action_spec = multiplayer_obs_spec[0]

      const agent = new random_agent.RandomAgent()
      await agent.setup(obs_spec, action_spec)

      let multiplayer_obs = await env.reset()
      for (let i = 0; i < 100; i += 1) {
        assert(multiplayer_obs instanceof Array, 'multiplayer_obs instanceof Array')
        assert(multiplayer_obs.length == 1, 'multiplayer_obs.length == 1')
        const raw_obs = multiplayer_obs[0]
        const obs = raw_obs.observation
        check_observation_matches_spec(obs, obs_spec)
        const act = agent.step(raw_obs)
        const multiplayer_act = [act]
        multiplayer_obs = await env.step(multiplayer_act)
      }
      await testCase.tearDown(true)
    })
    console.log('[      OK ]test_observation_matches_obs_spec')
  }
  await test_observation_matches_obs_spec()

  async function test_heterogeneous_observations() {
    console.log('[ RUN     ]test_heterogeneous_observations')
    const kwargs = {
      map_name: 'Simple64',
      players: [
        new sc2_env.Agent(Number(sc2_env.Race.random)),
        new sc2_env.Agent(Number(sc2_env.Race.random))
      ],
      agent_interface_format: [
        new sc2_env.AgentInterfaceFormat({
          feature_dimensions: new sc2_env.Dimensions(
            [84, 87],
            [64, 67]
          )
        }),
        new sc2_env.AgentInterfaceFormat({
          rgb_dimensions: new sc2_env.Dimensions(128, 64)
        })
      ]
    }
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      const obs_specs = env.observation_spec()
      assert(obs_specs instanceof Array, 'obs_specs instanceof Array')
      assert(obs_specs.length == 2, 'obs_specs.length == 2')

      const action_specs = env.action_spec()
      assert(action_specs instanceof Array, 'action_specs instanceof Array')
      assert(action_specs.length == 2, 'action_specs.length == 2')
      const agents = []
      zip(obs_specs, action_specs).forEach(([obs_spec, action_spec]) => {
        const agent = new random_agent.RandomAgent()
        agent.setup(obs_spec, action_spec)
        agent.reset()
        agents.push(agent)
      })
      let time_steps = await env.reset()
      for (let j = 0; j < 100; j += 1) {
        assert(time_steps instanceof Array, 'time_steps instanceof Array')
        assert(time_steps.length == 2, 'time_steps.length == 2')

        const actions = []
        for (let k = 0; k < agents.length; k += 1) {
          const agent = agents[k]
          const time_step = time_steps[k]
          const obs = time_step.observation
          check_observation_matches_spec(obs, obs_specs[k])
          actions.push(agent.step(time_step))
        }
        time_steps = await env.step(actions)
      }
      await testCase.tearDown(false)
    })
    console.log('[      OK ]test_heterogeneous_observations')
  }
  await test_heterogeneous_observations()
}

TestObservationSpec()
