const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const actions = require(path.resolve(__dirname, '..', 'lib', 'actions.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const units = require(path.resolve(__dirname, '..', 'lib', 'units.js'))
const buffs = require(path.resolve(__dirname, '..', 'lib', 'buffs.js'))
const utils = require(path.resolve(__dirname, './utils.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const { assert, sequentialTaskQueue  } = pythonUtils //eslint-disable-line

const sc_debug = s2clientprotocol.debug_pb
const sc_raw = s2clientprotocol.raw_pb
const msToS = 1 / 1000
const EXPECTED_ACTION_DELAY = 2

let count = 0
let testState
async function obsTest() {
  count += 1
  const start_timer = performance.now() * msToS
  testState = await new utils.GameReplayTestCase()
  async function test_hallucination() {
    await testState.god()

    // Create some sentries
    await testState.create_unit(units.Protoss.Sentry, 1, [30, 30])
    await testState.create_unit(units.Protoss.Sentry, 2, [30, 30])

    await testState.step()
    let obs = await testState.observe()

    // Give one enough energy.
    const tag = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry, owner: 1 }).getTag()
    const debugType = new sc_debug.DebugSetUnitValue()
    debugType.setUnitValue(sc_debug.DebugSetUnitValue.UnitValue.ENERGY)
    debugType.setValue(200)
    debugType.setUnitTag(tag)
    await testState.debug(0, { unit_value: debugType })

    await testState.step()
    obs = await testState.observe()

    // Create a hallucinated archon.
    await testState.raw_unit_command(0, 'Hallucination_Archon_quick', tag)

    await testState.step()
    obs = await testState.observe()

    // Verify the owner knows it's a hallucination, but the opponent doesn't.
    let p1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Archon })
    let p2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Archon })

    assert(p1.getIsHallucination(), 'p1.getIsHallucination()')
    assert(p2.getIsHallucination() === false, 'p1.getIsHallucination() === false')

    // Create an observer so the opponent has detection
    await testState.create_unit(units.Protoss.Observer, 2, [28, 30])

    await testState.step()

    // Verify the opponent now also knows it'sa hallucination.
    p1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Archon })
    p2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Archon })

    assert(p1.getIsHallucination(), 'p1.getIsHallucination()')
    assert(p2.getIsHallucination(), 'p1.getIsHallucination()')
  }
  // no bounded args
  let boundedArgsDecorator = utils.GameReplayTestCase.setup()
  let decoratedFunc = boundedArgsDecorator(test_hallucination)
  await decoratedFunc(testState)

  async function test_hide_cloaked() {
    count += 1
    assert(
      testState._info.getOptions().getShowCloaked() === false,
      'testState._info.getOptions().getShowCloaked() === false'
    )

    await testState.god()
    await testState.move_camera(32, 32)

    // Create some units. One cloaked, one to see it without detection.
    await testState.create_unit(units.Protoss.DarkTemplar, 1, [30, 30])
    await testState.create_unit(units.Protoss.Sentry, 2, [30, 30])

    await testState.step(16)
    let obs = await testState.observe()

    // Verify both can see it, but that only the owner knows details.
    let p1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.DarkTemplar })
    let p2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar })
    testState.assert_unit(p1, {
      display_type: sc_raw.DisplayType.VISIBLE,
      cloak: sc_raw.CloakState.CLOAKEDALLIED,
      health: 40,
      shield: 80,
    })
    assert(p2 === null, `p2 === null, p2: ${p2}`)
    let screen1 = testState._features.transform_obs(obs[0])['feature_screen']
    let screen2 = testState._features.transform_obs(obs[1])['feature_screen']
    let dt = utils.xy_locs(screen1.unit_type, units.Protoss.DarkTemplar)[0]
    testState.assert_layers(screen1, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 40,
      unit_shields: 80,
      cloaked: 1,
    })
    testState.assert_layers(screen2, dt, {
      unit_type: 0,
      unit_hit_points: 0,
      unit_shields: 0,
      cloaked: 0,
    })

    // Create an observer so the opponent has detection.
    await testState.create_unit(units.Protoss.Observer, 2, [28, 28])
    await testState.step(16) // It takes a few frames for the observer to detect.
    obs = await testState.observe()

    //Verify both can see it, with the same details
    p1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.DarkTemplar })
    p2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar })
    testState.assert_unit(p1, {
      display_type: sc_raw.DisplayType.VISIBLE,
      cloak: sc_raw.CloakState.CLOAKEDALLIED,
      health: 40,
      shield: 80,
    })
    testState.assert_unit(p2, {
      display_type: sc_raw.DisplayType.VISIBLE,
      cloak: sc_raw.CloakState.CLOAKEDDETECTED,
      health: 40,
      shield: 80,
    })

    screen1 = testState._features.transform_obs(obs[0])['feature_screen']
    screen2 = testState._features.transform_obs(obs[1])['feature_screen']
    dt = utils.xy_locs(screen1.unit_type, units.Protoss.DarkTemplar)[0]
    testState.assert_layers(screen1, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 40,
      unit_shields: 80,
      cloaked: 1,
    })
    testState.assert_layers(screen2, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 40,
      unit_shields: 80,
      cloaked: 1,
    })
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({ show_cloaked: false })
  decoratedFunc = boundedArgsDecorator(test_hide_cloaked)
  await decoratedFunc(testState)

  async function test_show_cloaked() {
    count += 1
    assert(
      testState._info.getOptions().getShowCloaked() === true,
      'testState._info.getOptions().getShowCloaked() === true'
    )

    await testState.god()
    await testState.move_camera(32, 32)

    // Create some units. One cloaked, one to see it without detection.
    await testState.create_unit(units.Protoss.DarkTemplar, 1, [30, 30])
    await testState.create_unit(units.Protoss.Sentry, 2, [28, 30])

    await testState.step(16)
    let obs = await testState.observe()

    //Verify both can see it, but that only the owner knows details.
    let p1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.DarkTemplar })
    let p2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar })
    testState.assert_unit(p1, {
      display_type: sc_raw.DisplayType.VISIBLE,
      cloak: sc_raw.CloakState.CLOAKEDALLIED,
      health: 40,
      shield: 80,
    })
    testState.assert_unit(p2, {
      display_type: sc_raw.DisplayType.HIDDEN,
      cloak: sc_raw.CloakState.CLOAKED,
      health: 0,
      shield: 0,
    })

    let screen1 = testState._features.transform_obs(obs[0])['feature_screen']
    let screen2 = testState._features.transform_obs(obs[1])['feature_screen']
    let dt = utils.xy_locs(screen1.unit_type, units.Protoss.DarkTemplar)[0]
    testState.assert_layers(screen1, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 40,
      unit_shields: 80,
      cloaked: 1,
    })
    testState.assert_layers(screen2, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 0,
      unit_shields: 0,
      cloaked: 1,
    })

    // Create an observer so the opponent has detection.
    await testState.create_unit(units.Protoss.Observer, 2, [28, 28])
    await testState.step(16) // It takes a few frames for the observer to detect.
    obs = await testState.observe()

    // Verify both can see it, with the same details
    p1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.DarkTemplar })
    p2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar })
    testState.assert_unit(p1, {
      display_type: sc_raw.DisplayType.VISIBLE,
      cloak: sc_raw.CloakState.CLOAKEDALLIED,
      health: 40,
      shield: 80,
    })
    testState.assert_unit(p2, {
      display_type: sc_raw.DisplayType.VISIBLE,
      cloak: sc_raw.CloakState.CLOAKEDDETECTED,
      health: 40,
      shield: 80,
    })

    screen1 = testState._features.transform_obs(obs[0])['feature_screen']
    screen2 = testState._features.transform_obs(obs[1])['feature_screen']
    dt = utils.xy_locs(screen1.unit_type, units.Protoss.DarkTemplar)[0]
    testState.assert_layers(screen1, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 40,
      unit_shields: 80,
      cloaked: 1,
    })
    testState.assert_layers(screen2, dt, {
      unit_type: units.Protoss.DarkTemplar,
      unit_hit_points: 40,
      unit_shields: 80,
      cloaked: 1,
    })
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({ show_cloaked: true })
  decoratedFunc = boundedArgsDecorator(test_show_cloaked)
  await decoratedFunc(testState)

  async function test_pos() {
    count += 1
    await testState.create_unit(units.Protoss.Archon, 1, [20, 30])
    await testState.create_unit(units.Protoss.Observer, 1, [40, 30])

    await testState.step()
    const obs = await testState.observe()

    const archon = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Archon })
    const observer = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Observer })

    testState.assert_point(archon.getPos(), [20, 30])
    testState.assert_point(observer.getPos(), [40, 30])
    assert(archon.getPos().getZ() < observer.getPos().getZ()) // The observer flies.

    // Move them towards the center, make sure they move.
    await testState.raw_unit_command(0, 'Move_screen', [archon.getTag(), observer.getTag()], [30, 25])

    await testState.step(40)
    const obs2 = await testState.observe()

    const archon2 = await utils.get_unit({ obs: obs2[0], unit_type: units.Protoss.Archon })
    const observer2 = await utils.get_unit({ obs: obs2[0], unit_type: units.Protoss.Observer })

    assert(archon2.getPos().getX() > 20, 'archon2.getPos().getX() > 20')
    assert(observer2.getPos().getX() < 40, 'observer2.getPos().getX() < 40')
    assert(archon2.getPos().getZ() < observer2.getPos().getZ(), 'archon2.getPos().getZ() < observer2.getPos().getZ()')
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({})
  decoratedFunc = boundedArgsDecorator(test_pos)
  await decoratedFunc(testState)

  async function test_fog() {
    count += 1
    await testState.observe()

    function assert_visible(unit, display_type, alliance, cloak) {
      testState.assert_unit(unit, {
        display_type,
        alliance,
        cloak,
      })
    }

    await testState.create_unit(units.Protoss.Sentry, 1, [30, 32])
    await testState.create_unit(units.Protoss.DarkTemplar, 1, [32, 32])

    await testState.step()
    let obs = await testState.observe()

    assert_visible(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry }),
      sc_raw.DisplayType.VISIBLE,
      sc_raw.Alliance.SELF,
      sc_raw.CloakState.NOTCLOAKED
    )
    assert_visible(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.DarkTemplar }),
      sc_raw.DisplayType.VISIBLE,
      sc_raw.Alliance.SELF,
      sc_raw.CloakState.CLOAKEDALLIED
    )

    assert(
      null === utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry }),
      'null === utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry })'
    )
    assert(
      null === utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar }),
      'null === utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar })'
    )

    const disable_fog = true
    obs = await testState.observe(disable_fog)

    assert_visible(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry }),
      sc_raw.DisplayType.VISIBLE,
      sc_raw.Alliance.SELF,
      sc_raw.CloakState.NOTCLOAKED
    )
    assert_visible(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.DarkTemplar }),
      sc_raw.DisplayType.VISIBLE,
      sc_raw.Alliance.SELF,
      sc_raw.CloakState.CLOAKEDALLIED
    )
    assert_visible(
      utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry }),
      sc_raw.DisplayType.HIDDEN,
      sc_raw.Alliance.ENEMY,
      sc_raw.CloakState.CLOAKEDUNKNOWN
    )
    assert_visible(
      utils.get_unit({ obs: obs[1], unit_type: units.Protoss.DarkTemplar }),
      sc_raw.DisplayType.HIDDEN,
      sc_raw.Alliance.ENEMY,
      sc_raw.CloakState.CLOAKEDUNKNOWN
    )
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({})
  decoratedFunc = boundedArgsDecorator(test_fog)
  await decoratedFunc(testState)

  async function test_effects() {
    count += 1
    function get_effect_proto(obs, effect_id) {
      const effects = obs.getObservation().getRawData().getEffectsList()
      for (let i = 0; i < effects.length; i++) {
        const e = effects[i]
        if (e.getEffectId() == effect_id) {
          return e
        }
      }
      return null
    }

    function get_effect_obs(obs, effect_id) {
      for (let i = 0; i < obs.length; i++) {
        const ob = obs[i]
        if (ob.effect == effect_id) {
          return ob
        }
      }
      return null
    }

    await testState.god()
    await testState.move_camera(32, 32)

    // Create some sentries.
    await testState.create_unit(units.Protoss.Sentry, 1, [30, 30])
    await testState.create_unit(units.Protoss.Stalker, 1, [28, 30])
    await testState.create_unit(units.Protoss.Phoenix, 2, [30, 28])

    await testState.step()
    let obs = await testState.observe()

    // Give enough energy.
    const sentry = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry })
    const stalker = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Stalker })
    const phoenix = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Phoenix })
    await testState.set_energy(sentry.getTag(), 200)
    await testState.set_energy(phoenix.getTag(), 200)

    await testState.step()
    await testState.observe()

    await testState.raw_unit_command(0, 'Effect_GuardianShield_quick', sentry.getTag())

    await testState.step(16)
    obs = await testState.observe()

    assert(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val),
      `utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val)`
    )
    assert(
      utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val),
      `utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val)`
    )
    assert(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val),
      `utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val)`
    )
    assert(
      utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val),
      `utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val)`
    )
    assert(
      !utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val),
      `!utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val)`
    )
    assert(
      !utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val),
      `!utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GuardianShield.val)`
    )

    // Both players should see the shield.
    let e = get_effect_proto(obs[0], features.Effects.GuardianShield)
    assert(e, 'e is not null')
    testState.assert_point(e.getPosList()[0], [30, 30])
    assert(
      e.getAlliance() === sc_raw.Alliance.SELF,
      'e.getAlliance() === sc_raw.Alliance.SELF'
    )
    assert(e.getOwner() === 1, 'e.getOwner() === 1')
    assert(e.getRadius() > 3, 'e.getRadius() === 3')

    e = get_effect_proto(obs[1], features.Effects.GuardianShield)
    assert(e, 'e is not null')
    testState.assert_point(e.getPosList()[0], [30, 30])
    assert(
      e.getAlliance() === sc_raw.Alliance.ENEMY,
      'e.getAlliance() === sc_raw.Alliance.ENEMY'
    )
    assert(e.getOwner() === 1, 'e.getOwner() === 1')
    assert(e.getRadius() > 3, 'e.getRadius() === 3')

    // Should show up on the feature layers too.
    const transform_obs1 = testState._features.transform_obs(obs[0])
    const transform_obs2 = testState._features.transform_obs(obs[1])
    const screen1 = transform_obs1['feature_screen']
    const screen2 = transform_obs2['feature_screen']
    const sentry_pos = utils.xy_locs(screen1.unit_type, units.Protoss.Sentry)[0]
    testState.assert_layers(screen1, sentry_pos, {
      unit_type: units.Protoss.Sentry,
      effects: features.Effects.GuardianShield,
      buffs: buffs.Buffs.GuardianShield,
    })
    testState.assert_layers(screen2, sentry_pos, {
      unit_type: units.Protoss.Sentry,
      effects: features.Effects.GuardianShield,
      buffs: buffs.Buffs.GuardianShield,
    })
    const phoenix_pos = utils.xy_locs(screen1.unit_type, units.Protoss.Phoenix)[0]
    testState.assert_layers(screen1, phoenix_pos, {
      unit_type: units.Protoss.Phoenix,
      effects: features.Effects.GuardianShield,
      buffs: 0,
    })
    testState.assert_layers(screen2, phoenix_pos, {
      unit_type: units.Protoss.Phoenix,
      effects: features.Effects.GuardianShield,
      buffs: 0,
    })

    // Also in the raw effects
    const raw1 = transform_obs1['raw_effects']
    e = get_effect_obs(raw1, features.Effects.GuardianShield)
    assert(e, 'e is not null')
    // Not located at [30, 30] due to map shape and minimap coords
    assert(e.x > 20, 'e.getX() > 20')
    assert(e.y > 20, 'e.getY() > 20')
    assert(e.alliance === sc_raw.Alliance.SELF, 'e.getAlliance() === sc_raw.Alliance.SELF')
    assert(e.owner === 1, 'e.getOwner() === 1')
    assert(e.radius > 3, 'e.radius > 3')

    await testState.raw_unit_command(1, 'Effect_GravitonBeam_screen', phoenix.getTag(), null, stalker.getTag())

    await testState.step(32)
    obs = await testState.observe()

    assert(
      utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val),
      `utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val)`
    )
    assert(
      utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val),
      `utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Stalker })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val)`
    )
    assert(
      !utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val),
      `!utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val)`
    )
    assert(
      !utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val),
      `!utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Sentry })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val)`
    )
    assert(
      !utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val),
      `!utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val)`
    )
    assert(
      !utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val),
      `!utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Phoenix })
        .getBuffIdsList().includes(buffs.Buffs.GravitonBeam.val)`
    )
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({})
  decoratedFunc = boundedArgsDecorator(test_effects)
  await decoratedFunc(testState)

  async function test_active() {
    count += 1
    let obs = await testState.observe()

    // P1 can see p2.
    const pos = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Nexus }).getPos()
    await testState.create_unit(units.Protoss.Observer, 1, pos)

    await testState.step(32) // Make sure visibility updates
    obs = await testState.observe()

    const tasks = []
    obs.forEach((o, i) => {
      const probes = utils.get_units({ obs: o, unit_type: units.Protoss.Probe })
      // Probes are active gathering
      Object.keys(probes).forEach((key) => {
        const u = probes[key]
        testState.assert_unit(u, {
          display_type: sc_raw.DisplayType.VISIBLE,
          is_active: true,
        })
      })

      // Own Nexus is idle
      const nexus = utils.get_unit({ obs: o, unit_type: units.Protoss.Nexus, owner: i + 1 })
      testState.assert_unit(nexus, {
        display_type: sc_raw.DisplayType.VISIBLE,
        is_active: false
      })
      assert(nexus.getOrdersList().length === 0, 'nexus.getOrdersList().length === 0')

      // Give it an action.
      tasks.push(/*async() => */testState.raw_unit_command(i, 'Train_Probe_quick', nexus.getTag()))
    })

    await Promise.all(tasks)
    await testState.step(32)
    obs = await testState.observe()

    // All Nexus are now active
    let nexus0 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Nexus, owner: 1 })
    let nexus1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Nexus, owner: 2 })
    let nexus2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Nexus })
    testState.assert_unit(nexus0, {
      display_type: sc_raw.DisplayType.VISIBLE,
      is_active: true
    })
    testState.assert_unit(nexus1, {
      display_type: sc_raw.DisplayType.VISIBLE,
      is_active: true
    })
    testState.assert_unit(nexus2, {
      display_type: sc_raw.DisplayType.VISIBLE,
      is_active: true
    })
    assert(nexus0.getOrdersList().length === 1, 'nexus0.getOrdersList().length === 1')
    assert(nexus2.getOrdersList().length === 1, 'nexus2.getOrdersList().length === 1')
    assert(nexus1.getOrdersList().length === 0, 'nexus1.getOrdersList().length === 0') // Can't see opponent's orders

    // Go back to a snapshot
    await testState.kill_unit(utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Observer }).getTag())

    await testState.step(100) // Make sure visibility updates.
    obs = await testState.observe()

    assert(utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Observer }) === null, 'utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Observer }) === null')

    // Own Nexus is now active, snapshot isn't.
    nexus0 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Nexus, owner: 1 })
    nexus1 = utils.get_unit({ obs: obs[0], unit_type: units.Protoss.Nexus, owner: 2 })
    nexus2 = utils.get_unit({ obs: obs[1], unit_type: units.Protoss.Nexus })
    assert(nexus0.getOrdersList().length === 1, 'nexus0.getOrdersList().length === 1')
    assert(nexus2.getOrdersList().length === 1, 'nexus2.getOrdersList().length === 1')
    assert(nexus1.getOrdersList().length === 0, 'nexus1.getOrdersList().length === 0') // Can't see opponent's orders
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({})
  decoratedFunc = boundedArgsDecorator(test_active)
  await decoratedFunc(testState)

  async function test_disable_fog() {
    count += 1
    let obs = await testState.observe()

    const tasks = []
    obs.forEach((o, i) => {
      const probes = utils.get_units({ obs: o, unit_type: units.Protoss.Probe })
      // Probes are active gathering
      Object.keys(probes).forEach((key) => {
        const u = probes[key]
        testState.assert_unit(u, {
          display_type: sc_raw.DisplayType.VISIBLE,
          is_active: true,
        })
      })

      // All Nexus is idle
      const own = utils.get_unit({ obs: o, unit_type: units.Protoss.Nexus, owner: i + 1 })
      const other = utils.get_unit({ obs: o, unit_type: units.Protoss.Nexus, owner: 2 - i })
      testState.assert_unit(own, {
        display_type: sc_raw.DisplayType.VISIBLE,
        is_active: false,
      })
      testState.assert_unit(own, {
        display_type: sc_raw.DisplayType.VISIBLE,
        is_active: false,
      })
      assert(own.getOrdersList().length === 0, 'own.getOrdersList().length === 0')
      assert(other.getOrdersList().length === 0, 'other.getOrdersList().length === 0')

      // Give it an action.
      tasks.push(/*async() => */testState.raw_unit_command(i, 'Train_Probe_quick', own.getTag()))
    })

    await Promise.all(tasks)

    await testState.step(32)
    obs = await testState.observe()

    // All Nexus are active
    obs.forEach((o, i) => {
      const own = utils.get_unit({
        obs: o,
        unit_type: units.Protoss.Nexus,
        owner: i + 1,
      })
      const other = utils.get_unit({
        obs: o,
        unit_type: units.Protoss.Nexus,
        owner: 2 - i,
      })
      testState.assert_unit(own, {
        display_type: sc_raw.DisplayType.VISIBLE,
        is_active: true,
      })
      testState.assert_unit(other, {
        display_type: sc_raw.DisplayType.VISIBLE,
        is_active: true,
      })
      assert(own.getOrdersList().length === 1, 'own.getOrdersList().length === 1')
      assert(other.getOrdersList().length === 0, 'other.getOrdersList().length === 0')
    })
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({ disable_fog: true })
  decoratedFunc = boundedArgsDecorator(test_disable_fog)
  await decoratedFunc(testState)

  async function test_action_delay() {
    count += 1
    await testState.observe()
    await testState.create_unit(units.Protoss.Zealot, 1, [32, 32])

    await testState.step(16)
    const obs1 = await testState.observe()
    assert(obs1[0].getActionsList().length === 0, 'obs1[0].getActionsList().length === 0')

    const zealot1 = utils.get_unit({ obs: obs1[0], unit_type: units.Protoss.Zealot, owner: 1 })
    assert(zealot1.getOrdersList().length === 0, 'zealot1.getOrdersList().length === 0')

    await testState.raw_unit_command(0, 'Move_screen', zealot1.getTag(), [30, 30])

    // If the delay is take down to 1, remove this step of verifying the
    // actions length is 0.

    assert(EXPECTED_ACTION_DELAY === 2, 'EXPECTED_ACTION_DELAY === 2')

    await testState.step(1)
    let obs2 = await testState.observe()
    assert(obs2[0].getActionErrorsList().length === 0, 'obs2[0].getActionErrorsList().length === 0')
    assert(obs2[0].getActionsList().length === 0, 'obs2[0].getActionsList().length === 0')

    await testState.step(1)
    obs2 = await testState.observe()
    assert(obs2[0].getActionErrorsList().length === 0, 'obs2[0].getActionErrorsList().length === 0')
    assert(obs2[0].getActionsList().length > 1, 'obs2[0].getActionsList().length > 1')
    let action
    obs2[0].getActionsList().forEach((a) => {
      if (a.hasActionRaw()) {
        action = a
      }
    })
    if (!action) {
      assert(false, 'No raw action found')
    }

    assert(
      action.getGameLoop() === obs1[0].getObservation().getGameLoop() + 1,
      'action.getGameLoop() === obs1[0].getObservation().getGameLoop() + 1'
    )
    const unit_command = action.getActionRaw().getUnitCommand()
    assert(
      unit_command.getAbilityId() == actions.FUNCTIONS.Move_Move_screen.ability_id,
      'unit_command.getAbilityId() == actions.FUNCTIONS.Move_Move_screen.ability_id'
    )
    testState.assert_point(unit_command.getTargetWorldSpacePos(), [30, 30])
    assert(unit_command.getUnitTagsList()[0], zealot1.getTag())

    const zealot2 = utils.get_unit({ obs: obs2[0], unit_type: units.Protoss.Zealot, owner: 1 })
    assert(zealot2.getOrdersList().length === 1, 'zealot1.getOrdersList().length === 1')
    assert(
      zealot2.getOrdersList()[0].getAbilityId() == actions.FUNCTIONS.Move_Move_screen.ability_id,
      'zealot2.getOrdersList()[0].getAbilityId() == actions.FUNCTIONS.Move_Move_screen.ability_id'
    )
    testState.assert_point(zealot2.getOrdersList()[0].getTargetWorldSpacePos(), [30, 30])
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({})
  decoratedFunc = boundedArgsDecorator(test_action_delay)
  await decoratedFunc(testState)

  async function test_camera_movement_delay() {
    count += 1
    function compareCoords(coordList1, coordList2) {
      const len = Math.min(coordList1.length, coordList2.length) // for some reason two observations from the same player and same camera location differ by one pixel coord pair
      for (let i = 0; i < len; i++) {
        assert(coordList1[i][0] == coordList2[i][0], `coordList1[${i}] x: ${coordList1[i][0]}, coordList2[${i}] x: ${coordList2[i][0]}`)
        assert(coordList1[i][1] == coordList2[i][1], `coordList1[${i}] y: ${coordList1[i][1]}, coordList2[${i}] y: ${coordList2[i][1]}`)
      }
    }
    const obs1 = await testState.observe()
    const screen1 = testState._features.transform_obs(obs1[0])['feature_screen']
    const nexus1 = utils.xy_locs(screen1.unit_type, units.Protoss.Nexus).slice(0, 173).sort((a, b) => a[0] - b[0])

    await testState.step(1)
    const obs2 = await testState.observe()
    const screen2 = testState._features.transform_obs(obs2[0])['feature_screen']
    const nexus2 = utils.xy_locs(screen2.unit_type, units.Protoss.Nexus).slice(0, 173).sort((a, b) => a[0] - b[0])

    compareCoords(nexus1, nexus2) // Same place.
    const loc = obs1[0].getObservation().getRawData().getPlayer().getCamera()
    await testState.move_camera(loc.getX() + 3, loc.getY() + 3)
    await testState.step(EXPECTED_ACTION_DELAY)

    const obs3 = await testState.observe()
    const screen3 = testState._features.transform_obs(obs3[0])['feature_screen']
    const nexus3 = utils.xy_locs(screen3.unit_type, units.Protoss.Nexus).slice(0, 173).sort((a, b) => a[0] - b[0])

    try {
      compareCoords(nexus1, nexus3) // Different location due to camera.
      throw new Error('nexus1 should not be at the same location as nexus3')
    } catch (err) {
      // should throw
    }
  }
  boundedArgsDecorator = utils.GameReplayTestCase.setup({})
  decoratedFunc = boundedArgsDecorator(test_camera_movement_delay)
  await decoratedFunc(testState)
  console.log(`\n----------------------------------------------------------------------\nRan ${count} test(s) in ${(performance.now() * msToS) - start_timer}s\n\n`)
}

obsTest()
