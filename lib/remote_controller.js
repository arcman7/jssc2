const flags = require('flags') //eslint-disable-line
const Websocket = require('ws') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const path = require('path') //eslint-disable-line
const protocol = require(path.resolve(__dirname, 'protocol.js'))
const stopwatch = require(path.resolve(__dirname, 'stopwatch.js'))
const static_data = require(path.resolve(__dirname, 'static_data.js'))

const { debug_pb, sc2api_pb } = s2clientprotocol
const sc_debug = debug_pb
const sc_pb = sc2api_pb
//eslint-disable-next-line

flags.defineBoolean('sc2_log_actions', false, 'Print all the actions sent to SC2. If you want observations\n as well, consider using `sc2_verbose_protocol`.')
flags.defineInteger('sc2_timeout', 120, 'Timeout to connect and wait for rpc responses.')

// let sw = stopwatch.sw

const Status = protocol.Status

class ConnectError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'ConnectError'
  }
}

class RequestError extends Error {
  constructor(description, res) {
    super(description)
    this.name = 'RequestError'
    this.res = res
  }
}

function check_error(res, error_enum) {
  //Raise if the result has an error, otherwise return the result.//
  if (res && res.hasError()) {
    const enum_name = error_enum.name
    const error_name = error_enum(res.getError()).key

    const details = res.getErrorDetails ? res.getErrorDetails() : '<none>'
    throw new RequestError(`${enum_name}.${error_name},\n\`,
      { error: ${res.getError ? res.getError() : undefined}, error_details: ${details}`)
  }
  if (!res) {
    throw new RequestError('No response.')
  }
  return res
}

function decorate_check_error(error_class_name, error_enum_dict) {
  const error_enum = Enum(error_class_name, error_enum_dict)
  //Decorator to call `check_error` on the return value.//
  function decorator(func) {
    async function _check_error() {
      return check_error(await func(...arguments), error_enum) //eslint-disable-line
    }
    _check_error.name = func.name
    return _check_error
  }
  return decorator
}

function skip_status() {
  const skipped = new Map()
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i] //eslint-disable-line
    skipped.set(arg, arg)
  }
  const self = this
  //Decorator to skip this call if we're in one of the skipped states.//
  function decorator(func) {
    function _skip_status() {
      if (!skipped.has(self.status)) {
        return func(...arguments) //eslint-disable-line
      }
    }
    return _skip_status
  }
  return decorator
}

function valid_status() {
  //Decorator to assert that we're in a valid state.//
  const valid = new Map()
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i] //eslint-disable-line
    valid.set(arg, arg)
  }
  const self = this
  function decorator(func) {
    function _valid_status() {
      if (!valid.has(self.status)) {
        throw new protocol.ProtocolError(`${func.name} called while in state: ${self.status}, valid: ${JSON.stringify(Array.from(valid.keys()))}`)
      }
      return func(...arguments) //eslint-disable-line
    }
    return _valid_status
  }
  return decorator
}

function catch_game_end(func) {
  //Decorator to handle 'Game has already ended' exceptions.//
  const self = this
  function _catch_game_end() {
    //Decorator to handle 'Game has already ended' exceptions.//
    const prev_status = self.status
    try {
      return func(...arguments) //eslint-disable-line
    } catch (protocol_error) {
      if (prev_status === Status.IN_GAME && String(protocol_error).match('Game has already ended')) {
        /*
         It's currently possible for us to receive this error even though
         our previous status was in_game. This shouldn't happen according
         to the protocol. It does happen sometimes when we don't observe on
         every step (possibly also requiring us to be playing against a
         built-in bot). To work around the issue, we catch the exception
         and so let the client code continue.
        */
        console.warn(`Received a 'Game has already ended' error from SC2 whilst status
            in_game. Suppressing the exception, returning None.`)
        return null
      }
      throw protocol_error
    }
  }
  return _catch_game_end
}

class RemoteController {
  /*
  Implements a python interface to interact with the SC2 binary.

  All of these are implemented as blocking calls, so wait for the response
  before returning.

  Many of these functions take a Request* object and respond with the
  corresponding Response* object as returned from SC2. The simpler functions
  take a value and construct the Request itself, or return something more useful
  than a Response* object.
  */
  constructor(host, port, proc = null, timeout_seconds = null, passedSw) {
    // set the stop watch to a specific instance if provided
    this._sw = passedSw || stopwatch.sw
    const sw = this._sw
    flags.parse(null, true)
    timeout_seconds = timeout_seconds || flags.get('sc2_timeout')
    this._connect = sw.decorate(this._connect.bind(this))
    // apply @decorators
    this.create_game = valid_status.call(this, Status.LAUNCHED, Status.ENDED, Status.IN_GAME, Status.IN_REPLAY)(
      decorate_check_error('ResponseCreateGame', sc_pb.ResponseCreateGame.Error)(
        sw.decorate(this.create_game.bind(this))
      )
    )
    this.save_map = valid_status.call(this, Status.LAUNCHED, Status.INIT_GAME)(
      decorate_check_error('ResponseSaveMap', sc_pb.ResponseSaveMap.Error)(
        sw.decorate(this.save_map.bind(this))
      )
    )
    this.join_game = valid_status.call(this, Status.LAUNCHED, Status.INIT_GAME)(
      decorate_check_error('ResponseJoinGame', sc_pb.ResponseJoinGame.Error)(
        sw.decorate(this.join_game.bind(this))
      )
    )
    this.restart = valid_status.call(this, Status.ENDED, Status.IN_GAME)(
      decorate_check_error('ResponseRestartGame', sc_pb.ResponseRestartGame.Error)(
        sw.decorate(this.restart.bind(this))
      )
    )
    this.start_replay = valid_status.call(this, Status.LAUNCHED, Status.ENDED, Status.IN_GAME, Status.IN_REPLAY)(
      decorate_check_error('ResponseStartReplay', sc_pb.ResponseStartReplay.Error)(
        sw.decorate(this.start_replay.bind(this))
      )
    )
    this.game_info = valid_status.call(this, Status.IN_GAME, Status.IN_REPLAY)(
      sw.decorate(this.game_info.bind(this))
    )
    this.data_raw = valid_status.call(this, Status.IN_GAME, Status.IN_REPLAY)(
      sw.decorate(this.data_raw.bind(this))
    )
    this.observe = valid_status.call(this, Status.IN_GAME, Status.IN_REPLAY, Status.ENDED)(
      sw.decorate(this.observe.bind(this))
    )
    this.step = valid_status.call(this, Status.IN_GAME, Status.IN_REPLAY)(
      catch_game_end(
        sw.decorate(this.step.bind(this))
      )
    )
    this.actions = skip_status.call(this, Status.IN_REPLAY)(
      valid_status.call(this, Status.IN_GAME)(
        catch_game_end(
          sw.decorate(this.actions.bind(this))
        )
      )
    )
    this.observer_actions = skip_status.call(this, Status.IN_GAME)(
      valid_status.call(this, Status.IN_REPLAY)(
        sw.decorate(this.observer_actions.bind(this))
      )
    )
    this.leave = valid_status.call(this, Status.IN_GAME, Status.ENDED)(
      sw.decorate(this.leave.bind(this))
    )
    this.save_replay = valid_status.call(this, Status.IN_GAME, Status.IN_REPLAY, Status.ENDED)(
      sw.decorate(this.save_replay.bind(this))
    )
    this.debug = valid_status.call(this, Status.IN_GAME)(
      sw.decorate(this.debug.bind(this))
    )
    this.query = valid_status.call(this, Status.IN_GAME, Status.IN_REPLAY)(
      sw.decorate(this.query.bind(this))
    )
    this.quit = skip_status.call(this, Status.QUIT)(
      sw.decorate(this.quit.bind(this))
    )
    this.ping = sw.decorate(this.ping.bind(this))
    this.replay_info = decorate_check_error('ResponseReplayInfo', sc_pb.ResponseReplayInfo.Error)(
      sw.decorate(this.replay_info.bind(this))
    )
    this._last_obs = null
    /** must call from factory  _setClientConnection() **/
  }

  async _setClientConnection(host, port, proc, timeout_seconds, passedSw) {
    timeout_seconds = timeout_seconds || flags.get('sc2_timeout')
    const sock = await this._connect(host, port, proc, timeout_seconds)
    this._client = new protocol.StarcraftProtocol(sock, passedSw)
    await this.ping()
    return true
  }

  async _connect(host, port, proc, timeout_seconds) { //eslint-disable-line
    timeout_seconds = Number(timeout_seconds)
    const milisecond = 1000
    //Connect to the websocket, retrying as needed. Returns the socket.//
    if (host.match(':') && host[0] !== '[') { // Support ipv6 addresses.
      host = `[${host}]`
    }
    async function sleep(time) {
      const prom = new Promise((res) => {
        setTimeout(res, time)
      })
      return prom
    }
    const url = `ws://${host}:${port}/sc2api`
    let was_running = false
    let resolve
    let ws
    let returnedConnection = null
    let i = 0
    while (i < timeout_seconds) {
      const is_running = proc && !proc._hasExited
      was_running = was_running || is_running
      if ((i >= Math.floor(timeout_seconds / 4) || was_running) && !is_running) {
        console.warn('SC2 isn\'t running, so bailing early on the websocket connection.')
        throw new ConnectError('Failed to connect to the SC2 websocket. Is it up?')
      }
      console.info(`Connecting to : ${url}, attempt: ${i}, running: ${is_running}`)
      function clear() { //eslint-disable-line
        clearTimeout(ws.pingTimeout);
        resolve(null)
      }
      function finish() { //eslint-disable-line
        resolve(ws)
      }
      const pendingConnection = new Promise((res) => { //eslint-disable-line
        resolve = res
        setTimeout(() => {
          resolve(null)
        }, 6 * milisecond)
      })
      try {
        ws = new Websocket(url)
        // function heartbeat() { //eslint-disable-line
        //   clearTimeout(ws.pingTimeout);
        //   // Use `WebSocket#terminate()`, which immediately destroys the connection,
        //   // instead of `WebSocket#close()`, which waits for the close timer.
        //   // Delay should be equal to the interval at which your server
        //   // sends out pings plus a conservative assumption of the latency.
        //   ws.pingTimeout = setTimeout(() => {
        //     ws.terminate()
        //   }, 10 * milisecond)
        // }
        ws.on('open', finish)
        // ws.on('open', heartbeat)
        // ws.on('ping', heartbeat)

        ws.on('close', clear)
        ws.on('error', clear)
        returnedConnection = await pendingConnection //eslint-disable-line no-await-in-loop
        if (returnedConnection !== null) {
          return returnedConnection
        }
      } catch (err) {
        // TODO: handle various error types
        // socket.error: SC2 hasn't started listening yet.
        if (err.status_code === 404) {
          console.log('inside catch', err)
          // SC2 is listening, but hasn't set up the /sc2api endpoint yet.
        } else {
          console.error(err)
          throw err
        }
      } finally {
        await sleep(6 * milisecond) //eslint-disable-line no-await-in-loop
        i++
      }
    }
    throw new ConnectError('Failed to connect to the SC2 websocket. Is it up?')
  }

  close() {
    return this._client.close()
  }

  get status_ended() {
    return this.status == protocol.Status.ENDED
  }

  create_game(req_create_game) {
    //Create a new game. This can only be done by the host.//
    return this._client.send({ create_game: req_create_game })
  }

  save_map(map_path, map_data) {
    //Save a map into temp dir so create game can access it in multiplayer.//
    const saveReq = new sc_pb.RequestSaveMap()
    saveReq.setMapPath(map_path)
    saveReq.setMapData(map_data)
    return this._client.send({ save_map: saveReq })
  }

  join_game(req_join_game) {
    //Join a game, done by all connected clients.//
    return this._client.send({ join_game: req_join_game })
  }

  restart() {
    //Restart the game. Only done by the host.//
    return this._client.send({ restart_game: new sc_pb.RequestRestartGame() })
  }

  start_replay(req_start_replay) {
    //Start a replay.//
    return this._client.send({ start_replay: req_start_replay })
  }

  game_info() {
    //Get the basic information about the game.//
    return this._client.send({ game_info: new sc_pb.RequestGameInfo() })
  }

  data_raw(ability_id = true, unit_type_id = true, upgrade_id = true, buff_id = true, effect_id = true) {
    //Get the raw static data for the current game. Prefer `data` instead.//
    const req = new sc_pb.RequestData()
    req.setAbilityId(ability_id)
    req.setUnitTypeId(unit_type_id)
    req.setUpgradeId(upgrade_id)
    req.setBuffId(buff_id)
    req.setEffectId(effect_id)
    return this._client.send({ data: req })
  }

  async data() {
    //Get the static data for the current game.//
    const reqData = await this.data_raw()
    return new static_data.StaticData(reqData.toObject())
  }

  async observe(disable_fog = false, target_game_loop = 0) {
    //Get a current observation.//
    const req = new sc_pb.RequestObservation()
    req.setGameLoop(target_game_loop)
    req.setDisableFog(disable_fog)
    let obs = await this._client.send({ observation: req })

    if (obs.getObservation().getGameLoop() == (2 ** 32 - 1)) {
      console.info('Received stub observation.')

      if (!obs.getPlayerResultList()) {
        throw Error('Expect a player result in a stub observation')
      } else if (this._last_obs == null) {
        throw Error('Received stub observation with no previous obs')
      }

      // Rather than handling empty obs through the code, regurgitate the last
      // observation (+ player result, sub actions).
      const new_obs = this._last_obs.cloneMessage()
      new_obs.clearActionsList()
      new_obs.setActionsList(obs.getActionsList())
      obs.getPlayerResultList().forEach((pr) => {
        new_obs.addPlayerResult(pr)
      })
      obs = new_obs
      this._last_obs = null
    } else {
      this._last_obs = obs
    }

    if (flags.get('sc2_log_actions') && obs.getActionsList()) {
      process.stderr.write(' Executed actions '.center(60, '<') + '\n')
      obs.getActionsList().forEach((act) => {
        process.stderr.write(act.toObject())
      })
    }

    return obs
  }

  available_maps() {
    return this._client.send({ available_maps: new sc_pb.RequestAvailableMaps() })
  }

  step(count = 1) {
    //Step the engine forward by one (or more) step.//
    const req = new sc_pb.RequestStep()
    req.setCount(count)
    return this._client.send({ step: req })
  }

  actions(req_action) {
    //Send a `sc_pb.RequestAction`, which may include multiple actions.//
    if (flags.get('sc2_log_actions') && req_action.getActionsList().length) {
      process.stderr.write(' Sending observer actions '.center(60, '>') + '\n')
      const acts = req_action.getActionsList()
      acts.forEach((act) => {
        process.stderr.write(act.toObject())
      })
    }
    return this._client.send({ action: req_action })
  }

  act(action) {
    //Send a single action. This is a shortcut for `actions`.//
    if (action && Object.keys(action.toObject()).length) { // Skip no-ops.
      const req = new sc_pb.RequestAction()
      req.addActions(action)
      return this.actions(req)
    }
  }

  observer_actions(req_observer_action) {
    //Send a `sc_pb.RequestObserverAction`.
    if (flags.get('sc2_log_actions') && req_observer_action.getActionsList()) {
      process.stderr.write(' Sending observer actions '.center(60, ">") + "\n")
      const acts = req_observer_action.getActionsList()
      acts.forEach((action) => {
        process.stderr.write(action.toObject())
      })
    }
    return this._client.send({ obs_action: req_observer_action })
  }

  observer_act(action) {
    //Send a single observer action. A shortcut for `observer_actions`.//
    if (action && Object.keys(action.toObject()).length) { // skip no-ops
      const req = new sc_pb.RequestObserverAction()
      req.addActions(action)
      return this.observer_actions(req)
    }
  }

  chat(message, channel = sc_pb.ActionChat.Channel.BROADCAST) {
    //Send chat message as a broadcast.//
    if (message) {
      const action_chat = new sc_pb.ActionChat()
      action_chat.setChannel(channel)
      action_chat.setMessage(message)
      const action = new sc_pb.Action()
      action.setActionChat(action_chat)
      return this.act(action)
    }
  }

  leave() {
    //Disconnect from a multiplayer game.//
    return this._client.send({
      leave_game: new sc_pb.RequestLeaveGame()
    })
  }

  async save_replay() {
    //Save a replay, returning the data.//
    const res = await this._client.send({ save_replay: new sc_pb.RequestSaveReplay() })
    return res.getData()
  }

  debug(debug_commands) {
    //Run a debug command//
    const debugReq = new sc_pb.RequestDebug()
    if (debug_commands instanceof sc_debug.DebugCommand) {
      debugReq.setDebugList([debug_commands])
    } else if (Array.isArray(debug_commands)) {
      debugReq.setDebugList(debug_commands)
    } else {
      throw new Error(`debug_commands an instance of sc_debug.DebugCommand got instead:\n ${debug_commands}`)
    }
    return this._client.send({ debug: debugReq })
  }

  query(query) {
    //Query the game state.//
    return this._client.send({ query })
  }

  quit() {
    //Shut down the SC2 process.//
    try {
      // Don't expect a response.
      const req = new sc_pb.Request()
      req.setQuit(new sc_pb.RequestQuit())
      req.setId(999999999)
      this._client.write(req)
    } catch (err) {
      if (err instanceof protocol.ConnectionError) {
        // It's likely already (shutting) down, so continue as if it worked.
      } else {
        throw err
      }
    } finally {
      return this.close()
    }
  }

  ping() {
    return this._client.send({ ping: new sc_pb.RequestPing() })
  }

  replay_info(replay_data) {
    const replay_info = new sc_pb.RequestReplayInfo()
    replay_info.setReplayData(replay_data)
    return this._client.send({
      replay_info
    })
  }

  get status() {
    return this._client.status
  }
}

async function RemoteControllerFactory(host, port, proc, timeout_seconds, passedSw) {
  const rm = new RemoteController(host, port, proc, timeout_seconds, passedSw)
  await rm._setClientConnection(host, port, proc, timeout_seconds, passedSw)
  return rm
}

module.exports = {
  RemoteController,
  RemoteControllerFactory,
  Status,
}
