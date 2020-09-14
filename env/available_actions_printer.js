const path = require('path') //eslint-disable-line
const base_env_wrapper = require(path.resolve(__dirname, './base_env_wrapper.js'))
/*An env wrapper to print the available actions.*/
class AvailableActionsPrinter extends base_env_wrapper.BaseEnvWrapper {
  /*An env wrapper to print the available actions.*/
  constructor(env) {
    super(env)
    this._seen = new Set()
    this._action_spec = this._action_spec()[0]
  }

  step() {
    const all_obs = super.step(...arguments) //eslint-disable-line
    Object.keys(all_obs).forEach((key) => {
      const obs = all_obs[key]
      Object.keys(obs.observation["available_actions"]).forEach((key1) => {
        const avail = obs.observation["available_actions"][key1]
        if (!(this._seen.has(avail))) {
          this._seen.add(avail)
          this._print(this._action_spec.functions[avail].str(true))
        }
      })
    })
    return all_obs
  }

  _print(s) { //eslint-disable-line
    console.log(s)
  }
}

module.exports = {
  AvailableActionsPrinter
}
