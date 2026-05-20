// Minimal log control utilities
const ORIGINAL = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error,
};

function _noop() {}
let _suppressPrefixes = [];

export function applyHideLogs(hide = false) {
  if (hide) {
    console.log = _noop;
    console.info = _noop;
    console.debug = _noop;
    console.warn = _noop;
    console.error = _noop;
  } else {
    console.log = ORIGINAL.log || console.log;
    console.info = ORIGINAL.info || console.info;
    console.debug = ORIGINAL.debug || console.debug;
    console.warn = ORIGINAL.warn || console.warn;
    console.error = ORIGINAL.error || console.error;
    _wrapWithSuppression();
  }
}

function _wrapWithSuppression() {
  console.log = ORIGINAL.log || console.log;
  console.info = ORIGINAL.info || console.info;
  console.debug = ORIGINAL.debug || console.debug;
  console.warn = ORIGINAL.warn || console.warn;
  console.error = ORIGINAL.error || console.error;

  if (!_suppressPrefixes || _suppressPrefixes.length === 0) { return; }

  const shouldSuppress = args => {
    const first = args && args.length > 0 ? args[0] : undefined;
    if (typeof first !== 'string') { return false; }
    return _suppressPrefixes.some(p => first.startsWith(p));
  };

  const wrap = orig => (...args) => {
    try {
      if (shouldSuppress(args)) { return; }
      return orig.apply(console, args);
    } catch (_) {}
  };

  console.log = wrap(ORIGINAL.log || console.log);
  console.info = wrap(ORIGINAL.info || console.info);
  console.debug = wrap(ORIGINAL.debug || console.debug);
  console.warn = wrap(ORIGINAL.warn || console.warn);
  console.error = wrap(ORIGINAL.error || console.error);
}

export function hideLogs() {
  applyHideLogs(true);
}

export function showLogs() {
  applyHideLogs(false);
}

export function suppressLogPrefixes(prefixes = []) {
  _suppressPrefixes = Array.isArray(prefixes) ? prefixes : [];
  _wrapWithSuppression();
}

export function clearSuppressions() {
  _suppressPrefixes = [];
  _wrapWithSuppression();
}

export default {
  applyHideLogs,
  hideLogs,
  showLogs,
  suppressLogPrefixes,
  clearSuppressions,
};
