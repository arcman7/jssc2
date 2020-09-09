const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { zip } = pythonUtils

// A run loop for agent/environment interaction.
/*eslint-disable no-await-in-loop*/
async function run_loop(agents, env, max_frames = 0, max_episodes = 0) {
  // A run loop to have agents and an environment interact.
  let total_frames = 0
  let total_episodes = 0
  const start_time = performance.now() / 1000

  const observation_spec = env.observation_spec()
  const action_spec = env.action_spec()

  zip(agents, observation_spec, action_spec).forEach(([agent, obs_spec, act_spec]) => {
    agent.setup(obs_spec, act_spec)
  })

  try {
    while (!(max_episodes) || total_episodes < max_episodes) {
      total_episodes += 1
      let timesteps = await env.reset()
      agents.forEach((a) => {
        a.reset()
      })
      // console.log("starting episode loop ", total_episodes)
      while (true) {
        total_frames += 1
        // console.log('       starting step: ', total_frames)
        const actions = zip(agents, timesteps).map(([agent, timestep]) => agent.step(timestep))
        if (max_frames && total_frames >= max_frames) {
          // console.log('       max_frames && total_frames >= max_frame RETURN')
          return
        }
        if (timesteps[0].last()) {
          // console.log('       timesteps[0].last() BREAK')
          break
        }
        timesteps = await env.step(actions)
      }
    }
  } catch (err) {
    //If keyboard interrupt do nothing
    console.error(err)
  } finally {
    const elapsed_time = (performance.now() / 1000) - start_time
    const frame_ratio = total_frames / elapsed_time
    console.log("Took", elapsed_time.toFixed(3), "seconds for", total_frames, "steps:", frame_ratio.toFixed(3), "fps")
  }
  return true
}

module.exports = {
  run_loop
}
