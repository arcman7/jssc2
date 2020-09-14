// Print the list of available maps according to the game.

const path = require('path')
const flags = require('flags')

const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))

async function main(kwargs) {
  kwargs.want_rgb = false
  const controller = await run_configs.get().start(kwargs)
  const available_maps = controller.available_maps()
  console.log('\n')
  console.log('Local map paths:')
  available_maps.local_map_paths.sort().forEach((m) => {
    console.log(' ', m)
  })
  console.log()
  console.log('Battle.net maps:')
  available_maps.battlenet_map_names.sort().forEach((m) => {
    console.log(' ', m)
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
