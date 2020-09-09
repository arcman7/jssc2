const net = require('net') //eslint-disable-line
const dgram = require('dgram') //eslint-disable-line
const crypto = require('crypto') //eslint-disable-line
const binascii = require('binascii') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const path = require('path') //eslint-disable-line
const run_config = require(path.resolve(__dirname, '..')) //eslint-disable-line
const sc2_env = require(path.resolve(__dirname, 'sc2_env.js')) //eslint-disable-line
const features = require(path.resolve(__dirname, '..', 'lib', 'feature.js')) //eslint-disable-line
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js')) //eslint-disable-line

/*
A Starcraft II environment for playing LAN games vs humans.

Check pysc2/bin/play_vs_agent.py for documentation.
*/

/*eslint-disable no-await-in-loop*/
/*eslint-disable no-use-before-define*/

const { namedtuple } = pythonUtils
const { sc2api_pb } = s2clientprotocol
const sc_pb = sc2api_pb

class Addr extends namedtuple("Addr", ["ip", "port"]) {
  toString() {
    const ip = this.ip.includes(':') ? `[${this.ip}]` : this.ip
    return `${ip}:${this.port}`
  }
}

async function read_socket(socket) {
  const prom = new Promise((resolve, reject) => {
    // we dont know what type of socket it is so we
    // listen for both types of events
    socket.addEventListener('data', (data) => {
      resolve(data)
    })
    socket.addEventListener('message', (msg) => {
      resolve(msg)
    })
    socket.addEventListener('error', reject)
  })
  return prom
}

//returns promise that resolves in a bound udp socket
function udp_server(addr) {
  let sock
  if (addr.ip.includes(':')) {
    sock = dgram.createSocket('udp4')
  } else {
    sock = dgram.createSocket('udp6')
  }
  const prom = new Promise((resolve) => {
    sock.bind(addr, resolve)
  })
  return prom
}

const window = this
async function tcp_server(tcp_addr, settings) {
  //Start up the tcp server, send the settings.

  // node determines whether or not to use ipv4 vs ipv6
  // based on the format of the address passed in the
  // options to the listen method
  const sock = net.createServer((c) => {
    // 'connection' listener.
    console.info('client connected')
    c.on('end', () => {
      console.info('client disconnected')
    })
    // c.write('hello\r\n')
    // c.pipe(c)
  })
  const prom = new Promise((resolve) => {
    sock.listen({
      port: tcp_addr.port,
      host: tcp_addr.ip,
    }, (connection) => {
      console.log('from sock.listen callback')
      console.log(connection)
      window.test = connection
      resolve(connection)
    })
  })
  const conn = await prom
  const { address } = conn._socket.address()
  console.info(`Accepted connection from $${address}`)
  // Send map_data independently
  await write_tcp(conn, settings['map_data'])
  const send_settings = {}
  Object.keys(settings).forEach((k) => {
    if (k === 'map_data') {
      return
    }
    send_settings[k] = settings[k]
  })
  console.debug(`settings: ${send_settings}`)
  await write_tcp(conn, JSON.stringify(send_settings))
  return conn
}

async function tcp_client(tcp_addr) {
  //Connect to the tcp server, and return the settings.//
  console.info(`Connecting to :${tcp_addr}, ${0}`)
  let sock
  const prom = new Promise((resolve) => {
    sock = net.connect(tcp_addr.port, tcp_addr.host, resolve)
  })
  await prom
  console.info('Connected')
  const map_data = await read_tcp(sock)
  const settings_str = await read_tcp(sock)
  if (!settings_str) {
    throw new Error('Failed to read socket.')
  }
  const settings = JSON.parse(settings_str)
  console.debug(`Got settings. map_name: ${settings['map_name']}`)
  settings['map_data'] = map_data
  return { sock, settings }
}

function log_msg(prefix, msg) {
  const md5sum = crypto.createHash('md5')
  md5sum.update(new Buffer(msg, 'utf8')) //eslint-disable-line
  const md5val = md5sum.digest('hex');
  console.debug(`${prefix}: len: ${msg.length}, hash: ${md5val.slice(0, 6)}, ${binascii.hexlify(msg.slice(0, 25))}`)
}

async function udp_to_tcp(udp_sock, tcp_conn) {
  let msg
  while (true) {
    msg = await read_socket(udp_sock)
    console.log('udp_to_tcp: msg = ', msg)
    log_msg('read_udp', msg)
    if (!msg) {
      return
    }
    await write_tcp(tcp_conn, msg)
  }
}

async function tcp_to_udp(tcp_conn, udp_sock, udp_to_addr) {
  let msg
  while (true) {
    msg = await read_tcp(tcp_conn)
    if (!msg) {
      return
    }
    log_msg('write_udp', msg)
    udp_sock.send(msg, 0, msg.length, udp_to_addr.port, udp_to_addr.host)
  }
}

function read_tcp(conn) {
  //Read `size` number of bytes from `conn`, retrying as needed.//
  const chunks = []
  const bytes_read = 0
  let chunk
  while (bytes_read < size) {
    chunk = conn.re
  }
}

function read_tcp_size(conn, size) {

}

function write_tcp(conn, msg) {

}

function forward_ports(remote_host, local_host, local_listen_ports, remote_listen_ports) {

}

module.exports = {
  Addr,
  forward_ports,
  log_msg,
  read_tcp,
  read_tcp_size,
  tcp_server,
  tcp_client,
  write_tcp,
  udp_server,
  udp_to_tcp,
}
