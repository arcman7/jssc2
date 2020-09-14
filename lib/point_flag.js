// Define a flag type for points.
const flags = require('flags')
const path = require('path')
const point = require(path.resolve(__dirname, './point.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))
const { isinstance, ValueError } = pythonUtils

// Let absl.flags know that DEFINE_point should show up in the caller's module.
// flags.disclaim_key_flags()

class PointParser {
  // Parse a flag into a pysc2.lib.point.Point.

  static parse(argument) {
    if (!argument || argument == '0') {
      return null
    }
    let args
    if (isinstance(argument, Number)) {
      args = [argument]
    } else if (isinstance(argument, Object)) {
      args = argument
    } else if (isinstance(argument, String)) {
      args = argument.split(',')
    } else {
      throw ValueError(`Invalid point: ${argument}. Valid: '<int>' or '<int>,<int>'.`)
    }

    args = args.map((v) => {
      return parseInt(v)
    })

    if (args.length == 1) {
      args.forEach((v) => args.push(v))
    }
    if (args.length == 2) {
      return point.Point(args[0], args[1])
    }
    throw ValueError(`Invalid point: ${argument}. Valid: '<int>' or '<int>,<int>'.`)
  }

  static flag_type() {
    return 'pysc2.lib.point.Point'
  }
}

class PointSerializer {
  // Custom serializer for pysc2.lib.point.Point.
  static serialize(value) {
    return String(value)
  }
}

function DEFINE_point(name, defaultt, help_string, flag_values , args) {
  // Registers a flag whose value parses as a point.

  // flags.DEFINE(PointParser(), name, default, help_string, flag_values,PointSerializer(), **args)
}

module.exports = {
  PointParser,
  PointSerializer,
  DEFINE_point,
}
