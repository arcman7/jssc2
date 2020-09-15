const { fork } = require('child_process')

function _shutdown_proc(p, timeout) {
  //Wait for a proc to shut down, then terminate or kill it after `timeout`.//
  const freq = 10 // how often to check per second
  let resolve
  const prom = new Promise((res) => {
    resolve = res
  })
  let _ = 1
  const killTimer = setInterval(() => {
    // const ret = p.kill('SIGTERM ') //not supported on windows
    const ret = p.kill()
    if (ret) {
      clearInterval(killTimer)
      console.info('Shutdown gracefully.')
      resolve(ret)
    }
    _ += 1
    if (_ >= ((timeout * freq) + 1)) {
      clearInterval(killTimer)
      console.warn('Killing the process.')
      resolve(p.kill('SIGKILL'))
      // resolve(p.kill('SIGINT')) // possibly a better alternative, as it supposedly kills grandchild processes created by the child process as well
    }
  }, (1 / freq) * 1000)
  return prom
}

class ThreadWrapper {
  constructor(file_path, timeout = 100) {
    const f = fork(file_path)
    this._fork = f
    this.ready = false
    this.timeout = timeout
    const self = this
    let resolve
    let reject
    const prom = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    let timer
    if (timeout) {
      timer = setTimeout(timeout, reject)
    }
    function listenReady(msg) {
      // console.log('listenStart: ', msg)
      console.log('listenReady: ', msg)
      if (msg === 'ready') {
        resolve(self)
      }
      self.fork.off('message', listenReady)
      if (timer) {
        clearTimeout(timer)
      }
    }
    if (timer) {
      timer = setTimeout(() => {
        reject(`waiting for thread to be ready, timed out after ${timeout} ms.`)
      }, timeout)
    }
    this._fork.on('message', listenReady)
    this.ready = prom
  }

  start(kwargs) {
    const self = this
    let resolve
    let reject
    const prom = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    let timer
    function listenStart(msg) {
      if (msg === 'started') {
        resolve(self)
      }
      self.fork.off('message', listenStart)
      if (timer) {
        clearTimeout(timer)
      }
    }
    this._send('start', kwargs)
    this._fork.on('message', listenStart)
    if (this.timeout) {
      timer = setTimeout(() => {
        reject(`start request timed out after ${this.timeout} ms.`)
      }, this.timeout)
    }
    return prom
  }

  _send(command, data) {
    this._fork.send(JSON.stringify({ message: command, data }))
  }

  async _shutdown() {
    //Terminate the sub-process.//
    if (!this._fork) {
      return
    }
    const ret = await _shutdown_proc(this._fork, 3) //eslint-disable-line
    console.info(`Shutdown with return code: ${ret}`)
    this._proc = null
  }

  close() {
    return this._shutdown()
  }

  status() {//eslint-disable-line
  }

  getUpdate() {//eslint-disable-line
  }

  streamUpdates() {//eslint-disable-line
  }
}

module.exports = {
  ThreadWrapper
}
