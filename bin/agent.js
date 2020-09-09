// Run an agent.
const path = require('path')
const flags = require('flags')
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_loop = require(path.resolve(__dirname, '..', 'env', 'run_loop.js'))
const available_actions_printer = require(path.resolve(__dirname, '..', 'env', 'available_actions_printer.js'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { withPythonAsync } =pythonUtils

function run_thread(agent_classes, players, map_name, visualize) {
  const kwargs = {
    map_name: map_name,
    battle_net_map: 
  }
}