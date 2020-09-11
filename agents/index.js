const path = require('path')

const base_agent = require(path.resolve(__dirname, './base_agent.js'))
const random_agent = require(path.resolve(__dirname, './random_agent.js'))
const scripted_agent = require(path.resolve(__dirname, './scripted_agent.js'))

module.exports = {
  base_agent,
  random_agent,
  scripted_agent,
}
