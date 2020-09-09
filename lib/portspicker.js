const path = require('path') //eslint-disable-line
const getPort = require('get-port') //eslint-disable-line
const { ValueError } = require(path.resolve(__dirname, './pythonUtils.js'))

// The set of ports returned by pick_contiguous_unused_ports and not by
// the underlying portpicker.
// const _contiguous_ports = new Set() // only used by return_ports

async function pick_unused_ports(num_ports, retry_interval_secs = 1, retry_attempts = 5, ports = [], isInRecursiveCall = false, resolve = null, reject = null) {
  let prom
  if (!isInRecursiveCall) { // if we're in the top level call
    prom = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
  }
  if (num_ports <= 0) {
    throw new ValueError(`Number of ports, must be >= 1, got : ${num_ports}`)
  }
  const arr = []
  for (let i = 0; i < num_ports - ports.length; i++) {
    arr.push(getPort())
  }
  ports = ports.concat((await Promise.all(arr)).filter((p) => Number.isInteger(p)))
  const portsSet = new Set(ports)
  if (ports.length === num_ports && portsSet.size === ports.length) {
    resolve(ports)
    return prom
  }
  // didnt get enough ports and out of retries
  if (retry_attempts < 1) {
    reject(new ValueError((`Unable to obtain ${num_ports} unused ports.`)))
    return prom
  }
  setTimeout(() => {
    pick_unused_ports(num_ports, retry_interval_secs, retry_attempts - 1, ports, true, resolve, reject)
  }, retry_interval_secs * 1000)
  return prom
}

async function getExactPort(port) {
  const usedPort = await getPort({ port })
  if (port === usedPort) {
    return port
  }
  throw new ValueError(`Port: ${port} not availible.`)
}
async function pick_contiguous_unused_ports(num_ports, retry_interval_secs = 1, retry_attempts = 5) {
  if (num_ports <= 0) {
    throw new ValueError(`Number of ports, must be >= 1, got : ${num_ports}`)
  }
  const startingPort = (await pick_unused_ports(1))[0]
  if (num_ports === 1) {
    return [startingPort]
  }
  let ports = []
  for (let i = 1; i < num_ports; i++) {
    ports.push(getExactPort(startingPort + i))
  }
  try {
    ports = await Promise.all(ports)
    ports.unshift(startingPort)
    return ports
  } catch (err) {
    if (retry_attempts < 1) {
      throw err
    }
    return pick_contiguous_unused_ports(num_ports, retry_interval_secs, retry_attempts - 1)
  }
}

function return_ports(ports) { //eslint-disable-line
  // frees up whatever ports are passed in ports
  // TODO
}

module.exports = {
  pick_unused_ports,
  pick_contiguous_unused_ports,
  return_ports,
}
