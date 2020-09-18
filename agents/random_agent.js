const path = require('path'); //eslint-disable-line
const base_agent = require(path.resolve(__dirname, './base_agent.js'))
const actions = require(path.resolve(__dirname, '..', 'lib', './actions.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', './pythonUtils.js'))
const { randomChoice } = pythonUtils

class RandomAgent extends base_agent.BaseAgent {
  // A random agent for starcraft. //
  step(obs) {
    super.step(obs)
    const function_id = randomChoice(obs.observation.available_actions)
    const args = []
    this.action_spec.functions[function_id].args.forEach((arg) => {
      args.push(arg.sizes.map((size) => { //eslint-disable-line
        return Math.floor(Math.random() * size)
      }))
    })
    return new actions.FunctionCall(function_id, args)
  }
}

module.exports = {
  RandomAgent
}
