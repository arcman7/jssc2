const path = require('path') //eslint-disable-line
const scripted_agent = require(path.resolve(__dirname, '..', 'agents', 'scripted_agent.js'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const utils = require(path.resolve(__dirname, './utils.js'))
const { assert, withPythonAsync } = pythonUtils

// Solve the nm_easy map using a fixed policy by reading the feature layers.

async function TestEasy() {
  const testCase = new utils.TestCase()
  const steps = 200
  const step_mul = 16
  testCase.setUp()

  async function test_move_to_beacon() {
    console.log('[ RUN     ] test_move_to_beacon')
    const kwargs = {
      map_name: 'MoveToBeacon',
      players: [new sc2_env.Agent(Number(sc2_env.Race.terran))],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(84, 64)
      }),
      step_mul: step_mul,
      game_steps_per_episode: steps * step_mul
    }
    let agent
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      agent = new scripted_agent.MoveToBeacon()
      await run_loop.run_loop([agent], env, steps)
      await testCase.tearDown(true)
    })
    assert(agent.episodes <= agent.reward, `\n agent.episodes <= agent.reward:\n ${agent.episodes}    !<=    ${agent.reward}`)
    assert(agent.steps == steps, `agent.steps == steps:\n  ${agent.steps} !== ${steps}`)
    console.log('[      OK ] test_move_to_beacon')
  }
  try {
    await test_move_to_beacon()
  } catch (err) {
    console.error(err)
    console.log('[   FAIL  ]  test_move_to_beacon')
  }

  async function test_collect_mineral_shards() {
    console.log('[ RUN     ] test_collect_mineral_shards')
    const kwargs = {
      map_name: 'CollectMineralShards',
      players: [new sc2_env.Agent(Number(sc2_env.Race.terran))],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(84, 64),
      }),
      step_mul: step_mul,
      game_steps_per_episode: steps * step_mul
    }
    let agent
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      agent = new scripted_agent.CollectMineralShards()
      await run_loop.run_loop([agent], env, steps)
      await testCase.tearDown(true)
    })
    assert(agent.episodes <= agent.reward, `\n agent.episodes <= agent.reward:\n ${agent.episodes}    !<=    ${agent.reward}`)
    assert(agent.steps == steps, `agent.steps == steps:\n  ${agent.steps} !== ${steps}`)
    console.log('[      OK ] test_collect_mineral_shards')
  }
  try {
    await test_collect_mineral_shards()
  } catch (err) {
    console.error(err)
    console.log('[   FAIL  ] test_collect_mineral_shards')
  }

  async function test_collect_mineral_shards_feature_units() {
    console.log('[ RUN     ] test_collect_mineral_shards_feature_units')
    const kwargs = {
      map_name: 'CollectMineralShards',
      players: [new sc2_env.Agent(Number(sc2_env.Race.terran))],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(84, 64),
        use_feature_units: true
      }),
      step_mul: step_mul,
      game_steps_per_episode: steps * step_mul
    }
    let agent
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      agent = new scripted_agent.CollectMineralShardsFeatureUnits()
      await run_loop.run_loop([agent], env, steps)
      await testCase.tearDown(true)
    })
    assert(agent.episodes <= agent.reward, `\n agent.episodes <= agent.reward:\n ${agent.episodes}    !<=    ${agent.reward}`)
    assert(agent.steps == steps, 'agent.step == steps')
    console.log('[      OK ] test_collect_mineral_shards_feature_units')
  }
  try {
    await test_collect_mineral_shards_feature_units()
  } catch (err) {
    console.error(err)
    console.log('[   FAIL  ] test_collect_mineral_shards_feature_units')
  }

  async function test_collect_mineral_shards_raw() {
    console.log('[ RUN     ] test_collect_mineral_shards_raw')
    const kwargs = {
      map_name: 'CollectMineralShards',
      players: [new sc2_env.Agent(Number(sc2_env.Race.terran))],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        action_space: sc2_env.ActionSpace.RAW, // or: use_raw_actions = true,
        use_raw_units: true
      }),
      step_mul: step_mul,
      game_steps_per_episode: steps * step_mul
    }
    let agent
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      agent = new scripted_agent.CollectMineralShardsRaw()
      await run_loop.run_loop([agent], env, steps)
      await testCase.tearDown(true)
    })
    assert(agent.episodes <= agent.reward, `\n agent.episodes <= agent.reward:\n ${agent.episodes}    !<=    ${agent.reward}`)
    assert(agent.steps == steps, 'agent.step == steps')
    console.log('[      OK ] test_collect_mineral_shards_raw')
  }
  try {
    await test_collect_mineral_shards_raw()
  } catch (err) {
    console.error(err)
    console.log('[   FAIL  ] test_collect_mineral_shards_raw')
  }
  async function test_defeat_roaches() {
    console.log('[ RUN     ] test_defeat_roaches')
    const kwargs = {
      map_name: 'DefeatRoaches',
      players: [new sc2_env.Agent(Number(sc2_env.Race.terran))],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(84, 64),
      }),
      step_mul: step_mul,
      game_steps_per_episode: steps * step_mul
    }
    let agent
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      agent = new scripted_agent.DefeatRoaches()
      await run_loop.run_loop([agent], env, steps)
      await testCase.tearDown(true)
    })
    assert(agent.episodes <= agent.reward, `\n agent.episodes <= agent.reward:\n ${agent.episodes}    !<=    ${agent.reward}`)
    assert(agent.steps == steps, `agent.steps == steps:\n  ${agent.steps} !== ${steps}`)
    console.log('[      OK ] test_defeat_roaches')
  }
  try {
    await test_defeat_roaches()
  } catch (err) {
    console.error(err)
    console.log('[   FAIL  ] test_defeat_roaches')
  }

  async function test_defeat_roaches_raw() {
    console.log('[ RUN     ] test_defeat_roaches_raw')
    const kwargs = {
      map_name: 'DefeatRoaches',
      players: [new sc2_env.Agent(Number(sc2_env.Race.terran))],
      agent_interface_format: new sc2_env.AgentInterfaceFormat({
        action_space: sc2_env.ActionSpace.RAW, // or: use_raw_actions = true,
        use_raw_units: true
      }),
      step_mul: step_mul,
      game_steps_per_episode: steps * step_mul * 100
    }
    let agent
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      agent = new scripted_agent.DefeatRoachesRaw()
      await run_loop.run_loop([agent], env, steps)
      await testCase.tearDown(false)
    })
    assert(agent.episodes <= agent.reward, `\n agent.episodes <= agent.reward:\n ${agent.episodes}    !<=    ${agent.reward}`)
    assert(agent.steps == steps, `agent.steps == steps:\n  ${agent.steps} !== ${steps}`)
    console.log('[      OK ] test_defeat_roaches_raw')
  } try {
    await test_defeat_roaches_raw()
  } catch (err) {
    console.error(err)
    console.log('[   FAIL  ] test_defeat_roaches_raw')
  }
}

TestEasy()
