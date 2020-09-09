/*
Test for sc2_env.
*/
const path = require('path')
const sc2_env = require(path.resolve(__dirname, './sc2_env.js'))

describe('sc2_env.js:', () => {
  describe('  TestNameCroppingAndDeduplication:', () => {
    test('empty:', () => {
      expect(sc2_env.crop_and_deduplicate_names([''])).toMatchObject([''])
    })
    test('single_no_crop', () => {
      expect(sc2_env.crop_and_deduplicate_names(['agent_1'])).toMatchObject(['agent_1'])
    })
    test('single_cropped', () => {
      expect(sc2_env.crop_and_deduplicate_names(['very_long_agent_name_experimental_1'])).toMatchObject(['very_long_agent_name_experimenta'])
    })
    test('no_dupes_no_crop', () => {
      expect(sc2_env.crop_and_deduplicate_names(['agent_1', 'agent_2'])).toMatchObject(['agent_1', 'agent_2'])
    })
    test('no_dupes_cropped', () => {
      expect(sc2_env.crop_and_deduplicate_names(['a_very_long_agent_name_experimental', 'b_very_long_agent_name_experimental'])).toMatchObject(['a_very_long_agent_name_experimen', 'b_very_long_agent_name_experimen'])
    })
    test('dupes_no_crop', () => {
      expect(sc2_env.crop_and_deduplicate_names(['agent_1', 'agent_1'])).toMatchObject(['(1) agent_1', '(2) agent_1'])
    })
    test('dupes_cropped', () => {
      expect(sc2_env.crop_and_deduplicate_names(['very_long_agent_name_experimental_c123', 'very_long_agent_name_experimental_c456'])).toMatchObject(['(1) very_long_agent_name_experim', '(2) very_long_agent_name_experim'])
    })
  })
})
