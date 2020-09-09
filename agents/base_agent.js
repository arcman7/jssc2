const path = require('path') //eslint-disable-line
const actions = require(path.resolve(__dirname, '..', 'lib', './actions.js'))

class BaseAgent {
  /*
  A base agent to write custom scripted agents.
  It can also act as a passive agent that does nothing but no-ops.
  */
  constructor() {
    this.reward = 0
    this.episodes = 0
    this.steps = 0
    this.obs_spec = null
    this.action_spec = null
  }

  setup(obs_spec, action_spec) {
    this.obs_spec = obs_spec
    this.action_spec = action_spec
  }

  reset() {
    this.episodes += 1
  }

  step(obs) {
    this.steps += 1
    this.reward += obs.reward
    return new actions.FunctionCall(actions.FUNCTIONS.no_op_id, [])
  }
}

module.exports = {
  BaseAgent
}
