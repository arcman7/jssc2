const path = require('path') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const websocket = require('ws') //eslint-disable-line
const flags = require('flags') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const stopwatch = require(path.resolve(__dirname, 'stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))

/*** Protocol library to make communication easy ***

All communication over the connection is based around Request and Response messages. Requests are used for controlling the state of the application, retrieving data and controlling gameplay.

The data sent into the game must be exactly a series of protobuf defined “Request” objects. The data sent back from the game will be exactly a series of protobuf defined “Response” objects, whose type exactly matches the order of incoming “Request” objects.

You are allowed to send additional requests before receiving a response to an earlier request. Requests will be queued and processed in received order. Keeping the request queue saturated is best for optimal performance.

*/
const { sc2api_pb } = s2clientprotocol
const sc_pb = sc2api_pb
const { assert, snakeToPascal, withPython } = pythonUtils

flags.defineInteger('sc2_verbose_protocol', 0, `
  Print the communication packets with SC2. 0 disables.
  -1 means all. >0 will print that many lines per 
  'packet. 20 is a good starting value.`
) //eslint-disable-line

// Create a python version of the Status enum in the proto.
const Status = Enum.Enum('Status', sc_pb.Status)

const MAX_WIDTH = Number(process.env.COLUMNS) || 200 // Get your TTY width.

class ConnectionError extends Error {
  //Failed to read/write a message, details in the error string.//
  constructor(msg) {
    super(msg)
    this.name = 'ConnectionError'
  }
}
class ProtocolError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'ProtocolError'
  }
}
// function catch_websocket_connection_errors() {
//   //A context manager that translates websocket errors into ConnectionError.//

//   /* not sure we need this in javascript */
// }
class StarcraftProtocol {
  constructor(ws, passedSw) {
    // set the stop watch to a specific instance if provided
    this._sw = passedSw || stopwatch.sw
    const sw = this._sw
    flags.parse(null, true)
    this._status = Status.LAUNCHED
    this._sock = ws._socket
    this._port = this._sock.address().port
    this._ws = ws
    this._count = 0
    // apply @decoraters
    this.read = sw.decorate(this.read.bind(this))
    this.write = sw.decorate(this.write.bind(this))
    // set up sync-like read
    this._trigger = null
    this._que = []
    this._ws.on('message', (response) => {
      if (!response) {
        throw new ProtocolError('Got an empty response from SC2.')
      }
      if (this._trigger) {
        this._trigger(response)
        this._trigger = null
        return
      }
      this._que.push(response)
    })
  }

  get status() {
    return this._status
  }

  next() {
    const val = this._count
    this._count += 1
    return val
  }

  close() {
    if (this._sock) {
      this._ws.terminate()
      this._ws = null
      this._sock = null
    }
    this._status = Status.QUIT
  }

  async read() {
    //Read a Response, do some validation, and return it.//
    let start
    if (flags.get('sc2_verbose_protocol')) {
      this._log(`-------------- [${this._port}] Reading response --------------`)
      // performance.now() => measured in milliseconds.
      start = performance.now() * 1000
    }
    const response = await this._read()
    if (flags.get('sc2_verbose_protocol')) {
      this._log(`-------------- [${this._port}] Read ${response.getResponseCase()} in ${performance.now() * 1000 - start} msec --------------\n${this._packet_str(response)}`)
    }
    if (response.getStatus && !response.getStatus()) {
      throw new ProtocolError('Got an incomplete response without a status')
    }
    const prev_status = this._status
    this._status = Status(response.getStatus())
    if (response.hasError && response.hasError() && response.getError()) {
    // if (response.getError && response.getError()) {
      const err_str = `Error in RPC response (likely a bug).\n Prev status: ${prev_status}, new status: ${this._status} \n ${response.getError()}`
      this._log(err_str)
      throw new ProtocolError(err_str)
    }
    return response
  }

  write(request) {
    //Write a Request.//
    if (flags.get('sc2_verbose_protocol')) {
      const printObj = request.toObject()
      if (printObj.saveMap && printObj.saveMap.mapData) {
        printObj.saveMap.mapData = `<buffer ${printObj.saveMap.mapData.length} bytes>`
      }
      if (printObj.startReplay && printObj.startReplay.mapData) {
        printObj.startReplay.mapData = `<buffer ${printObj.startReplay.mapData.length} bytes>`
        printObj.startReplay.replayData = `<buffer ${printObj.startReplay.replayData.length} bytes>`
      }
      this._log(`-------------- [${this._port}] Writing request: ${JSON.stringify(printObj)} --------------\n${this._packet_str(request)}`)
    }
    this._write(request)
  }

  async send_req(request) {
    //Write a pre-filled Request and return the Response.//
    this.write(request) //eslint-disable-next-line
    return await this.read() // written this way to keep control flow same as python
  }

  async send(kwargs) {
    /*
    Create and send a specific request, and return the response.

    For example: send(ping=sc_pb.RequestPing()) => sc_pb.ResponsePing

    Args:
      **kwargs: A single kwarg with the name and value to fill in to Request.

    Returns:
      The Response corresponding to your request.
    Raises:
      ConnectionError: if it gets a different response.
    */
    const names = Object.keys(kwargs)
    assert(names.length === 1, 'Must make a single request')
    let name = names[0]
    const val = kwargs[name]
    const req = new sc_pb.Request() // init proto req class
    name = snakeToPascal(name)
    const isList = Array.isArray(val)
    // proto setters: setFoo, setFooList
    req[`set${name + (isList ? 'List' : '')}`](val)
    req.setId(this.next())
    let res
    try {
      res = await this.send_req(req)
    } catch (err) {
      console.warn('PORT: ', this._port, '\nreq:\n', req.toObject(), '\nres:\n', res ? res.toObject() : 'undefined')
      throw new ConnectionError(`Error during ${name}: ${err}`)
    }
    if (res.hasId() && res.getId && res.getId() !== req.getId()) {
      const reqObj = req.toObject()
      Object.keys(reqObj).forEach((key) => {
        if (key.match('data') && reqObj[key]) {
          reqObj[key] = `<data ${reqObj[key].length}>`
        }
      })
      console.warn('PORT: ', this._port, '\nreq:\n', reqObj, '\nres:\n', res ? res.toObject() : 'undefined')
      throw new ConnectionError(`Error during ${name}: Got a response with a different id\n expected: ${req.getId()}, got: ${res.getId()}`)
    }

    // proto getters: getFoo, getFooList
    return res[`get${name + (isList ? 'List' : '')}`]()
  }

  _packet_str(packet) { //eslint-disable-line
    //Return a string form of this packet.//
    const max_lines = flags.get('sc2_verbose_protocol')
    const packet_str = String(packet).trim()
    if (max_lines <= 0) {
      return packet_str
    }
    let lines = packet_str.split('\n')
    const line_count = lines.length
    lines = lines.slice(0, max_lines + 1).map((line) => line.slice(0, MAX_WIDTH))
    if (line_count > max_lines + 1) { // +1 to prefer the last line to skipped msg.
      lines.push(`***** ${line_count - max_lines} lines skipped *****`)
    }
    return lines.join('\n')
  }

  _log(s) { //eslint-disable-line
    const args = []
    for (let i = 1; i < arguments.length; i++) {
      args.push(arguments[i]) //eslint-disable-line
    }
    process.stderr.write(s + '\n' + args)
    // process.stderr.clearScreenDown() // js equivalent of flush, unsure if we need it though
  }

  async _read() {
    //Actually read the response and parse it, returning a Response.//
    // let response = await withPythonAsync(this._sw('read_response'), async () => {
    let response = await withPython(this._sw('read_response'), async () => {
      if (this._que.length) {
        return this._que.shift()
      }
      return new Promise((resolve) => { this._trigger = resolve })
    })
    withPython(this._sw('parse_response'), () => {
      response = sc_pb.Response.deserializeBinary(response)
    })
    return response
  }

  _write(request) {
    //Actually serialize and write the request.//
    let request_str
    withPython(this._sw('serialize_request'), () => {
      request_str = request.serializeBinary()
    })
    withPython(this._sw('write_request'), () => {
      try { //eslint-disable-line
        this._ws.send(request_str)
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
    })
  }
}

module.exports = {
  ConnectionError,
  ProtocolError,
  StarcraftProtocol,
  Status,
}
