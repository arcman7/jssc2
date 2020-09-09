const path = require('path') //eslint-disable-line
const flags = require('flags') //eslint-disable-line
const lib = require(path.resolve(__dirname, './lib.js'))
const platform = require(path.resolve(__dirname, './platforms.js'))
const sc_process = require(path.resolve(__dirname, '..', 'lib', 'sc_process.js'))

let defaultVal = null
if (process.platform === 'win32') {
  defaultVal = 'Windows'
} else if (process.platform === 'cygwin') {
  defaultVal = 'Cygwin'
} else if (process.platform === 'darwin') {
  defaultVal = 'MacOS'
} else if (process.platform == 'linux') {
  defaultVal = 'Linux'
}

flags.defineString('sc2_run_config', defaultVal, 'Which run_config to use to spawn the binary.')

function get(version = null) {
  //Get the config chosen by the flags.//
  flags.parse(null, true)
  let configs
  lib.RunConfig.all_subclasses().forEach((c) => {
    if (c.priority()) {
      configs = {}
      configs[c.name] = c
    }
  })
  if (!configs) {
    throw new sc_process.SC2LaunchError('No valid run_configs found.')
  }
  if (flags.get('sc2_run_config') === null && flags.get('sc2_run_config') === 'null') {
    // Find the highest priority as default.
    const highest = Object.keys(configs).sort((kA, kB) => (configs[kB].priority() || 0) - (configs[kA].priority() || 0))[0]
    return new configs[highest](version)
  }
  try {
    return new configs[flags.get('sc2_run_config')](version)
  } catch (error) {
    throw new sc_process.SC2LaunchError(`Invalid run_config. Valid configs are: ${Object.keys(configs).sort().join(',')}.\n error: ${error}`)
  }
}

module.exports = {
  lib,
  'get': get,
  platform,
}
