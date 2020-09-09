const path = require('path') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const { assert, sequentialTaskQueue, withPythonAsync } = pythonUtils //eslint-disable-line

const sc_common = s2clientprotocol.common_pb
const sc_pb = s2clientprotocol.sc2api_pb

function major_version(v = '') {
  return v.split('.').slice(0, 2).join('.')
}

function log_center(s) { //eslint-disable-next-line
  console.info(` ${s} ${Array.from(arguments).slice(1)}`.center(80, '-'))
}

async function main() {
  async function test_version_numbers() { //eslint-disable-line
    let run_config = run_configs.get()
    const failures = []
    const versions = run_config.get_versions()
    const keys = Object.keys(versions)
    const ports = await portspicker.pick_unused_ports(keys.length)
    for (let i = 0; i < keys.length; i++) {
      const game_version = keys[i]
      const version = versions[game_version]
      let proc = null
      try {
        assert(game_version == version.game_version, 'game_version == version.game_version')
        log_center(`starting version check: ${game_version}`)
        run_config = run_configs.get(game_version)
        const port = ports[i]
        //eslint-disable-next-line
        await withPythonAsync(run_config.start({ want_rgb: false, port }), async (controller) => {
          proc = controller
          if (!controller) {
            console.log('controller: ', controller)
          }
          const ping = (await controller.ping()).toObject()
          console.info(`expected:\n  game_version:${version.game_version}\n  data_verion: ${version.data_version}\n  build_version: ${version.build_version}`)
          console.info('actual: ', ping)
          assert(version.build_version == ping.baseBuild, 'version.build_version == ping.base_build')
          if (version.game_version !== 'latest') {
            assert(major_version(ping.gameVersion) === major_version(version.game_version), `\nmajor_version(ping.gameVersion === major_version(version.game_version):\n ${major_version(ping.gameVersion)} !== ${major_version(version.game_version)}`)
            assert(version.data_version.toLowerCase() === ping.dataVersion.toLowerCase(), `\nversion.data_version.toLowerCase() === ping.dataVersion.toLowerCase()\n ${version.data_version.toLowerCase()} !== ${ping.dataVersion.toLowerCase()}`)
          }
        })
        log_center(`success: ${game_version}`)
      } catch (err) {
        if (proc) {
          console.log('calling proc.close() [sc_process]')
          await proc.close()
        }
        log_center(`failure: ${game_version}`)
        console.error('Failed\nerror:', err)
        // earliest binary version that would be present but not valid
        if (game_version !== '3.16.0') {
          failures.push(game_version)
        }
      }
    }
    assert(failures.length === 0, 'expected failures to be empty')
  }
  try {
    console.log('[ RUN      ] TestVersions.test_version_numbers')
    await test_version_numbers()
    console.log('[      OK ] TestVersions.test_version_numbers')
  } catch (err) {
    console.error(err)
    console.log('[  FAILED  ] TestVersions.test_version_numbers')
  }

  async function test_versions_create_game() { //eslint-disable-line
    let run_config = run_configs.get()
    const failures = []
    const versions = run_config.get_versions()
    const keys = Object.keys(versions)
    const tasks = []
    for (let i = 0; i < keys.length; i++) {
      const game_version = keys[i]
      log_center(`starting create game: ${game_version}`)
      run_config = run_configs.get(game_version)
      let sc_process
      tasks.push(async () => { //eslint-disable-line
        try {
          const port = (await portspicker.pick_unused_ports(1))[0]
          sc_process = await run_config.start({ want_rgb: false, port })
          const controller = sc_process._controller
          const Interface = new sc_pb.InterfaceOptions()
          Interface.setRaw(true)
          Interface.setScore(true)
          const featureLayer = new sc_pb.SpatialCameraSetup()
          featureLayer.setWidth(24)
          const resolution = new sc_pb.Size2DI()
          resolution.setX(84)
          resolution.setY(84)
          featureLayer.setResolution(resolution)
          const minimapResolution = new sc_pb.Size2DI()
          minimapResolution.setX(64)
          minimapResolution.setY(64)
          featureLayer.setMinimapResolution(minimapResolution)
          Interface.setFeatureLayer(featureLayer)

          const map_inst = maps.get('Simple64')
          const create = new sc_pb.RequestCreateGame()
          const localMap = new sc_pb.LocalMap()
          localMap.setMapPath(map_inst.path)
          localMap.setMapData(map_inst.data(run_config))
          create.setLocalMap(localMap)
          let playerSetup = new sc_pb.PlayerSetup()
          playerSetup.setType(sc_pb.PlayerType.PARTICIPANT)
          create.addPlayerSetup(playerSetup)
          playerSetup = new sc_pb.PlayerSetup()
          playerSetup.setType(sc_pb.PlayerType.COMPUTER)
          playerSetup.setRace(sc_common.Race.PROTOSS)
          playerSetup.setDifficulty(sc_pb.Difficulty.VERYEASY)
          create.addPlayerSetup(playerSetup)

          const join = new sc_pb.RequestJoinGame()
          join.setRace(sc_common.Race.TERRAN)
          join.setOptions(Interface)

          await controller.create_game(create)
          await controller.join_game(join)
          const tempTasks = []
          for (let _ = 0; _ < 5; _++) {
            tempTasks.push(async () => {
              await controller.step(16)
              await controller.observe()
            })
          }
          await sequentialTaskQueue(tempTasks)
          log_center(`success: ${game_version}`)
        } catch (err) {
          log_center(`failure: ${game_version}`)
          console.error('Failed\nerror:', err)
          // earliest binary version that would be present but not valid
          if (game_version !== '3.16.0') {
            failures.push(game_version)
          }
        } finally {
          sc_process.close()
        }
      })
    }
    await sequentialTaskQueue(tasks)
    assert(failures.length === 0, 'failures to be empty')
  }
  try {
    console.log('[ RUN      ] TestVersions.test_versions_create_game')
    await test_versions_create_game()
    console.log('[      OK ] TestVersions.test_versions_create_game')
  } catch (err) {
    console.error(err)
    console.log('[  FAILED  ] TestVersions.test_versions_create_game')
  }
}

main()
