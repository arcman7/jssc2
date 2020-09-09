const path = require('path') //eslint-disable-line
const mpyq = require('empeeku') //eslint-disable-line
const run_configs_lib = require(path.resolve(__dirname, '..', 'run_configs', 'lib.js'))

function get_replay_version(replay_data) {
  const archive = mpyq.MPQArchive(replay_data)
  // const metadata = archive(new Buffer('replay.gamemetadata.json', 'utf8'))
  // buffer.toString('utf8')
  let metadata = archive('replay.gamemetadata.json')
  metadata = JSON.parse(metadata)
  const game_version = metadata['GameVersion'].split('.').slice(0, -1)
  const build_version = Number(metadata['BaseBuild'].slice(4))
  const data_version = metadata['DataVersion'] // Only in replays version 4.1+.
  const binary = null
  return run_configs_lib.Version(
    game_version,
    build_version,
    data_version,
    binary,
  )
}

module.exports = {
  get_replay_version,
}
