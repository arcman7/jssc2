const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const path = require('path') //eslint-disable-line
const actions = require(path.resolve(__dirname, './actions.js'))
const features = require(path.resolve(__dirname, './features.js'))
const point = require(path.resolve(__dirname, './point.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))
const numpy = require(path.resolve(__dirname, './numpy.js'))

const { isinstance, randomUniform, ValueError } = pythonUtils
const { common_pb, sc2api_pb, spatial_pb, ui_pb } = s2clientprotocol
const sc_pb = sc2api_pb
const RECTANGULAR_DIMENSIONS = new features.Dimensions([84, 80], [64, 67])
const SQUARE_DIMENSIONS = new features.Dimensions(84, 64)
const always_expected = new Set([
  "no_op", "move_camera", "select_point", "select_rect",
  "select_control_group"
])
const testState = { obs: null, features: null }
function hideSpecificActions(hide_specific_actions) {
  testState.features = new features.Features(
    new features.AgentInterfaceFormat({
      feature_dimensions: RECTANGULAR_DIMENSIONS,
      hide_specific_actions,
    })
  )
}
function all(pred, as) {
  for (var a of as) if (!pred(a)) return false; //eslint-disable-line
  return true
}
function isIn(as) {
  return function (a) {
    return as.has(a)
  }
}
function setForEach(set, callback) {
  const iter = set.values()
  const results = []
  let val
  let i = 0
  while(val = iter.next().value) { callback(val, i, results); i++ } //eslint-disable-line
  return results
}
function assertAvail(expected) {
  const actual = testState.features.available_actions(testState.obs)
  const actual_names = new Set()
  actual.forEach((act) => {
    actual_names.add(actions.FUNCTIONS[act].name)
  })
  const compareTo = expected && expected.length ? new Set(expected) : always_expected
  if (all(isIn(actual_names), compareTo) === false) {
    throw new Error(`Sets not equal:\n   recieved:\n    [${setForEach(actual_names, (val, _, results) => results.push(val))}]\n   expected:\n    [${setForEach(compareTo, (val, _, results) => results.push(val))}]`)
  }
}
describe('features.js:', () => {
  beforeEach(() => {
    const playerCommon = new sc_pb.PlayerCommon()
    playerCommon.setPlayerId(1)
    playerCommon.setMinerals(0)
    playerCommon.setVespene(0)
    playerCommon.setFoodCap(10)
    playerCommon.setFoodUsed(0)
    playerCommon.setFoodArmy(0)
    playerCommon.setFoodWorkers(0)
    playerCommon.setIdleWorkerCount(0)
    playerCommon.setArmyCount(0)
    playerCommon.setWarpGateCount(0)
    playerCommon.setLarvaCount(0)
    const observation = new sc_pb.Observation()
    observation.setPlayerCommon(playerCommon)
    observation.setGameLoop(20)
    testState.obs = observation
    hideSpecificActions(true)
  })
  describe('  AvailableActionsTest', () => {
    test('testAlways', () => {
      assertAvail([])
    })
    test('testSelectUnit', () => {
      const obs = testState.obs
      const uiData = new ui_pb.ObservationUI()
      obs.setUiData(uiData)
      const multi = new ui_pb.MultiPanel()
      uiData.setMulti(multi)
      const unit = new ui_pb.UnitInfo()
      unit.setUnitType(1)
      assertAvail(['select_unit'])
    })
    test('testSelectIdleWorkder', () => {
      testState.obs.getPlayerCommon().setIdleWorkerCount(1)
      assertAvail(["select_idle_worker"])
    })
    test('testSelectArmy', () => {
      testState.obs.getPlayerCommon().setArmyCount(3)
      assertAvail(["select_army"])
    })
    test('testSelectWarpGates', () => {
      testState.obs.getPlayerCommon().setWarpGateCount(1)
      assertAvail(["select_warp_gates"])
    })

    test('testSelectLarva', () => {
      testState.obs.getPlayerCommon().setLarvaCount(2)
      assertAvail(["select_larva"])
    })

    test('testQuick', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(32)
      testState.obs.addAbilities(ability)
      assertAvail(["Effect_Salvage_quick"])
    })

    test('testScreen', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(326)
      ability.setRequiresPoint(true)
      testState.obs.addAbilities(ability)
      assertAvail(["Build_SensorTower_screen"])
    })

    test('testScreenMinimap', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(17)
      ability.setRequiresPoint(true)
      testState.obs.addAbilities(ability)
      assertAvail(["Patrol_screen", "Patrol_minimap"])
    })

    test('testScreenAutocast', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(386)
      ability.setRequiresPoint(true)
      testState.obs.addAbilities(ability)
      assertAvail(["Effect_Heal_screen", "Effect_Heal_autocast"])
    })
    test('testScreenQuick', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(421)
      testState.obs.addAbilities(ability)
      hideSpecificActions(true)
      ability.setRequiresPoint(false)
      assertAvail(["Build_TechLab_quick"])
      ability.setRequiresPoint(true)
      assertAvail(["Build_TechLab_screen"])
      hideSpecificActions(false)
      ability.setRequiresPoint(false)
      assertAvail(["Build_TechLab_Barracks_quick", "Build_TechLab_quick"])
      ability.setRequiresPoint(true)
      assertAvail(["Build_TechLab_Barracks_screen", "Build_TechLab_screen"])
    })
    test('testGeneral', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(1374)
      testState.obs.addAbilities(ability)
      hideSpecificActions(false)
      assertAvail(["BurrowDown_quick", "BurrowDown_Baneling_quick"])
      hideSpecificActions(true)
      assertAvail(["BurrowDown_quick"])
    })
    test('testGeneralType', () => {
      const ability = new common_pb.AvailableAbility()
      ability.setAbilityId(1376)
      testState.obs.addAbilities(ability)
      hideSpecificActions(false)
      assertAvail(["BurrowUp_quick", "BurrowUp_Baneling_quick", "BurrowUp_autocast", "BurrowUp_Baneling_autocast"])
      hideSpecificActions(true)
      assertAvail(["BurrowUp_quick", "BurrowUp_autocast"])
      ability.setAbilityId(2110)
      hideSpecificActions(false)
      assertAvail(["BurrowUp_quick", "BurrowUp_Lurker_quick"])
      hideSpecificActions(true)
      assertAvail(["BurrowUp_quick"])
    })
    test('testMany', () => {
      const add = [
        [23, true], // Attack
        [318, true], // Build_CommandCenter
        [320, true], // Build_Refinery
        [319, true], // Build_SupplyDepot
        [316, true], // Effect_Repair_SCV
        [295, true], // Harvest_Gather_SCV
        [16, true], // Move
        [17, true], // Patrol
        [4, false], // Stop
      ]
      add.forEach(([aId, reqP]) => {
        const ability = new common_pb.AvailableAbility()
        ability.setAbilityId(aId)
        ability.setRequiresPoint(reqP)
        testState.obs.addAbilities(ability)
      })
      hideSpecificActions(false)
      assertAvail([
        "Attack_Attack_minimap",
        "Attack_Attack_screen",
        "Attack_minimap",
        "Attack_screen",
        "Build_CommandCenter_screen",
        "Build_Refinery_screen",
        "Build_SupplyDepot_screen",
        "Effect_Repair_screen",
        "Effect_Repair_autocast",
        "Effect_Repair_SCV_autocast",
        "Effect_Repair_SCV_screen",
        "Harvest_Gather_screen",
        "Harvest_Gather_SCV_screen",
        "Move_minimap",
        "Move_screen",
        "Move_Move_minimap",
        "Move_Move_screen",
        "Patrol_minimap",
        "Patrol_screen",
        "Patrol_Patrol_minimap",
        "Patrol_Patrol_screen",
        "Stop_quick",
        "Stop_Stop_quick"
      ])
      hideSpecificActions(true)
      assertAvail([
        "Attack_minimap",
        "Attack_screen",
        "Build_CommandCenter_screen",
        "Build_Refinery_screen",
        "Build_SupplyDepot_screen",
        "Effect_Repair_screen",
        "Effect_Repair_autocast",
        "Harvest_Gather_screen",
        "Move_minimap",
        "Move_screen",
        "Patrol_minimap",
        "Patrol_screen",
        "Stop_quick",
      ])
    })
  })
  describe('  ToPointTest', () => {
    test('testIntAsString', () => {
      const value = features._to_point('32')
      expect(value).toMatchObject(new point.Point(32, 32))
    })
    test('testIntStringTwoArray', () => {
      const value = features._to_point(['32', 64])
      expect(value).toMatchObject(new point.Point(32, 64))
    })
    test('testNullInputReturnsNullOutput', () => {
      expect(() => features._to_point(null)).toThrow(ValueError)
    })
    test('testNullAsFirstElementOfArrayRaises', () => {
      expect(() => features._to_point([null, 32])).toThrow(ValueError)
    })
    test('testNullAsSecondElementOfArrayRaises', () => {
      expect(() => features._to_point([32, null])).toThrow(ValueError)
    })
    test('testSingletonArrayRaises', () => {
      expect(() => features._to_point([32])).toThrow(ValueError)
    })
    test('testThreeArrayRaises', () => {
      expect(() => features._to_point([32, 32, 32])).toThrow(ValueError)
    })
  })
  describe('  DimensionsTest', () => {
    test('testScreenSizeWithoutMinimapRaises', () => {
      expect(() => new features.Dimensions(84)).toThrow(ValueError)
    })
    test('testScreenWidthWithoutHeightRaises', () => {
      expect(() => new features.Dimensions([84, 0], 64)).toThrow(ValueError)
    })
    test('testScreenWidthHeightWithoutMinimapRaises', () => {
      expect(() => new features.Dimensions([84, 80])).toThrow(ValueError)
    })
    test('testMinimapWidthAndHeightWithoutScreenRaises', () => {
      expect(() => new features.Dimensions(undefined, [64, 67])).toThrow(TypeError)
    })
    test('testNullNullRaises', () => {
      expect(() => new features.Dimensions(null, null)).toThrow(TypeError)
    })
    test('testSingularZeroesRaises', () => {
      expect(() => new features.Dimensions(0, 0)).toThrow(ValueError)
    })
    test('testTwoZeroesRaises', () => {
      expect(() => new features.Dimensions([0, 0], [0, 0])).toThrow(ValueError)
    })
    test('testThreeTupleScreenRaises', () => {
      expect(() => new features.Dimensions([1, 2, 3], 32)).toThrow(ValueError)
    })
    test('testThreeTupleMinimapRaises', () => {
      expect(() => new features.Dimensions(64, [1, 2, 3])).toThrow(ValueError)
    })
    test('testNegativeScreenRaises', () => {
      expect(() => new features.Dimensions(-64, 32)).toThrow(ValueError)
    })
    test('testNegativeMinimapRaises', () => {
      expect(() => new features.Dimensions(64, -32)).toThrow(ValueError)
    })
    test('testNegativeScreenTupleRaises', () => {
      expect(() => new features.Dimensions([-64, -64], 32)).toThrow(ValueError)
    })
    test('testNegativeMinimapTupleRaises', () => {
      expect(() => new features.Dimensions(64, [-32, -32])).toThrow(ValueError)
    })
    test('testEquality', () => {
      expect(new features.Dimensions(64, 64)).toMatchObject(new features.Dimensions(64, 64))
      expect(new features.Dimensions(64, 32)).not.toMatchObject(new features.Dimensions(64, 64))
      expect(new features.Dimensions(64, 32)).not.toBe(null)
    })
  })
  describe('  TestParseAgentInterfaceFormat', () => {
    test('test_no_arguments_raises', () => {
      expect(() => features.parse_agent_interface_format()).toThrow(TypeError)
    })
    test('test_invalid_feature_combinations_raise', () => {
      expect(() => features.parse_agent_interface_format({
        feature_screen: 32,
        feature_minimap: null
      })).toThrow(ValueError)
      expect(() => features.parse_agent_interface_format({
        feature_screen: 32,
        feature_minimap: null
      })).toThrow(ValueError)
    })
    test('test_valid_feature_specification_is_parsed', () => {
      const agent_interface_format = features.parse_agent_interface_format({
        feature_screen: 32,
        feature_minimap: [24, 24],
      })
      expect(agent_interface_format.feature_dimensions.screen).toMatchObject(new point.Point(32, 32))
      expect(agent_interface_format.feature_dimensions.minimap).toMatchObject(new point.Point(24, 24))
    })
    test('test_invalid_minimap_combinations_raise', () => {
      expect(() => features.parse_agent_interface_format({
        rgb_screen: 32,
        rgb_minimap: null
      })).toThrow(ValueError)
      expect(() => features.parse_agent_interface_format({
        rgb_screen: null,
        rgb_minimap: 32,
      })).toThrow(TypeError)
      expect(() => features.parse_agent_interface_format({
        rgb_screen: 32,
        rgb_minimap: 64,
      })).toThrow(ValueError)
    })
    test('test_valid_minimap_specification_is_parsed', () => {
      const agent_interface_format = features.parse_agent_interface_format({
        rgb_screen: 32,
        rgb_minimap: [24, 24],
      })
      expect(agent_interface_format.rgb_dimensions.screen).toMatchObject(new point.Point(32, 32))
      expect(agent_interface_format.rgb_dimensions.minimap).toMatchObject(new point.Point(24, 24))
    })
    test('test_invalid_action_space_raises', () => {
      expect(() => {
        features.parse_agent_interface_format({
          feature_screen: 64,
          feature_minimap: 64,
          action_space: "UNKNOWN_ACTION_SPACE",
        })
      }).toThrow(ValueError)
    })
    test('test_valid_action_space_is_parsed', () => {
      actions.ActionSpace._keys.forEach((action_space) => {
        const agent_interface_format = features.parse_agent_interface_format({
          feature_screen: 32,
          feature_minimap: [24, 24],
          rgb_screen: 64,
          rgb_minimap: [48, 48],
          use_raw_units: true,
          action_space,
        })
        expect(agent_interface_format.action_space).toMatchObject(actions.ActionSpace[action_space])
      })
    })
    test('test_camera_width_world_units_are_parsed', () => {
      const agent_interface_format = features.parse_agent_interface_format({
        feature_screen: 32,
        feature_minimap: [24, 24],
        camera_width_world_units: 77
      })
      expect(agent_interface_format.camera_width_world_units).toBe(77)
    })
    test('test_use_feature_units_is_parsed', () => {
      const agent_interface_format = features.parse_agent_interface_format({
        feature_screen: 32,
        feature_minimap: [24, 24],
        use_feature_units: true,
      })
      expect(agent_interface_format.use_feature_units).toBe(true)
    })
  })
  describe('  FeaturesTest', () => {
    test('testFunctionsIdsAreConsistent', () => {
      actions.FUNCTIONS.forEach((f, i) => {
        expect(i).not.toBe(f.id)
      })
    })
    test('testAllVersionsOfAnAbilityHaveTheSameGeneral', () => {
      Object.keys(actions.ABILITY_IDS).forEach((ability_id) => {
        const funcs = actions.ABILITY_IDS[ability_id]
        const temp = {}
        funcs.forEach((f) => {
          temp[f.general_id] = temp[f.general_id] ? temp[f.general_id] + 1 : 1
        })
        expect(Object.keys(temp).length).toBe(1)
      })
    })
    test('testValidFunctionsAreConsistent', () => {
      const feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS
      }))
      const valid_funcs = feats.action_spec()
      valid_funcs.functions.forEach((func_def) => {
        const func = actions.FUNCTIONS[func_def.id.key]
        expect(func_def.id).toBe(func.id)
        expect(func_def.name).toBe(func.name)
        expect(func_def.args.length).toBe(func.args.length)
      })
    })
    function gen_random_function_call(action_spec, func_id) {
      const args = []
      action_spec.functions[func_id.key].args.forEach((arg) => {
        const temp = []
        arg.sizes.forEach((size) => {
          temp.push(randomUniform.int(0, size - 1))
        })
        args.push(temp)
      })
      return new actions.FunctionCall({ function: func_id, arguments: args })
    }
    test('testIdsMatchIndex', () => {
      const feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS,
      }))
      const action_spec = feats.action_spec()
      action_spec.functions.forEach((func_def, func_index) => {
        expect(func_index == func_def.id).toBe(true)
      })
      action_spec.types.forEach((type_def, type_index) => {
        expect(type_index == type_def.id).toBe(true)
      })
    })
    test('testReversingUnknownAction', () => {
      const feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS,
        hide_specific_actions: false,
      }))
      const sc2_action = new sc_pb.Action()
      const actionSpatial = new spatial_pb.ActionSpatial()
      const unitCommand = new spatial_pb.ActionSpatialUnitCommand()
      unitCommand.setAbilityId(6) // Cheer
      actionSpatial.setUnitCommand(unitCommand)
      sc2_action.setActionFeatureLayer(actionSpatial)
      const func_call = feats.reverse_action(sc2_action)
      expect(func_call.function == 0).toBe(true) // No-op
    })
    test('testSpecificActionsAreReversible', () => {
      const feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS,
        hide_specific_actions: false,
      }))
      const action_spec = feats.action_spec()
      action_spec.functions.forEach((func_def) => {
        let func_call
        let sc2_action
        let func_call2
        let sc2_action2
        for (let i = 0; i < 10; i++) {
          func_call = gen_random_function_call(action_spec, func_def.id)
          sc2_action = feats.transform_action(null, func_call, true)
          func_call2 = feats.reverse_action(sc2_action)
          sc2_action2 = feats.transform_action(null, func_call2, true)
          if (func_call2.arguments[0] && func_call2.arguments[0][0] && isinstance(func_call2.arguments[0][0], Enum.EnumMeta)) {
            func_call2.arguments[0][0] = func_call2.arguments[0][0].val
          }
          if (func_def.id == actions.FUNCTIONS.select_rect.id) {
            // Need to check this one manually since the same rect can be
            // defined in multiple ways.
            function rect(a) { //eslint-disable-line
              return new point.Rect(
                new point.Point(...a[1]).floor(),
                new point.Point(...a[2]).floor(),
              )
            }
            expect(func_call.function).toMatchObject(func_call2.function)
            expect(func_call.arguments.length).toBe(func_call2.arguments.length)
            expect(func_call.arguments[0]).toMatchObject(func_call2.arguments[0])
            expect(rect(func_call.arguments)).toMatchObject(rect(func_call2.arguments))
          } else {
            expect(func_call).toMatchObject(func_call2)
          }
          expect(sc2_action.toObject()).toMatchObject(sc2_action2.toObject())
        }
      })
    })
    test('testRawActionUnitTags', () => {
      const map_size = new point.Point(100, 100)
      const feats = new features.Features(
        new features.AgentInterfaceFormat({
          use_raw_units: true,
          action_space: actions.ActionSpace.RAW,
        }),
        map_size
      )
      const tags = []
      for (let i = 0; i < 10; i++) {
        tags.push(randomUniform.int(2 ** 20, 2 ** 24))
      }
      const ntags = numpy.tensor(tags)
      const tag = tags[0]
      const ntag = numpy.tensor(tag)
      function transform(fn) {
        const args = ['now']
        for (let i = 1; i < arguments.length; i++) {
          args.push(arguments[i]) //eslint-disable-line
        }
        const func_call = actions.RAW_FUNCTIONS[fn](...args)
        const skip_available = true
        const proto = feats.transform_action(null, func_call, skip_available)
        return proto.getActionRaw().getUnitCommand()
      }
      expect(transform('Attack_pt', tag, [15, 20]).getUnitTagsList()).toMatchObject([tag])
      expect(transform('Attack_pt', ntag, [15, 20]).getUnitTagsList()).toMatchObject([tag])
      expect(transform('Attack_pt', [tag], [15, 20]).getUnitTagsList()).toMatchObject([tag])
      expect(transform('Attack_pt', [ntag], [15, 20]).getUnitTagsList()).toMatchObject([tag])
      expect(transform('Attack_pt', tags, [15, 20]).getUnitTagsList()).toMatchObject(tags)
      expect(transform('Attack_pt', ntags, [15, 20]).getUnitTagsList()).toMatchObject(tags)
      // python code comment: "Weird, but needed for backwards compatibility"
      expect(transform('Attack_pt', [tags], [15, 20]).getUnitTagsList()).toMatchObject(tags)
      expect(transform('Attack_pt', [ntags], [15, 20]).getUnitTagsList()).toMatchObject(tags)
      expect(transform('Attack_unit', tag, tag).getTargetUnitTag()).toBe(tag)
      expect(transform('Attack_unit', tag, ntag).getTargetUnitTag()).toBe(tag)
      expect(transform('Attack_unit', tag, [tag]).getTargetUnitTag()).toBe(tag)
      expect(transform('Attack_unit', tag, [ntag]).getTargetUnitTag()).toBe(tag)
    })
    test('testCanPickleSpecs', () => {
      console.info('testCanPickleSpecs: Skipping this suite for now.')
    })
    test('testCanPickleFunctionCall', () => {
      console.info('testCanPickleFunctionCall: Skipping this suite for now.')
    })
    test('testCanDeepcopyNumpyFunctionCall', () => {
      console.info('testCanDeepcopyNumpyFunctionCall: Skipping this suite for now.')
    })
    test('testSizeConstructors', () => {
      let feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: SQUARE_DIMENSIONS
      }))
      let spec = feats.action_spec()
      expect(spec.types.screen.sizes).toMatchObject([84, 84])
      expect(spec.types.screen2.sizes).toMatchObject([84, 84])
      expect(spec.types.minimap.sizes).toMatchObject([64, 64])
      feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS
      }))
      spec = feats.action_spec()
      expect(spec.types.screen.sizes).toMatchObject([84, 80])
      expect(spec.types.screen2.sizes).toMatchObject([84, 80])
      expect(spec.types.minimap.sizes).toMatchObject([64, 67])
      // Missing one or the other of game_info and dimensions.
      expect(() => new features.Features()).toThrow(ValueError)
      // Resolution/action space mismatch.
      expect(() => { //eslint-disable-line
        return new features.Features(new features.AgentInterfaceFormat({
          feature_dimensions: RECTANGULAR_DIMENSIONS,
          action_space: actions.ActionSpace.RGB,
        }))
      }).toThrow(ValueError)
      expect(() => { //eslint-disable-line
        return new features.Features(new features.AgentInterfaceFormat({
          rgb_dimensions: RECTANGULAR_DIMENSIONS,
          action_space: actions.ActionSpace.FEATURES,
        }))
      }).toThrow(ValueError)
      expect(() => { //eslint-disable-line
        return new features.Features(new features.AgentInterfaceFormat({
          feature_dimensions: RECTANGULAR_DIMENSIONS,
          rgb_dimensions: RECTANGULAR_DIMENSIONS,
        }))
      }).toThrow(ValueError)
    })
    test('testFlRgbActionSpec', () => {
      const screen = [128, 132]
      const minimap = [74, 77]
      let feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS,
        rgb_dimensions: new features.Dimensions(screen, minimap),
        action_space: actions.ActionSpace.FEATURES
      }))
      let spec = feats.action_spec()
      expect(spec.types.screen.sizes).toMatchObject([84, 80])
      expect(spec.types.screen2.sizes).toMatchObject([84, 80])
      expect(spec.types.minimap.sizes).toMatchObject([64, 67])

      feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS,
        rgb_dimensions: new features.Dimensions(screen, minimap),
        action_space: actions.ActionSpace.RGB,
      }))
      spec = feats.action_spec()
      expect(spec.types.screen.sizes).toMatchObject([128, 132])
      expect(spec.types.screen2.sizes).toMatchObject([128, 132])
      expect(spec.types.minimap.sizes).toMatchObject([74, 77])
    })
    test('testFlRgbObservationSpec', () => {
      const screen = [128, 132]
      const minimap = [74, 77]
      const feats = new features.Features(new features.AgentInterfaceFormat({
        feature_dimensions: RECTANGULAR_DIMENSIONS,
        rgb_dimensions: new features.Dimensions(screen, minimap),
        action_space: actions.ActionSpace.FEATURES,
      }))
      const obs_spec = feats.observation_spec()
      expect(obs_spec["feature_screen"])
        .toMatchObject([features.SCREEN_FEATURES.length, 80, 84])
      expect(obs_spec["feature_minimap"])
        .toMatchObject([features.MINIMAP_FEATURES.length, 67, 64])
      expect(obs_spec["rgb_screen"]).toMatchObject([132, 128, 3])
      expect(obs_spec["rgb_minimap"]).toMatchObject([77, 74, 3])
    })
  })
})
