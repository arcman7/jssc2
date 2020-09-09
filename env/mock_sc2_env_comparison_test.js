const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const mock_sc2_env = require(path.resolve(__dirname, './mock_sc2_env.js'))
const sc2_env = require(path.resolve(__dirname, './sc2_env.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { arrayCompare, compareObsSpec, zip } = pythonUtils

/*Tests that mock environment has same shape outputs as true environment.*/

let env
let mock_env
async function tearDown() {
  await env.close()
  await mock_env.close()
}

async function TestCompareEnvironments() {
  const start = performance.now()
  async function setUpEnv() {
    const players = [
      new sc2_env.Agent(Number(sc2_env.Race.terran)),
      new sc2_env.Agent(Number(sc2_env.Race.protoss)),
    ]
    const kwargs = {
      map_name: 'Flat64',
      players,
      'agent_interface_format': [
        new sc2_env.AgentInterfaceFormat({
          feature_dimensions: new sc2_env.Dimensions(
            [32, 64],
            [8, 16]
          ),
          rgb_dimensions: new sc2_env.Dimensions(
            [31, 63],
            [7, 15]
          ),
          action_space: sc2_env.ActionSpace.FEATURES,
        }),
        new sc2_env.AgentInterfaceFormat({
          rgb_dimensions: new sc2_env.Dimensions(64, 32)
        }),
      ]
    }

    // env = new sc2_env.SC2Env(kwargs)
    // await env._setUpGame()
    env = await sc2_env.SC2EnvFactory(kwargs)
    mock_env = new mock_sc2_env.SC2TestEnv(kwargs)
  }

  await setUpEnv()

  async function test_observation_spec() {
    console.log('running test_observation_spec')
    const env_ob_spec = env.observation_spec()
    const mock_ob_spec = mock_env.observation_spec()
    compareObsSpec(env_ob_spec, mock_ob_spec)
  }
  await test_observation_spec()

  async function test_action_spec() {
    console.log('running test_action_spec')
    zip(env.action_spec(), mock_env.action_spec()).forEach(([a, b]) => {
      if (!arrayCompare(a, b)) {
        throw new Error(`${a} != ${b}`)
      }
    })
  }
  await test_action_spec()
  await tearDown()
  console.log('took: ', ((performance.now() - start) / 1000).toFixed(2), ' seconds')
}

TestCompareEnvironments()
