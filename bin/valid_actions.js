// Print the valid actions.
const path = require('path')
const flags = require('flags')

const actions = require(path.resolve(__dirname, '..', 'lib', 'actions.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))

point_flag.DEFINE_point("screen_size", "84", "Resolution for screen actions.")
point_flag.DEFINE_point("minimap_size", "64", "Resolution for minimap actions.")
flags.defineBoolean("hide_specific", false, "Hide the specific actions")

function main() {
  // Print the valid actions.
  const agentinterfaceformat = new features.AgentInterfaceFormat({
    feature_dimensions: new features.Dimensions(flags.get('screen_size'), flags.get('minimap_size'))
  })
  const feats = new features.Features(agentinterfaceformat)
  const action_spec = feats.action_spec()
  let flattened = 0
  let count = 0
  action_spec.functions.forEach((func) => {
    if (flags.get('hide_specific') && actions.FUNCTIONS[func.id].general_id !== 0) {
      return
    }
    count += 1
    let act_flat = 1
    func.args.forEach((arg) => {
      arg.sizes.forEach((size) => {
        act_flat *= size
      })
    })
    flattened += act_flat
    console.log(func.str(true))
  })
  console.log('Total base actions: ', count)
  console.log('Total possible actions (flattened): ', flattened)
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
