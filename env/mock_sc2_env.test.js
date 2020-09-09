// Tests of the StarCraft2 mock environment.
const path = require('path')
const s2clientprotocol = require('s2clientprotocol')
const environment = require(path.resolve(__dirname, './environment.js'))
const mock_sc2_env = require(path.resolve(__dirname, './mock_sc2_env.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { arrayShape, arrayDtype } = pythonUtils
const np = require(path.resolve(__dirname, '..', 'lib', 'numpy.js'))
const mock = {}//[1]  // arbitrary mock object (no mocked method calls or property access)

describe('mock_sc2_env.js', () => {
  function assert_spec(array, shape, dtype) {
    expect(arrayShape(array)).toEqual(shape)
    expect(arrayDtype(array)).toEqual(dtype)
  }

  function assert_reset(env) {
    const expected = env.next_timestep[0]
    expected.step_type = environment.StepType.FIRST
    expected.reward = 0
    expected.discount = 0
    const timestep = env.reset()
    expect(timestep).toEqual([expected])
  }

  function assert_first_step(env) {
    const expected = env.next_timestep[0]
    expected.step_type = environment.StepType.FIRST
    expected.reward = 0
    expected.discount = 0
    const timestep = env.step([mock])
    expect(timestep).toEqual([expected])
  }

  function assert_mid_step(env) {
    const expected = env.next_timestep[0]
    expected.step_type = environment.StepType.MID
    const timestep = env.step([mock])
    expect(timestep).toEqual([expected])
  }

  function assert_last_step(env) {
    const expected = env.next_timestep[0]
    expected.step_type = environment.StepType.LAST
    expected.discount = 0.0
    const timestep = env.step([mock])
    expect(timestep).toEqual([expected])
  }

  function test_episode(env) {
    let testenv = env.next_timestep[0]
    testenv.step_type = environment.StepType.MID
    env.next_timestep = [testenv]
    assert_first_step(env)

    for (let step = 1; step < 10; step += 1) {
      testenv = env.next_timestep[0]
      testenv.reward = step
      testenv.discount = step / 10
      env.next_timestep = [testenv]
      assert_mid_step(env)
    }

    testenv = env.next_timestep[0]
    testenv.step_type = environment.StepType.LAST
    testenv.reward = 10
    testenv.discount = 0.0
    env.next_timestep = [testenv]
    assert_last_step(env)
  }

  function test_episode_length(env, length) {
    assert_reset(env)
    for (let i = 0; i < length - 1; i += 1) {
      assert_mid_step(env)
    }
    assert_last_step(env)

    assert_first_step(env)
    for (let i = 0; i < length - 1; i += 1) {
      assert_mid_step(env)
    }
    assert_last_step(env)
  }

  describe('  TestEnvironment', () => {
    const env = new mock_sc2_env._TestEnvironment(1, [{ 'mock': [10, 1] }], [mock])
    test('test_observation_spec', () => {
      expect(env.observation_spec()).toMatchObject([{ 'mock': [10, 1] }])
    })

    test('test_action_spec', () => {
      expect(env.action_spec()).toMatchObject([mock])
    })

    test('test_default_observation', () => {
      const observation = env._default_observation(env.observation_spec()[0], 0)
      delete observation.mock.id
      const mock_observation = { 'mock': np.zeros([10, 1], 'int32') }
      delete mock_observation.mock.id
      expect(observation).toMatchObject(mock_observation)
    })

    test('test_episode', () => {
      env.episode_length = Infinity
      test_episode(env)
    })

    test('test_two_episodes', () => {
      env.episode_length = Infinity
      test_episode(env)
      test_episode(env)
    })

    test('test_episode_length', () => {
      env.episode_length = 16
      test_episode_length(env, 16)
    })
  })

  describe('  TestSC2TestEnv', () => {
    test('test_episode', () => {
      const env = new mock_sc2_env.SC2TestEnv({
        map_name: 'nonexistant map',
        agent_interface_format: new features.AgentInterfaceFormat({
          feature_dimensions: new features.Dimensions(64, 32)
        })
      })
      env.episode_length = Infinity
      test_episode(env)
    })

    test('test_episode_length', () => {
      const env = new mock_sc2_env.SC2TestEnv({
        map_name: 'nonexistant map',
        agent_interface_format: new features.AgentInterfaceFormat({
          feature_dimensions: new features.Dimensions(64, 32)
        })
      })
      expect(env.episode_length).toBe(10)
      test_episode_length(env, 10)
    })

    test('test_screen_minimap_size', () => {
      const env = new mock_sc2_env.SC2TestEnv({
        map_name: 'nonexistant',
        agent_interface_format: new features.AgentInterfaceFormat({
          feature_dimensions: new features.Dimensions([84, 87], [64, 67])
        })
      })
      const timestep = env.reset()
      expect(timestep.length).toBe(1)
      assert_spec(timestep[0].observation['feature_screen'], [features.SCREEN_FEATURES.length, 87, 84], 'number')
      assert_spec(timestep[0].observation['feature_minimap'], [features.MINIMAP_FEATURES.length, 67, 64], 'number')
    })

    test('test_feature_units_are_supported', () => {
      const env = new mock_sc2_env.SC2TestEnv({
        map_name: 'nonexistant',
        agent_interface_format: new features.AgentInterfaceFormat({
          feature_dimensions: new features.Dimensions(64, 32),
          use_feature_units: true
        })
      })
      const obj = env.observation_spec()[0]
      expect(obj.hasOwnProperty('feature_units')).toBe(true)
    })
  })
})
