// Centralized log control
const ORIGINAL = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error,
};

function _noop() {}

export function applyHideLogs(hide = false) {
  if (hide) {
    console.log = _noop;
    console.info = _noop;
    console.debug = _noop;
    console.warn = _noop;
    console.error = _noop;
  } else {
    // Restore originals (if available)
    console.log = ORIGINAL.log || console.log;
    console.info = ORIGINAL.info || console.info;
    console.debug = ORIGINAL.debug || console.debug;
    console.warn = ORIGINAL.warn || console.warn;
    console.error = ORIGINAL.error || console.error;
  }
}

export function hideLogs() { applyHideLogs(true); }
export function showLogs() { applyHideLogs(false); }

export default { applyHideLogs, hideLogs, showLogs };
