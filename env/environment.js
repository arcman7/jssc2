
/*Javascript Reinforcement Learning Environment API.*/

const path = require('path') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const { ABCMeta, namedtuple } = pythonUtils

class TimeStep extends namedtuple('TimeStep', ['step_type', 'reward', 'discount', 'observation']) {
  /*Returned with every call to `step` and `reset` on an environment.

  A `TimeStep` contains the data emitted by an environment at each step of
  interaction. A `TimeStep` holds a `step_type`, an `observation`, and an
  associated `reward` and `discount`.

  The first `TimeStep` in a sequence will have `StepType.FIRST`. The final
  `TimeStep` will have `StepType.LAST`. All other `TimeStep`s in a sequence will
  have `StepType.MID.

  Attributes:
    step_type: A `StepType` enum value.
    reward: A scalar, or 0 if `step_type` is `StepType.FIRST`, i.e. at the
      start of a sequence.
    discount: A discount value in the range `[0, 1]`, or 0 if `step_type`
      is `StepType.FIRST`, i.e. at the start of a sequence.
    observation: A NumPy array, or a dict, list or tuple of arrays.
  */
  first() {
    return this.step_type === StepType.FIRST
  }

  mid() {
    return this.step_type === StepType.MID
  }

  last() {
    return this.step_type === StepType.LAST
  }
}

const StepType = Enum.IntEnum('StepType', {
  /*Defines the status of a `TimeStep` within a sequence.*/
  // Denotes the first `TimeStep` in a sequence.
  FIRST: 0,
  // Denotes any `TimeStep` in a sequence that is not FIRST or LAST.
  MID: 1,
  // Denotes the last `TimeStep` in a sequence.
  LAST: 2
})
// Static abstractMethods = [‘names of the methods go here’ ... ]
class Base extends ABCMeta {
  //Abstract base class for javascript RL environments.
  static get abstracMethods() {
    return ['reset', 'step', 'observation_spec', 'action_spec']
  }

  reset() { //eslint-disable-line
  /*
  Starts a new sequence and returns the first `TimeStep` of this sequence.

  Returns:
    A `TimeStep` namedtuple containing:
      step_type: A `StepType` of `FIRST`.
      reward: Zero.
      discount: Zero.
      observation: A NumPy array, or a dict, list or tuple of arrays
        corresponding to `observation_spec()`.
  */
  }

  step(action) { //eslint-disable-line
  /*
  Updates the environment according to the action and returns a `TimeStep`.

  If the environment returned a `TimeStep` with `StepType.LAST` at the
  previous step, this call to `step` will start a new sequence and `action`
  will be ignored.

  This method will also start a new sequence if called after the environment
  has been constructed and `restart` has not been called. Again, in this case
  `action` will be ignored.

  Args:
    action: A NumPy array, or a dict, list or tuple of arrays corresponding to
      `action_spec()`.

  Returns:
    A `TimeStep` namedtuple containing:
      step_type: A `StepType` value.
      reward: Reward at this timestep.
      discount: A discount in the range [0, 1].
      observation: A NumPy array, or a dict, list or tuple of arrays
        corresponding to `observation_spec()`.
  */
  }

  observation_spec() { //eslint-disable-line
  /*
  Defines the observations provided by the environment.

  Returns:
    A tuple of specs (one per agent), where each spec is a dict of shape
      tuples.
  */
  }

  action_spec() { //eslint-disable-line
  /*
  Defines the actions that should be provided to `step`.

  Returns:
    A tuple of specs (one per agent), where each spec is something that
      defines the shape of the actions.
  */
  }

  close() { //eslint-disable-line
  /*
  Frees any resources used by the environment.

  Implement this method for an environment backed by an external process.

  This method be used directly
  */
  }

  __enter__() {
    //Allows the environment to be used in a with-statement context.
    return this
  }

  __exit__(unused_exception_type, unused_exc_value, unused_traceback) { //eslint-disable-line
    //Allows the environment to be used in a with-statement context.
    return this.close()
  }

  __del__() {
    return this.close()
  }
}

module.exports = {
  TimeStep,
  StepType,
  Base,
}
