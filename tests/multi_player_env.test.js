const path = require('path') //eslint-disable-line
const random_agent = require(path.resolve(__dirname, '..', 'agents', 'random_agent.js'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const utils = require(path.resolve(__dirname, '..', 'tests', 'utils.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js')) //eslint-disable-line
// Test that the multiplayer environment works.

const { withPythonAsync } = pythonUtils
const testCase = new utils.TestCase()

async function TestMultiplayerEnv() {
  console.log('TestMultiplayerEnv: ')
  const steps = 100
  const step_mul = 16
  const numPlayers = 2

  async function test_multi_player_env_features () {
    console.log('   test_multi_player_env_features')
    testCase.setUp()
    const players = [new sc2_env.Agent(Number(sc2_env.Race.random), 'random'), new sc2_env.Agent(Number(sc2_env.Race.random), 'random')]

    const kwargs = {
      map_name: 'Simple64',
      players,
      step_mul,
      game_steps_per_episode: Math.floor((steps * step_mul) / 2),
      'agent_interface_format': new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(84, 64)
      })
    }

    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      const agents = []
      for (let i = 0; i < numPlayers; i++) {
        agents.push(new random_agent.RandomAgent())
      }
      await run_loop.run_loop(agents, env, steps)
      await testCase.tearDown()
    })
  }
  await test_multi_player_env_features()

  async function test_multi_player_env_rgb () {
    console.log('   test_multi_player_env_rgb')
    testCase.setUp()
    const players = [new sc2_env.Agent(Number(sc2_env.Race.random), 'random'), new sc2_env.Agent(Number(sc2_env.Race.random), 'random')]

    const kwargs = {
      map_name: 'Simple64',
      players,
      step_mul,
      game_steps_per_episode: Math.floor((steps * step_mul) / 2),
      'agent_interface_format': new sc2_env.AgentInterfaceFormat({
        rgb_dimensions: new sc2_env.Dimensions(84, 64)
      })
    }

    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      const agents = []
      for (let i = 0; i < numPlayers; i++) {
        agents.push(new random_agent.RandomAgent())
      }
      await run_loop.run_loop(agents, env, steps)
      await testCase.tearDown()
    })
  }
  await test_multi_player_env_rgb()

  async function test_multi_player_env_features_and_rgb () {
    console.log('   test_multi_player_env_features_and_rgb')
    testCase.setUp()
    const players = [new sc2_env.Agent(Number(sc2_env.Race.random), 'random'), new sc2_env.Agent(Number(sc2_env.Race.random), 'random')]

    const kwargs = {
      map_name: 'Simple64',
      players,
      step_mul,
      game_steps_per_episode: Math.floor((steps * step_mul) / 2),
      'agent_interface_format': [new sc2_env.AgentInterfaceFormat({
        feature_dimensions: new sc2_env.Dimensions(84, 64)
      }), new sc2_env.AgentInterfaceFormat({
        rgb_dimensions: new sc2_env.Dimensions(128, 32)
      })]
    }

    // const env = await sc2_env.SC2EnvFactory(kwargs)
    await withPythonAsync(sc2_env.SC2EnvFactory(kwargs), async (env) => {
      const agents = []
      for (let i = 0; i < numPlayers; i++) {
        agents.push(new random_agent.RandomAgent())
      }
      await run_loop.run_loop(agents, env, steps)
      await testCase.tearDown()
    })
  }
  await test_multi_player_env_features_and_rgb()
}

TestMultiplayerEnv()
