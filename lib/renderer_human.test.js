const path = require('path') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const backend = require(path.resolve(__dirname, 'renderer_human', 'backend.js'))
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
// const pythonUtils = require(path.resolve(__dirname, 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, 'portspicker.js'))

const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

async function test() {
  const run_config = run_configs.get()
  const port = (await portspicker.pick_unused_ports(1))[0]

  const sc_process = await run_config.start({ want_rgb: false, port })
  const controller = sc_process._controller
  const map_inst = maps.get('Simple64')
  const create = new sc_pb.RequestCreateGame()
  create.setRealtime(false)
  create.setDisableFog(false)
  const localMap = new sc_pb.LocalMap()
  localMap.setMapPath(map_inst.path)
  create.setLocalMap(localMap)

  let playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
  create.addPlayerSetup(playerSetup)
  create.getLocalMap().setMapData(this._map_data)
  playerSetup = new sc_pb.PlayerSetup()
  playerSetup.setType(sc_pb.PlayerType.COMPUTER)
  playerSetup.setRace(sc_common.Race.RANDOM)
  playerSetup.setDifficulty(sc_pb.Difficulty.VERYHARD)
  create.addPlayerSetup(playerSetup)

  const join = new sc_pb.RequestJoinGame()
  join.setRace(sc_common.Race.RANDOM)
  const Interface = new sc_pb.InterfaceOptions()
  Interface.setRaw(true)
  Interface.setScore(true)
  const featureLayer = new sc_pb.SpatialCameraSetup()
  featureLayer.setWidth(24)
  featureLayer.setCropToPlayableArea(true)
  featureLayer.setAllowCheatingLayers(true)
  let resolution = new sc_pb.Size2DI()
  resolution.setX(256)
  resolution.setY(256)
  featureLayer.setResolution(resolution)
  let minimapResolution = new sc_pb.Size2DI()
  minimapResolution.setX(64)
  minimapResolution.setY(64)
  featureLayer.setMinimapResolution(minimapResolution)
  Interface.setFeatureLayer(featureLayer)
  const render = new sc_pb.SpatialCameraSetup()
  resolution = new sc_pb.Size2DI()
  resolution.setX(256)
  resolution.setY(256)
  render.setResolution(resolution)
  minimapResolution = new sc_pb.Size2DI()
  minimapResolution.setX(64)
  minimapResolution.setY(64)
  render.setMinimapResolution(minimapResolution)
  Interface.setRender(render)
  join.setOptions(Interface)

  await controller.create_game(create)
  await controller.join_game(join)

  const services = new backend.InitalizeServices()
  services.setUp(run_config, controller)
}

test()
