const usedVal = { val: 0 }
const perf_hooks = {
  usedVal,
  useRealish: false,
  set return_val(val) {
    usedVal.val = val
  },
  get return_val() {
    return usedVal.val
  },
  performance: {
    now() {
      if (perf_hooks.useRealish) {
        return Date.now()
      }
      return usedVal.val
    },
  },
}
module.exports = perf_hooks
