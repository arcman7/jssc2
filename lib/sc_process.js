const { spawn } = require('child_process') //eslint-disable-line
const path = require('path') //eslint-disable-line
const fs = require('fs') //eslint-disable-line
const rimraf = require('rimraf') //eslint-disable-line
const getPort = require('get-port') //eslint-disable-line
const flags = require('flags') //eslint-disable-line
const tempfile = require('tempy') //eslint-disable-line
const remote_controller = require(path.resolve(__dirname, './remote_controller.js'))
const stopwatch = require(path.resolve(__dirname, './stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))
const { platform } = process
const { Array, withPython } = pythonUtils //eslint-disable-line
flags.defineBoolean('sc2_verbose', false, 'Enable SC2 verbose logging.' /*, allow_hide_cpp=true*/)
flags.defineBoolean('sc2_verbose_mp', false, 'Enable SC2 verbose multiplayer logging.')
flags.defineBoolean('sc2_gdb', false, 'Run SC2 in gdb.')
flags.defineBoolean('sc2_strace', false, 'Run SC2 in strace.')
flags.defineInteger('sc2_port', null, 'If set, connect to the instance on \nlocalhost:sc2_port instead of\n launching one.')

// const sw = stopwatch.sw
// let sw = new stopwatch.StopWatch(false)

class SC2LaunchError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'SC2LaunchError'
  }
}

class StarcraftProcess {
  /*Launch a starcraft server, initialize a controller, and later, clean up.

  This is best used from run_configs, which decides which version to run, and
  where to find it.

  It is important to call `close` or use it as a context manager, otherwise
  you'll likely leak temp files and SC2 processes.
  */
  constructor(run_config, exec_path, version, full_screen = false, extra_args = null, verbose = false, host = null, port = null, connect = true, timeout_seconds = null, window_size = [640, 480], window_loc = [50, 50], passedSw) {
    /*    Launch the SC2 process.

    Args:
      run_config: `run_configs.lib.RunConfig` object.
      exec_path: Path to the binary to run.
      version: `run_configs.lib.Version` object.
      full_screen: Whether to launch the game window full_screen on win/mac.
      extra_args: List of additional args for the SC2 process.
      verbose: Whether to have the SC2 process do verbose logging.
      host: IP for the game to listen on for its websocket. This is
          usually "127.0.0.1", or "::1", but could be others as well.
      port: Port SC2 should listen on for the websocket.
      connect: Whether to create a RemoteController to connect.
      timeout_seconds: Timeout for the remote controller.
      window_size: Screen size if not full screen.
      window_loc: Screen location if not full screen.
      **kwargs: Extra arguments for _launch (useful for subclasses).
    */
    flags.parse(null, true)
    this._sw = passedSw || stopwatch.sw
    this._proc = null
    this._controller = null
    this._check_exists(exec_path)
    const dir = run_config.tmp_dir
    const prefix = 'sc-'
    this._tmp_dir = tempfile.directory(prefix, dir) // these arguments are ignored
    this._host = host || '127.0.0.1'
    let args
    this._port = flags.get('sc2_port') || port /* || getPort()
      .then((p) => {
        args[args.indexOf(this._port)] = p
        this._port = p
        return p
      })

      A race condition exists where two or more instances of sc_process.js are communicatiing on the same port because from the node process running the two instances, the call to get free port returns the same value
      */
    if (!Number.isInteger(this._port)) {
      throw new Error('A port is required to instantiate an sc_process instance.')
    }
    this._version = version
    args = [ //eslint-disable-line
      exec_path,
      '-listen', this._host,
      '-port', this._port,
      '-dataDir', path.join(run_config.data_dir, ''),
      '-tempDir', path.join(this._tmp_dir, ''),
    ]
    if (this._host.match(':')) {
      args.push('-ipv6')
    }
    if (platform != 'Linux') {
      if (full_screen) {
        args.extend(['-displayMode', '1'])
      } else {
        args.extend([
          '-displayMode', '0',
          '-windowwidth', String(window_size[0]),
          '-windowheight', String(window_size[1]),
          '-windowx', String(window_loc[0]),
          '-windowy', String(window_loc[1]),
        ])
      }
    }
    if (verbose || flags.get('sc2_verbose')) {
      args.extend(['-verbose'])
    }
    if (flags.get('sc2_verbose_mp')) {
      args.extend(['-verboseMP'])
    }
    if (this._version && this._version.data_version) {
      args.extend(['-dataVersion', this._version.data_version.toUpperCase()])
    }
    if (extra_args) {
      args.extend(extra_args)
    }

    // rest of set up happens in _setupController called by factory
    const self = this
    this._setupController = this._setupController.bind(this)
    this._setupControllerLockedArgs = function _setupController() {
      return self._setupController({ run_config, args, timeout_seconds, connect })
    }
    // apply @decorators
    this.close = this._sw.decorate(this.close.bind(this))
  }

  async _setupController({ run_config, args, timeout_seconds, connect }) {
    if (this._port instanceof Promise) {
      await this._port
    }
    if (flags.get('sc2_gdb')) {
      console.log('Launching: gdb', args[0])
      console.log('GDB run command:')
      console.log(`  run ${args.slice(1, args.length)}`)
      console.log('\n')
      args = ['gdb', args[0]]
      timeout_seconds = 3600 * 6
    } else if (flags.get('sc2_strace')) {
      const strace_out = '/tmp/sc2-strace.txt'
      console.log('Launching in strace. Redirecting output to', strace_out)
      args = ['strace', '-f', '-o', strace_out].concat(args)
    } else {
      console.info(`Launching SC2:\n${args.join(' ')}`)
    }
    try {
      await withPython(this._sw('startup'), async () => {
        if (!flags.get('sc2_port')) {
          this._proc = await this._launch(run_config, args)
        }
        if (connect) {
          this._controller = await remote_controller.RemoteControllerFactory(
            this._host, this._port, this, timeout_seconds, this._sw
          )
        }
      })
    } catch (err) {
      this.close()
      throw err
    }
  }

  async close() {
    //Shut down the game and clean up.//
    if (this.hasOwnProperty('_controller') && this._controller) {
      await this._controller.quit()
      await this._controller.close()
      this._controller = null
    }
    this._shutdown()
    if (this.hasOwnProperty('_port') && this._port) {
      flags.parse(null, true)
      if (!flags.get('sc2_port')) {
        // can't do this yet
        // portpicker.return_port(this._port)
      }
      this._port = null
    }
    if (this.hasOwnProperty('_tmp_dir') && fs.existsSync(this._tmp_dir)) {
      rimraf.sync(this._tmp_dir)
    }
  }

  get controller() {
    return this._controller
  }

  get host() {
    return this._host
  }

  get port() {
    return this._port
  }

  get version() {
    return this._version
  }

  __enter__() {
    return this.controller
  }

  __exit__() {
    return this.close()
  }

  __del__() {
    // Prefer using a context manager, but this cleans most other cases.
    this.close()
  }

  _check_exists(exec_path) { //eslint-disable-line
    if (!fs.existsSync(exec_path)) {
      throw new Error(`Trying to run ${exec_path}, but it doesn't exist.`)
    }
    try {
      fs.accessSync(exec_path, fs.constants.X_OK)
      return true
    } catch (err) {
      throw new Error(`Trying to run ${exec_path}, but it isn't executable.`)
    }
  }

  async _launch(run_config, args) { //eslint-disable-line
    //Launch the process and return the process object.//
    try {
      const { cwd, env } = run_config
      const proc = withPython(this._sw('popen'), () => spawn(args[0], args, { cwd, env }))
      this._proc_exited = false
      proc.on('message', (msg) => {
        console.log('proc.on message => msg:', msg)
        proc._hasExited = false
      })
      proc.stdout.on('data', (data) => {
        console.log('proc.stdout: data:', data)
        proc._hasExited = false
      })
      proc.stderr.on('data', (data) => {
        console.error('proc.stderr: data: ', data)
      })
      proc.on('exit', () => {
        this._proc_exited = true
        proc._hasExited = true
      })
      proc.on('error', (err) => {
        console.error('proc.on error => err: ', err)
        this._proc_exited = true
        proc._hasExited = true
      })
      return proc
    } catch (err) {
      console.error('Failed to launch')
      throw new SC2LaunchError(`Failed to launch ${args}`)
    }
  }

  _shutdown() {
    //Terminate the sub-process.//
    if (!this._proc) {
      return
    }
    const ret = _shutdown_proc(this._proc, 3) //eslint-disable-line
    console.info(`Shutdown with return code: ${ret}`)
    this._proc = null
  }

  get running() {
    flags.parse(null, true)
    if (flags.get('sc2_port')) {
      return true
    }
    // poll returns None if it's running, otherwise the exit code.
    return this._proc && (!this._proc_exited)
  }

  get pid() {
    return this.running ? this._proc.pid : null
  }
}

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

async function StarcraftProcessFactory({ run_config, exec_path, version, full_screen, extra_args, verbose, host, port, connect, timeout_seconds, window_size, window_loc, passedSw }) {
  const scP = new StarcraftProcess(run_config, exec_path, version, full_screen, extra_args, verbose, host, port, connect, timeout_seconds, window_size, window_loc, passedSw)
  await scP._setupControllerLockedArgs()
  return scP
}

module.exports = {
  SC2LaunchError,
  StarcraftProcess,
  StarcraftProcessFactory,
  _shutdown_proc,
}
