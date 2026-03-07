/**
 * Shared flag to suppress RepeatMode.Track revert during user-initiated skips.
 *
 * When a user manually presses Next/Previous, the repeat-one handler in service.js
 * should NOT revert the skip back to the old track. Both service.js and
 * MusicPlayerFunctions.js import this module to coordinate the flag.
 */

let _suppressed = false;

const ManualSkipFlag = {
  /** Call before a user-initiated skip to suppress repeat-one revert */
  suppress() {
    _suppressed = true;
  },

  /** Returns true if a manual skip is in progress (consumes the flag) */
  consumeIfSuppressed() {
    if (_suppressed) {
      _suppressed = false;
      return true;
    }
    return false;
  },

  /** Reset without consuming (e.g. on error) */
  reset() {
    _suppressed = false;
  },
};

export default ManualSkipFlag;
