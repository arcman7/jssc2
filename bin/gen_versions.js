// Generate the list of versions for run_configs.
const path = require('path')
const flags = require('flags')
const fetch = require('node-fetch')

// raw version of:
// https://github.com/Blizzard/s2client-proto/blob/master/buildinfo/versions.json

const VERSIONS_FILE = "https://raw.githubusercontent.com/Blizzard/s2client-proto/master/buildinfo/versions.json"

function count(str, condition) {
  let ncount = 0
  for (let i = 0; i < str.length; i += 1) {
    if (str[i] == condition) {
      ncount += 1
    }
  }
  return ncount
}

function main(argv) {
  argv = null
  const versions = fetch(VERSIONS_FILE)
  versions.then((ver) => ver.json()).then((v) => {
    for (let i = 0; i < v.length; i += 1) {
      let version_str = v[i]['label']
      if (count(version_str, '.') == 1) {
        version_str += '.0'
      }
      console.log(`    Version('${version_str}', '${v[i]['base-version']}', '${v[i]['data-hash']}', None`)
    }
  })
}

flags.defineBool('m', false, 'treat file as module')
flags.parse()
if (flags.get('m')) {
  module.exports = {
    main,
  }
} else {
  main()
}
