// Test that multiplayer works independently of the SC2Env.

const path = require('path')
const s2clientprotocol = require('s2clientprotocol')
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const point = require(path.resolve(__dirname, '..', 'lib', 'point.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const utils = require(path.resolve(__dirname, './utils.js'))
const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb
const spatial_pb = s2clientprotocol.spatial_pb

const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { assert, zip } = pythonUtils

function print_stage(stage) {
  console.info(` ${stage} `.center(80, '-'))
}

async function TestMultiplayer() {
  const testCase = new utils.TestCase()
  testCase.setUp()

  async function test_multi_player() {
    console.log('[ RUN      ] TestMultiplayer.test_multi_player')
    const players = 2
    const run_config = run_configs.get()
    const map_inst = maps.get('Simple64')

    const screen_size_px = new point.Point(64, 64)
    const minimap_size_px = new point.Point(32, 32)
    const interfacee = new sc_pb.InterfaceOptions()
    const feature_layer = new sc_pb.SpatialCameraSetup()
    feature_layer.setResolution(new sc_pb.Size2DI())
    feature_layer.setMinimapResolution(new sc_pb.Size2DI())
    interfacee.setFeatureLayer(feature_layer)
    screen_size_px.assign_to(interfacee.getFeatureLayer().getResolution())
    minimap_size_px.assign_to(interfacee.getFeatureLayer().getMinimapResolution())
    const proc_ports = await portspicker.pick_unused_ports(players)
    // Reserve a whole bunch of ports for the weird multiplayer implementation.
    const ports = await portspicker.pick_unused_ports(players * 2)

    console.info(`Valid Ports: ${ports}`)

    // Actually launch the game processes.
    print_stage('start')
    let sc2_procs = []
    for (let i = 0; i < players; i += 1) {
      sc2_procs.push(run_config.start({
        port: proc_ports.pop(),
        want_rgb: false
      }))
    }
    sc2_procs = await Promise.all(sc2_procs)
    const controllers = []
    sc2_procs.forEach((p) => {
      controllers.push(p.controller)
    })

    try {
      // Save the maps so they can access it.
      const map_path = path.basename(map_inst.path)
      print_stage('save_map')
      for (let i = 0; i < controllers.length; i += 1) { //Skip parallel due to a race condition on Windows.
        const c = controllers[i]
        await c.save_map(map_path, map_inst.data(run_config))
      }

      // Create the create request.
      const create = new sc_pb.RequestCreateGame()
      const localmap = new sc_pb.LocalMap()
      localmap.setMapPath(map_path)
      create.setLocalMap(localmap)
      for (let i = 0; i < players; i += 1) {
        const playersetup = new sc_pb.PlayerSetup()
        playersetup.setType(sc_pb.PlayerType.PARTICIPANT)
        create.addPlayerSetup(playersetup)
      }

      // Create the join request.
      const join = new sc_pb.RequestJoinGame()
      join.setRace(sc_common.Race.RANDOM)
      join.setOptions(interfacee)
      join.setSharedPort(0)
      const serverport = new sc_pb.PortSet()
      serverport.setGamePort(ports[0])
      serverport.setBasePort(ports[1])
      join.setServerPorts(serverport)
      const clientport = new sc_pb.PortSet()
      clientport.setGamePort(ports[2])
      clientport.setBasePort(ports[3])
      join.addClientPorts(clientport)

      // Play a few short games.
      for (let _ = 0; _ < 2; _ += 1) { //2 episodes
        // Create and Join
        print_stage('create')
        await controllers[0].create_game(create)
        print_stage('join')
        await Promise.all(controllers.map((c) => c.join_game(join)))

        print_stage('run')
        for (let game_loop = 1; game_loop < 10; game_loop += 1) { //steps per episode
          // Step the game
          await Promise.all(controllers.map((c) => c.step()))

          // Observe
          const obs = await Promise.all(controllers.map((c) => c.observe()))
          obs.forEach((o, p_id) => {
            assert(o.getObservation().getGameLoop() == game_loop, 'o.observation.game_loop == game_loop')
            assert(o.getObservation().getPlayerCommon().getPlayerId() == p_id + 1, 'o.observation.player_common.player_id == p_id + 1')
          })

          // Act
          const actions = []
          for (let i = 0; i < players; i += 1) {
            actions.push(new sc_pb.Action())
          }
          actions.forEach((action) => {
            const pt = point.Point.unit_rand().mul(minimap_size_px).floor()
            const actionfeaturelayer = new sc_pb.ActionSpatial()
            const cammove = new sc_pb.ActionSpatialCameraMove()
            cammove.setCenterMinimap(new sc_pb.PointI())
            actionfeaturelayer.setCameraMove(cammove)
            action.setActionFeatureLayer(actionfeaturelayer)
            pt.assign_to(action.getActionFeatureLayer().getCameraMove().getCenterMinimap())
          })
          await Promise.all(zip(controllers, actions).map(([c, a]) => c.act(a)))
        }
        // Done this game.
        print_stage('leave')
        await Promise.all(controllers.map((c) => c.leave()))
      }
    } finally {
      print_stage('quit')
      // Done, shut down. Don't depend on parallel since it might be broken.
      await Promise.all(controllers.map((c) => c.quit()))
      await Promise.all(sc2_procs.map((p) => p.close()))
      await portspicker.return_ports(ports)
    }
    await testCase.tearDown()
    console.log('[       OK ] TestMultiplayer.test_multi_player')
  }
  try {
    await test_multi_player()
  } catch (err) {
    console.error(err)
    console.log('[  FAILED  ] TestMultiplayer.test_multi_player')
  }
}

TestMultiplayer()
