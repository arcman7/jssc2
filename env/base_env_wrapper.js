const path = require('path')
const environment = require(path.resolve(__dirname, './environment.js'))
/*A base env wrapper so we don't need to override everything every time.*/
class BaseEnvWrapper extends environment.Base {
  /*A base env wrapper so we don't need to override everything every time.*/
  constructor(env) {
    super(env)
    this._env = env
  }

  close() {
    return this._env.close(...arguments)
  }

  action_spec() {
    return this._env.action_spec(...arguments)
  }

  observation_spec() {
    return this._env.observation_spec(...arguments)
  }

  reset() {
    return this._env.reset(...arguments)
  }

  step() {
    return this._env.step(...arguments)
  }

  save_replay() {
    return this._env.save_replay(...arguments)
  }

  get state() {
    return this._env.state
  }
}

module.exports = {
  BaseEnvWrapper
}
