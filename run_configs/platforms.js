const path = require('path') //eslint-disable-line
const fs = require('fs') //eslint-disable-line
// const os = require('os') //eslint-disable-line
const { exec, execSync } = require('child_process') //eslint-disable-line
const flags = require('flags') //eslint-disable-line
const sc_process = require(path.resolve(__dirname, '..', 'lib', 'sc_process.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const lib = require(path.resolve(__dirname, './lib.js'))
const gfile = require(path.resolve(__dirname, '..', 'lib', 'gfile.js'))

const { expanduser, ValueError } = pythonUtils
// if not flags.sc2_version:
flags.defineInteger("sc2_version", null, `Which version of the game to use.\nchoices:\n ${Object.keys(lib.VERSIONS).map((game_version, index) => `${game_version} -> ${index}`).sort().join('\n')}`)
flags.defineBoolean("sc2_dev_build", false, "Use a dev build. Mostly useful for testing by Blizzard.")

function _read_execute_info(path_arg, parents) {
  //Read the ExecuteInfo.txt file and return the base directory.//
  path_arg = path.join(path_arg, "StarCraft II/ExecuteInfo.txt")
  if (gfile.Exists(path)) {
    const f = gfile.Open(path) // Binary because the game appends a '\0' :(.
    const lines = f.toString().split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split('=').map((p) => p.trim())
      if (parts.length === 2 && parts[0] == "executable") {
        let exec_path = parts[1].replace("\\", "/") // For windows compatibility.
        parents.forEach(() => {
          exec_path = path.dirname(exec_path)
        })
        return exec_path
      }
    }
  }
}

class LocalBase extends lib.RunConfig {
  //Base run config for public installs.//

  constructor(base_dir, exec_name, version, cwd = null, env = null) {
    flags.parse()
    base_dir = expanduser(base_dir)
    version = version || flags.get('sc2_version') || 'latest'
    cwd = cwd && path.join(base_dir, cwd)
    const replay_dir = path.join(base_dir, 'Replays')
    const data_dir = base_dir
    const tmp_dir = null
    super(replay_dir, data_dir, tmp_dir, version, cwd, env)
    if (flags.get('sc2_dev_build')) {
      const build_version = 0
      this.version = this.version._replace(build_version)
    } else if (this.version.build_version < lib.VERSIONS['3.16.1'].build_version) {
      throw new sc_process.SC2LaunchError('SC2 Binaries older than 3.16.1 don\'t support the api.')
    }
    this._exec_name = exec_name
  }

  start(kwargs) {
    delete kwargs.want_rgb
    //Launch the game.//
    if (!gfile.IsDirectory(this.data_dir)) {
      throw new sc_process.SC2LaunchError(`
          Expected to find StarCraft II installed at '${this.data_dir}'. If it's not 
          installed, do that and run it once so auto-detection works. If 
          auto-detection failed repeatedly, then set the SC2PATH environment 
          variable with the correct location.`)
    }
    const exec_path = path.join(
      this.data_dir, `Versions/Base${this.version.build_version}`,
      this._exec_name
    )

    if (!gfile.Exists(exec_path)) {
      throw new sc_process.SC2LaunchError(`No SC2 binary found at: ${exec_path}`)
    }
    // returns promise
    kwargs.exec_path = exec_path
    kwargs.version = this.version
    kwargs.run_config = this
    return sc_process.StarcraftProcessFactory(kwargs)
  }

  get_versions(containing = null) {
    const versions_dir = path.join(this.data_dir, 'Versions')
    const version_prefix = 'Base'
    const temp = []
    gfile.ListDir(versions_dir).forEach((v) => {
      if (v.slice(0, version_prefix.length).match(version_prefix)) {
        const rest = v.slice(version_prefix.length, v.length)
        temp.push(Number(rest))
      }
    })

    const versions_found = temp.sort()
    if (!versions_found.length) {
      throw new sc_process.SC2LaunchError(`No SC2 Versions found in ${versions_dir}`)
    }
    const known_versions = []
    Object.keys(lib.VERSIONS).forEach((k) => {
      const v = lib.VERSIONS[k]
      if (versions_found.includes(v.build_version)) {
        known_versions.push(v)
      }
    })
    // Add one more with the max version. That one doesn't need a data version
    // since SC2 will find it in the .build.info file. This allows running
    // versions newer than what are known by pysc2, and so is the default.
    known_versions.push(
      new lib.Version('latest', versions_found[versions_found.length - 1], null, null)
    )
    const ret = lib.version_dict(known_versions)
    if (containing !== null && !ret[containing]) {
      throw new ValueError(`Unknown game version: ${containing}. Known versions: ${Object.keys(ret).sort()}.`)
    }
    return ret
  }
}
lib.RunConfig._subclasses.push(LocalBase)

class Windows extends LocalBase {
  //Run on Windows.//
  constructor(version = null) {
    const exec_path = process.env.SC2PATH || _read_execute_info(expanduser('~/Documents'), 3) || 'C:/Program Files (x86)/StarCraft II'
    const cwd = 'Support64'
    super(exec_path, 'SC2_x64.exe', version, cwd)
  }

  static priority() {
    if (process.platform == 'win32') {
      return 1
    }
  }
}
lib.RunConfig._subclasses.push(Windows)

class Cygwin extends LocalBase {
  //Run on Cygwin. This runs the windows binary within a cygwin terminal.//
  constructor(version = null) {
    const cwd = 'Support64'
    const exec_path = process.env.SC2PATH || '/cygdrive/c/Program Files (x86)/StarCraft II'
    super(exec_path, 'SC2_x64.exe', version, cwd)
  }

  static priority() {
    if (process.platform == 'cygwin') {
      return 1
    }
  }
}
lib.RunConfig._subclasses.push(Cygwin)

class MacOS extends LocalBase {
  //Run on MacOS.//

  constructor(version = null) {
    const exec_path = process.env.SC2PATH || _read_execute_info(expanduser('~/Library/Application Support/Blizzard'), 6) || '/Applications/StarCraft II'
    super(exec_path, 'SC2.app/Contents/MacOS/SC2', version)
  }

  static priority() {
    if (process.platform == 'darwin') {
      return 1
    }
  }
}
lib.RunConfig._subclasses.push(MacOS)

class Linux extends LocalBase {
  //Config to run on Linux.//
  static get known_gl_libs () {
    return [ //In priority order. Prefer hardware rendering.
      ['-eglpath', 'libEGL.so'],
      ['-eglpath', 'libEGL.so.1'],
      ['-osmesapath', 'libOSMesa.so'],
      ['-osmesapath', 'libOSMesa.so.8'], // Ubuntu 16.04
      ['-osmesapath', 'libOSMesa.so.6'], // Ubuntu 14.04
    ]
  }

  constructor(version = null) {
    let base_dir = process.env.SC2PATH || '~/StarCraftII'
    base_dir = expanduser(base_dir)
    const env = process.env
    env['LD_LIBRARY_PATH'] = [
      env.LD_LIBRARY_PATH,
      path.join(base_dir, 'Libs/')
    ].filter((ele) => ele !== null).join(':')
    super(base_dir, 'SC2_x64', version, env)
  }

  static priority() {
    if (process.platform == 'linux') {
      return 1
    }
  }

  async start({ want_rgb = true, extra_args = [] }) {
    const kwargs = arguments[0] //eslint-disable-line
    if (want_rgb) {
      // Figure out whether the various GL libraries exist since SC2 sometimes
      // fails if you ask to use a library that doesn't exist.
      const libs = execSync('/sbin/ldconfig -p').toString()
      const temp = {}
      libs.split('\n').forEach((line) => {
        if (!line) {
          return
        }
        const libName = line.trim().split(' ')[0]
        temp[libName] = true
      })
      let extraArgFound
      for (let i = 0; i < this.known_gl_libs.length; i++) {
        const [arg, lib_name] = this.known_gl_libs[i]
        if (libs[lib_name]) {
          extra_args.push(arg)
          extra_args.push(lib_name)
          extraArgFound = true
          break
        }
      }
      if (!extraArgFound) {
        extra_args.push('-headlessNoRender')
        console.info('No GL library found, so RGB rendering will be disabled. For software rendering install libosmesa.')
      }
    }
    kwargs.want_rgb = want_rgb
    kwargs.extra_args = extra_args
    return super.start(kwargs)
  }
}
lib.RunConfig._subclasses.push(Linux)

module.exports = {
  Cygwin,
  LocalBase,
  Linux,
  MacOS,
  Windows,
  _read_execute_info,
}
