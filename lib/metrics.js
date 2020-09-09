// Interface for tracking the number and/or latency of episodes and steps.
class _EventTimer {
  // Example event timer to measure step and observation times.
  __enter__() { //eslint-disable-line
    //pass
  }

  __exit__(unused_exception_type, unused_exc_value, unused_traceback) { //eslint-disable-line
    //pass
  }
}

class Metrics {
  // Interface for tracking the number and/or latency of episodes and steps.
  constructor(map_name) { //eslint-disable-line
    //pass
  }

  increment_instance() { //eslint-disable-line
    //pass
  }

  increment_episode() { //eslint-disable-line
    //pass
  }

  measure_step_time(num_steps = 1) { //eslint-disable-line
    // Return a context manager to measure the time to perform N game steps.
    num_steps = null
    return new _EventTimer()
  }

  measure_observation_time() { //eslint-disable-line
    // Return a context manager to measure the time to get an observation.
    return new _EventTimer()
  }

  close() { //eslint-disable-line
    //pass
  }

  __del__() {
    this.close()
  }
}

module.exports = {
  _EventTimer,
  Metrics
}
