const path = require('path') //eslint-disable-line
const { spawn } = require('child_process') //eslint-disable-line
const http = require('http') //eslint-disable-line
const url = require('url') //eslint-disable-line
const protobuf = require('protobufjs') //eslint-disable-line
const WebSocket = require('ws') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const portspicker = require(path.resolve(__dirname, '..', 'portspicker.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'pythonUtils.js'))
const gfile = require(path.resolve(__dirname, '..', 'gfile.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'stopwatch.js'))
const remote_controller = require(path.resolve(__dirname, '..', './remote_controller.js'))
// const video_writter = require(path.resolve(__dirname, '..', './video_writer.js'))
const { performance } = require('perf_hooks') //eslint-disable-line

const sc_pb = s2clientprotocol.sc2api_pb

// const sc_error = s2clientprotocol.error_pb
// const sc_raw = s2clientprotocol.raw_pb
// const spatial = s2clientprotocol.spatial_pb
// const sc_ui = s2clientprotocol.ui_pb

const { withPython } = pythonUtils

// const ActionCmd = Enum.IntEnum('ActionCmd', {
//   STEP: 1,
//   RESTART: 2,
//   QUIT: 3,
// })

async function sleep(time) {
  const prom = new Promise((res) => {
    setTimeout(res, time)
  })
  return prom
}

class WsServer {
  constructor({ port, host = '127.0.0.1' }) {
    this.port = port
    this.host = host
    this._sw = stopwatch.sw
    this._connections = []
  }

  write(ws, request) {
    //Actually serialize and write the request.//
    let request_str
    withPython(this._sw('serialize_request'), () => {
      request_str = request.serializeBinary()
    })
    withPython(this._sw('write_request'), () => {
      try { //eslint-disable-line
        ws.send(request_str)
      } catch (err) {
        /* TODO: Handling of different error types
            raise ConnectionError("Connection already closed. SC2 probably crashed. "
              "Check the error log.")
            except websocket.WebSocketTimeoutException:
              raise ConnectionError("Websocket timed out.")
            except socket.error as e:
              raise ConnectionError("Socket error: %s" % e)
        */
        throw err
      }
      // console.log('sent request!')
    })
  }

  broadcast(request) {
    this._connections.forEach((ws) => this.write(ws, request))
  }

  async init(callback) {
    const self = this
    withPython(this._sw('WsInit'), async () => {
      const port = self.port || await (portspicker.pick_unused_ports(1))[0]
      const host = self.host
      const wss = new WebSocket.Server({ port, host })
      wss.on('connection', function connection(ws) {
        console.log('WebSocket server connection initialized.')
        /*
          Each time a client connects to the websocket server
          the same calllback get's registered to it's message event

          Routing a message back to the correct client connection
          is gaurenteed since the callback is invoked with the
          client connection that sent the message
        */
        self._connections.push(ws)
        ws.on('message', (message) => { callback(ws, message) })
      })
      self._wss = wss
    })
  }
}

class GameLoop {
  constructor(run_config, controller, wss) {
    this._run_config = run_config
    this._controller = controller
    this._wss = wss
    this._sw = stopwatch.sw
    this._game_loop_running = false
  }

  save_replay(run_config, controller) {
    if (controller.status == remote_controller.Status.in_game || controller.status == remote_controller.Status.ended) {
      const prefix = path.basename(this._game_info.local_map_path).split('.')[0]
      const replay_path = run_config.save_replay(controller.save_replay(), 'local', prefix)
      console.log('Wrote replay to: ', replay_path)
    }
  }

  async _routeMessage(ws, data) {
    let message
    withPython(this._sw('parse_message'), () => {
      console.log(data)
      message = sc_pb.Request.deserializeBinary(data)
    })
    if (message.hasObservation()) {
      console.log('backend: starting observations steam')
      if (this._game_loop_running) {
        return
      }
      this.run({ run_config: this._run_config, controller: this._controller })
    } else if (message.hasAction()) {
      console.log('backend: requesting action')
      this._controller.send({ action: message.getAction() })
    } else if (message.hasGameInfo()) {
      console.log('backend: requesting GameInfo')
      if (this._game_info) {
        this._wss.write(ws, this._game_info)
        return
      }
      const response = new sc_pb.Response()
      response.setGameInfo(await this._controller.game_info())
      this._game_info = response
      this._wss.write(ws, response)
    } else if (message.hasData()) {
      console.log('backend: requesting Data')
      if (this._data) {
        this._wss.write(ws, this._data)
        return
      }
      const response = new sc_pb.Response()
      response.setData(await this._controller.data_raw())
      this._data = response
      this._wss.write(ws, response)
    } else if (message.hasSaveReplay()) {
      console.log('backend: requesting save replay')
      this.save_replay()
    } else if (message.hasObservation()) {
      console.log('backend: starting observations steam')
      if (this._game_loop_running) {
        return
      }
      this.run({ run_config: this._run_config, controller: this._controller })
    }
  }

  async run({ run_config, controller, max_game_steps = 0, max_episodes = 0, game_steps_per_episode = 0, save_replay = false, step_mul = 1, fps = 22.4 }) {
    //Run loop that gets observations, renders them, and sends back actions.//
    /* eslint-disable no-await-in-loop */
    this._fps = fps
    this._step_mul = step_mul
    this._game_steps_per_episode = game_steps_per_episode
    this._max_episodes = max_episodes
    const is_replay = controller.status == remote_controller.Status.in_replay
    let total_game_steps = 0
    const start_time = performance.now()
    let num_episodes = 0
    let episode_steps
    try {
      while (true) {
        this._game_loop_running = true
        episode_steps = 0
        num_episodes += 1

        while (true) {
          total_game_steps += this._step_mul
          episode_steps += this._step_mul
          console.log('episode_steps: ', episode_steps)
          const frame_start_time = performance.now()

          const obs = await controller.observe()
          const response = new sc_pb.Response()
          response.setObservation(obs)
          this._wss.broadcast(response)
          if (obs.getPlayerResultList().length) {
            console.log('getPlayerResultList')
            break
          }

          // const cmd = this.get_actions(run_config, controller)
          // if (cmd == ActionCmd.STEP) {
          //   // do nothing
          // } else if (cmd == ActionCmd.QUIT) {
          //   if (!is_replay && save_replay) {
          //     await this.save_replay(run_config, controller)
          //   }
          //   return
          // } else if (cmd == ActionCmd.RESTART) {
          //   break
          // } else {
          //   throw new Error(`Unexpected command: ${cmd}`)
          // }

          await controller.step(this._step_mul)

          if (max_game_steps && total_game_steps >= max_game_steps) {
            if (!is_replay && save_replay) {
              await this.save_replay(run_config, controller)
            }
            console.log('max_game_steps && total_game_steps >= max_game_steps')
            return
          }
          if (game_steps_per_episode && episode_steps >= game_steps_per_episode) {
            console.log('game_steps_per_episode && episode_steps >= game_steps_per_episode')
            break
          }
          await withPython(this._sw("sleep"), async () => { //eslint-disable-line
            const elapsed_time = performance.now() - frame_start_time
            // await sleep(1000)
            await sleep(200)
            // console.log('sleeping', (1000 / this._fps) - elapsed_time, 'elapsed_time: ', elapsed_time)
            // await sleep(Math.max(0, (1000 / this._fps) - elapsed_time))
          })
        }

        if (is_replay) {
          console.log('is_replay')
          break
        }
        if (save_replay) {
          await this.save_replay(run_config, controller)
        }
        if (max_episodes && num_episodes >= max_episodes) {
          console.log('max_episodes && num_episodes >= max_episodes')
          break
        }
        console.log('Restarting')
        await controller.restart()
      }
    } catch (err) {
      console.error(err)
    } finally {
      this._game_loop_running = false
      this.close()
      const elapsed_time = performance.now() - start_time
      console.log(`took ${Math.round(elapsed_time / 1000)} seconds for ${total_game_steps} steps: ${total_game_steps / elapsed_time} fps`)
    }
  }
}

class InitalizeServices {
  constructor() {
    // this.chromeArgs = ['C:\\Program Files (x86)\\Google\\Chrome\\Application\\Chrome.exe', '-incognito', '--new-window', '--auto-open-devtools-for-tabs', 'http://127.0.0.1:']
    this.chromeArgs = ['C:\\Program Files (x86)\\Google\\Chrome\\Application\\Chrome.exe', '--auto-open-devtools-for-tabs', 'http://127.0.0.1:']

    if (process.platform === 'darwin') { //eslint-disable-next-line
      this.chromeArgs[0] = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome'
    }
    this.browserFilePath = '/renderer_human/browser_client.html'
    this.websocketServer = null
  }

  async setUp(run_config, controller) {
    const [p1, p2] = await portspicker.pick_unused_ports(2)
    this.wsPort = p1
    this.httpPort = p2
    this.websocketServer = new WsServer({ port: this.wsPort })
    this.gameLoop = new GameLoop(run_config, controller, this.websocketServer)
    await this.websocketServer.init(this.gameLoop._routeMessage.bind(this.gameLoop))
    await this.startLocalHostServer()
    // launch browser with websocket server port embedded as a url param
    const fullUrl = this.chromeArgs.pop() + this.httpPort + this.browserFilePath + '?port=' + this.wsPort
    this.fullUrl = fullUrl
    this.chromeArgs.push(fullUrl)
    this.launchChrome()
    return true
  }

  startLocalHostServer() {
    this.httpServer = http.createServer((request, response) => {
      const reqPath = url.parse(request.url, true).pathname;

      if (request.method === 'GET') {
        if (reqPath === this.browserFilePath) {
          response.writeHead(200, { 'Content-Type': 'text/html' })
          const data = gfile.Open(path.resolve(__dirname, 'browser_client.html'), { encoding: 'utf8' })
          response.end(data, 'utf-8')
        } else if (reqPath === '/renderer_human/bundle.js') {
          response.writeHead(200, { 'Content-Type': 'application/javascript' })
          const data = gfile.Open(path.resolve(__dirname, 'bundle.js'), { encoding: 'utf8' })
          response.end(data, 'utf-8')
        } else if (reqPath === '/renderer_human/gamejs-2.0.3-pre-min.js') {
          response.writeHead(200, { 'Content-Type': 'application/javascript' })
          const data = gfile.Open(path.resolve(__dirname, 'gamejs-2.0.3-pre-min.js'), { encoding: 'utf8' })
          response.end(data, 'utf-8')
        } else if (reqPath === '/renderer_human/s2clientprotocol.min.js') {
          response.writeHead(200, { 'Content-Type': 'application/javascript' })
          const data = gfile.Open(path.resolve(__dirname, 's2clientprotocol.min.js'), { encoding: 'utf8' })
          response.end(data, 'utf-8')
        } else if (reqPath === '/renderer_human/bundle_json.json') {
          response.writeHead(200, { 'Content-Type': 'application/json' })
          const data = gfile.Open(path.resolve(__dirname, 'bundle_json.json'), { encoding: 'utf8' })
          response.end(data, 'utf-8')
        } else if (reqPath === '/tensorflow-wasm.wasm') {
          // TODO: serve tensorflow wasm binary
        } else {
          response.end('404')
        }
      }
    })
    this.httpServer.listen(this.httpPort, () => {
      console.log('server listening at port ', this.httpPort, 'at:\n', this.fullUrl)
    })
  }

  launchChrome() {
    const launchString = this.chromeArgs.shift()
    this._proc = spawn(launchString, this.chromeArgs)
  }
}

module.exports = {
  GameLoop,
  WsServer,
  InitalizeServices
}
