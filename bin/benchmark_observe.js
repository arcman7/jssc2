// Benchmark observation times.
const path = require('path')
const flags = require('flags')
const s2clientprotocol = require('s2clientprotocol')
const { performance } = require('perf_hooks')

const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const replay = require(path.resolve(__dirname, '..', 'lib', 'replay.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { isinstance } = pythonUtils
const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

flags.defineInteger("count", 1000, "How many observations to run.")
flags.defineInteger("step_mul", 16, "How many game steps per observation.")
flags.defineString("replay", null, "Which replay to run.")
flags.defineString("map", "Catalyst", "Which map to run.")

function interface_options(score = false, raw = false, features = null, rgb = null, crop = true) {
  // Get an InterfaceOptions for the config.
  const interfacee = new sc_pb.InterfaceOptions()
  interfacee.setScore(score)
  interfacee.setRaw(raw)
  const featurelayer = new sc_pb.SpatialCameraSetup()
  const ft_resolution = new sc_common.Size2DI()
  const ft_minimapresolution = new sc_common.Size2DI()
  let screen
  let minimap
  if (features) {
    if (isinstance(features, Number)) {
      screen = features
      minimap = features
    } else {
      screen = features[0]
      minimap = features[1]
    }
    ft_resolution.setX(screen)
    ft_resolution.setY(screen)
    ft_minimapresolution.setX(minimap)
    ft_minimapresolution.setY(minimap)
    featurelayer.setWidth(24)
    featurelayer.setResolution(ft_resolution)
    featurelayer.setMinimapResolution(ft_minimapresolution)
    featurelayer.setCropToPlayableArea(crop)
    interfacee.setFeatureLayer(featurelayer)
  }
  const render = new sc_pb.SpatialCameraSetup()
  const ren_resolution = new sc_common.Size2DI()
  const ren_minimapresolution = new sc_common.Size2DI()
  if (rgb) {
    if (isinstance(rgb, Number)) {
      screen = rgb
      minimap = rgb
    } else {
      screen = rgb[0]
      minimap = rgb[1]
    }
    ren_resolution.setX(screen)
    ren_resolution.setY(screen)
    ren_minimapresolution.setX(minimap)
    ren_minimapresolution.setY(minimap)
    render.setResolution(ren_resolution)
    render.setMinimapResolution(ren_minimapresolution)
    interfacee.setRender(render)
  }
  return interfacee
}

const configs = {
  'raw': interface_options(raw = true),
  'raw-feat-48': interface_options(raw = true, features = 48),
  'raw-feat-128': interface_options(raw = true, features = 128),
  'raw-feat-128-48': interface_options(raw = True, features = (128, 48)),
  'feat-32': interface_options(features = 32),
  'feat-48': interface_options(features = 48),
  'feat-72-no-crop': interface_options(features = 72, crop = false),
  'feat-72': interface_options(features = 72),
  'feat-96': interface_options(features = 96),
  'feat-128': interface_options(features = 128),
  'rgb-64': interface_options(rgb = 64),
  'rgb-128': interface_options(rgb = 128),
}



