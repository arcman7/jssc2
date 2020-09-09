const path = require('path') //eslint-disable-line
const { performance } = require('perf_hooks') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const dummy_observation = require(path.resolve(__dirname, './dummy_observation.js'))
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const point = require(path.resolve(__dirname, '..', 'lib', 'point.js'))
const actions = require(path.resolve(__dirname, '..', 'lib', 'actions.js'))
const units = require(path.resolve(__dirname, '..', 'lib', 'units.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const { common_pb } = s2clientprotocol
const { assert } = pythonUtils
const { getattr } = dummy_observation
const msToS = 1 / 1000

const _PROBE = new dummy_observation.Unit({
  unit_type: units.Protoss.Probe,
  player_relative: features.PlayerRelative.SELF,
  health: 20,
  shields: 20,
  energy: 0,
  transport_slots_taken: 0,
  build_progress: 1.0,
})

const _ZEALOT = new dummy_observation.Unit({
  unit_type: units.Protoss.Zealot,
  player_relative: features.PlayerRelative.SELF,
  health: 100,
  shields: 50,
  energy: 0,
  transport_slots_taken: 0,
  build_progress: 1.0,
})

const _MOTHERSHIP = new dummy_observation.Unit({
  unit_type: units.Protoss.Probe,
  player_relative: features.PlayerRelative.SELF,
  health: 350,
  shields: 7,
  energy: 200,
  transport_slots_taken: 0,
  build_progress: 1.0,
})

class TestCase {
  constructor() {
    this._features = new features.Features(
      new features.AgentInterfaceFormat({
        feature_dimensions: new features.Dimensions({
          screen: [64, 60],
          minimap: [32, 28],
        }),
        rgb_dimensions: new features.Dimensions({
          screen: [128, 124],
          minimap: [64, 60],
        }),
        action_space: actions.ActionSpace.FEATURES,
        use_feature_units: true,
      }),
      new point.Point(256, 256)
    )
    this._obs_spec = this._features.observation_spec()
    this._builder = new dummy_observation.Builder(this._obs_spec)
  }

  _get_obs() {
    return this._builder.build().getObservation()
  }

  _check_layer(layer, x, y, bits) { //eslint-disable-line
    assert(layer.getSize().getX() === x, 'layer.getSize().getX() === x')
    assert(layer.getSize().getY() === y, 'layer.getSize().getY() === y')
    assert(layer.getBitsPerPixel() === bits, 'layer.getBitsPerPixel() === bits')
  }

  _check_attributes_match(a, b, attributes)  {//eslint-disable-line
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes[i]
      const aVal = getattr(a, attribute) !== undefined ? getattr(a, attribute) : a[attribute]
      const bVal = getattr(b, attribute) !== undefined ? getattr(b, attribute) : b[attribute]
      assert(aVal == bVal, `aVal == bVal, attribute: ${attribute}\n aVal: ${aVal}, bVal: ${bVal}`)
    }
  }

  _check_unit(proto, builder) {
    return this._check_attributes_match(proto, builder, Object.keys(builder))
  }

  _check_feature_unit(proto, builder) {
    return this._check_attributes_match(proto, builder, [
      'unit_type',
      'alliance',
      'owner',
      'pos',
      'radius',
      'health',
      'health_max',
      'is_on_screen',
      'shield',
      'shield_max'
    ])
  }
}

function DummyObservationTest() {
  console.log('DummyObservationTest:')
  const start_timer = performance.now() * msToS
  let testState
  let count = 0
  function getFuncName() {
    return getFuncName.caller.name
  }
  function testFeaturesScreenMatchesSpec() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const obs = testState._get_obs()
    for (let i = 0; i < features.SCREEN_FEATURES.length; i++) {
      const f = features.SCREEN_FEATURES[i]
      const layer = obs.getFeatureLayerData().getRenders()
      testState._check_layer(getattr(layer, f.name), 64, 60, 8)
    }
    count += 1
  }
  testFeaturesScreenMatchesSpec()

  function testFeatureMinimapMatchesSpec() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const obs = testState._get_obs()
    for (let i = 0; i < features.MINIMAP_FEATURES.length; i++) {
      const f = features.MINIMAP_FEATURES[i]
      const layer = obs.getFeatureLayerData().getMinimapRenders()
      testState._check_layer(getattr(layer, f.name), 32, 28, 8)
    }
    count += 1
  }
  testFeatureMinimapMatchesSpec()

  function testRgbScreenMatchesSpec() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const obs = testState._get_obs()
    testState._check_layer(obs.getRenderData().getMap(), 128, 124, 24)
    count += 1
  }
  testRgbScreenMatchesSpec()

  function testGameLoopCanBeSet() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    testState._builder.game_loop(1234)
    const obs = testState._get_obs()
    assert(obs.getGameLoop() === 1234, 'obs.getGameLoop() === 1234')
    count += 1
  }
  testGameLoopCanBeSet()

  function testPlayerCommonCanBeSet() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    testState._builder.player_common({
      minerals: 1000,
      vespene: 200,
      food_cap: 200,
      food_used: 198,
      food_army: 140,
      food_workers: 58,
      army_count: 92,
      warp_gate_count: 7,
      larva_count: 15,
    })

    const obs = testState._get_obs()
    assert(getattr(obs.getPlayerCommon(), 'player_id') === 1) // (we didn't set it)
    assert(getattr(obs.getPlayerCommon(), 'minerals') === 1000)
    assert(getattr(obs.getPlayerCommon(), 'vespene') === 200)
    assert(getattr(obs.getPlayerCommon(), 'food_cap') === 200)
    assert(getattr(obs.getPlayerCommon(), 'food_used') === 198)
    assert(getattr(obs.getPlayerCommon(), 'food_army') === 140)
    assert(getattr(obs.getPlayerCommon(), 'food_workers') === 58)
    assert(getattr(obs.getPlayerCommon(), 'idle_worker_count') === 2) // (didn't set it)
    assert(getattr(obs.getPlayerCommon(), 'army_count') === 92)
    assert(getattr(obs.getPlayerCommon(), 'warp_gate_count') === 7)
    assert(getattr(obs.getPlayerCommon(), 'larva_count') === 15)
  }
  testPlayerCommonCanBeSet()

  function testScoreCanBeSet() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    testState._builder.score(54321)
    const obs = testState._get_obs()
    assert(obs.getScore().getScore() === 54321, 'obs.getScore().getScore() === 54321')
    count += 1
  }
  testScoreCanBeSet()

  function testScoreDetailsCanBeSet() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    testState._builder.score_details({
      idle_production_time: 1,
      idle_worker_time: 2,
      total_value_units: 3,
      killed_value_units: 5,
      killed_value_structures: 6,
      collected_minerals: 7,
      collected_vespene: 8,
      collection_rate_minerals: 9,
      collection_rate_vespene: 10,
      spent_minerals: 11,
      spent_vespene: 12,
    })
    const obs = testState._get_obs()
    assert(getattr(obs.getScore().getScoreDetails(), 'idle_production_time') === 1)
    assert(getattr(obs.getScore().getScoreDetails(), 'idle_worker_time') === 2)
    assert(getattr(obs.getScore().getScoreDetails(), 'total_value_units') === 3)
    assert(getattr(obs.getScore().getScoreDetails(), 'total_value_structures') === 230)
    assert(getattr(obs.getScore().getScoreDetails(), 'killed_value_units') === 5)
    assert(getattr(obs.getScore().getScoreDetails(), 'killed_value_structures') === 6)
    assert(getattr(obs.getScore().getScoreDetails(), 'collected_minerals') === 7)
    assert(getattr(obs.getScore().getScoreDetails(), 'collected_vespene') === 8)
    assert(getattr(obs.getScore().getScoreDetails(), 'collection_rate_minerals') === 9)
    assert(getattr(obs.getScore().getScoreDetails(), 'collection_rate_vespene') === 10)
    assert(getattr(obs.getScore().getScoreDetails(), 'spent_minerals') === 11)
    assert(getattr(obs.getScore().getScoreDetails(), 'spent_vespene') === 12)
    count += 1
  }
  testScoreDetailsCanBeSet()

  function testScoreByCategorySpec() {
    //Note that if these dimensions are changed, client code is liable to break.//
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const score = testState._obs_spec.score_by_category
    assert(score[0] === 11, 'testState._obs_spec.score_by_category[0] === 11')
    assert(score[1] === 5, 'testState._obs_spec.score_by_category[1] === 5')
    count += 1
  }
  testScoreByCategorySpec()

  function testScoreByCategory() {
    console.log(` running test "${getFuncName()}"`)
    const arr = features.ScoreByCategory.toArray()
    for (let i = 0; i < arr.length; i++) {
      testState = new TestCase()
      const entry_name = arr[i].key
      testState._builder.score_by_category({
        entry_name,
        none: 10,
        army: 1200,
        economy: 400,
        technology: 100,
        upgrade: 200,
      })
      const response_observation = testState._builder.build()
      const obs = response_observation.getObservation()
      const entry = getattr(obs.getScore().getScoreDetails(), entry_name)
      assert(entry.getNone() === 10, 'entry.getNone() === 10')
      assert(entry.getArmy() === 1200, 'entry.getArmy() === 1200')
      assert(entry.getEconomy() === 400, 'entry.getEconomy() === 400')
      assert(entry.getTechnology() === 100, 'entry.getTechnology() === 100')
      assert(entry.getUpgrade() === 200, 'entry.getUpgrade() === 200')
      // Check the transform_obs does what we expect, too.
      const transformed_obs = testState._features.transform_obs(response_observation)
      const transformed_entry = transformed_obs.score_by_category[entry_name]
      assert(transformed_entry.none === 10, 'transformed_obs.none === 10')
      assert(transformed_entry.army === 1200, 'transformed_entry.army === 1200')
      assert(transformed_entry.economy === 400, 'transformed_entry.economy === 400')
      assert(transformed_entry.technology === 100, 'transformed_entry.technology === 100')
      assert(transformed_entry.upgrade === 200, 'transformed_entry.upgrade === 200')
    }
    count += 1
  }
  testScoreByCategory()

  function testScoreByVitalSpec() {
    //Note that if these dimensions are changed, client code is liable to break.
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const scoreVital = testState._obs_spec.score_by_vital
    assert(scoreVital[0] === 3, 'scoreVital[0] === 3')
    assert(scoreVital[1] === 3, 'scoreVital[1] === 3')
    count += 1
  }
  testScoreByVitalSpec()

  function testScoreByVital() {
    console.log(` running test "${getFuncName()}"`)
    const arr = features.ScoreByVital.toArray()
    for (let i = 0; i < arr.length; i++) {
      testState = new TestCase()
      const entry_name = arr[i].key
      testState._builder.score_by_vital({
        entry_name,
        life: 1234,
        shields: 45,
        energy: 423,
      })
      const response_observation = testState._builder.build()
      const obs = response_observation.getObservation()
      const entry = getattr(obs.getScore().getScoreDetails(), entry_name)
      assert(entry.getLife() === 1234, 'entry.getLife() === 1234')
      assert(entry.getShields() === 45, 'entry.getShields() === 45')
      assert(entry.getEnergy() === 423, 'entry.getEnergy() === 423')

      // Check the transform_obs does what we expect, too.
      const transform_obs = testState._features.transform_obs(response_observation)
      const transformed_entry = transform_obs.score_by_vital[entry_name]
      assert(transformed_entry.life === 1234, 'transformed_entry.life === 1234')
      assert(transformed_entry.shields === 45, 'transformed_entry.shields === 45')
      assert(transformed_entry.energy === 423, 'transformed_entry.energy === 423')
    }
    count += 1
  }
  testScoreByVital()

  function testRgbMinimapMatchesSpec() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const obs = testState._get_obs()
    testState._check_layer(obs.getRenderData().getMinimap(), 64, 60, 24)
    count += 1
  }
  testRgbMinimapMatchesSpec()

  function testNoSingleSelect() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const obs = testState._get_obs()
    assert(obs.getUiData().hasSingle() === false, 'obs.getUiData().hasSingle() === false')
    count += 1
  }
  testNoSingleSelect()

  function testWithSingleSelect() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    testState._builder.single_select(_PROBE)
    const obs = testState._get_obs()
    testState._check_unit(obs.getUiData().getSingle().getUnit(), _PROBE)
    count += 1
  }
  testWithSingleSelect()

  function testNoMultiSelect() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const obs = testState._get_obs()
    assert(obs.getUiData().hasMulti() === false, 'obs.getUiData().hasMulti() === false')
    count += 1
  }
  testNoMultiSelect()

  function testMultiSelect() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const nits = [_MOTHERSHIP, _PROBE, _PROBE, _ZEALOT]
    testState._builder.multi_select(nits)
    const obs = testState._get_obs()
    assert(obs.getUiData().getMulti().getUnitsList().length === 4, 'obs.getUiData().getMulti().getUnitsList().length === 4')
    const protoUnits = obs.getUiData().getMulti().getUnitsList()
    for (let i = 0; i < nits.length; i++) {
      testState._check_unit(protoUnits[i], nits[i])
    }
    count += 1
  }
  testMultiSelect()

  function testBuildQueue() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const nits = [_MOTHERSHIP, _PROBE]
    const production = [
      { 'ability_id': actions.FUNCTIONS.Train_Mothership_quick.ability_id, 'build_progress': 0.5 },
      { 'ability_id': actions.FUNCTIONS.Train_Probe_quick.ability_id, 'build_progress': 0 },
      { 'ability_id': actions.FUNCTIONS.Research_ShadowStrike_quick.ability_id, 'build_progress': 0 },
    ]
    testState._builder.build_queue(nits, production)
    const obs = testState._get_obs()
    const buildQueue = obs.getUiData().getProduction().getBuildQueueList()
    assert(buildQueue.length === 2, 'buildQueue.length === 2')

    for (let i = 0; i < nits.length; i++) {
      testState._check_unit(buildQueue[i], nits[i])
    }
    const productionQueue = obs.getUiData().getProduction().getProductionQueueList()
    assert(productionQueue.length === 3, 'productionQueue.length === 3')

    for (let i = 0; i < nits.length; i++) {
      testState._check_unit(productionQueue[i], production[i])
      assert(productionQueue[i].get)
    }
  }
  testBuildQueue()

  function testFeatureUnitsAreAdded() {
    console.log(` running test "${getFuncName()}"`)
    testState = new TestCase()
    const pos1 = new common_pb.Point()
    pos1.setX(10)
    pos1.setY(10)
    pos1.setZ(0)
    const pos2 = new common_pb.Point()
    pos2.setX(11)
    pos2.setY(12)
    pos2.setZ(0)
    const feature_units = [
      new dummy_observation.FeatureUnit({
        unit_type: units.Protoss.Probe,
        alliance: features.PlayerRelative.SELF,
        owner: 1,
        pos: pos1,
        radius: 1.0,
        health: 10,
        health_max: 20,
        is_on_screen: true,
        shield: 0,
        shield_max: 20
      }),
      new dummy_observation.FeatureUnit({
        unit_type: units.Terran.Marine,
        alliance: features.PlayerRelative.SELF,
        owner: 1,
        pos: pos2,
        radius: 1.0,
        health: 35,
        health_max: 45,
        is_on_screen: true,
        shield: 0,
        shield_max: 0
      }),
    ]

    testState._builder.feature_units(feature_units)
    const obs = testState._get_obs()
    const protoUnits = obs.getRawData().getUnitsList()
    for (let i = 0; i < feature_units.length; i++) {
      testState._check_feature_unit(protoUnits[i], feature_units[i])
    }
    count += 1
  }
  testFeatureUnitsAreAdded()

  console.log(`\n----------------------------------------------------------------------\nRan ${count} test(s) in ${(performance.now() * msToS) - start_timer}s\n\n`)
}

DummyObservationTest()
