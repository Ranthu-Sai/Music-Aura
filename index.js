/**
 * @format
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry, LogBox, Alert } from 'react-native';
import App from './App';
import appJson from './app.json';
const appName = appJson.name;
import TrackPlayer from "react-native-track-player";
import { PlaybackService } from "./service";
import { CacheManager } from './Utils/NavigationCacheManager';
import smartPrefetchManager from './Utils/SmartPrefetchManager';
import { hideLogs } from './Utils/LogControl';

// Hide logs immediately
hideLogs();

// Fallback for console logging in production
if (!__DEV__) {
  const NOOP = () => { };
  console.log = NOOP;
  console.info = NOOP;
  console.debug = NOOP;
}

// Clear stream cache on app startup to remove any invalid cached URLs
// This is especially important after fixing the StreamModule to ensure
// fresh URLs are fetched using the corrected code
try {
  if (CacheManager && CacheManager.clearStreamCache) {
    CacheManager.clearStreamCache();
  }
  if (smartPrefetchManager && smartPrefetchManager.clearCache) {
    smartPrefetchManager.clearCache();
  }
  console.log('✅ Stream cache cleared on app startup');
} catch (e) {
  console.warn('Failed to clear stream cache:', e);
}

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Global error handler — capture uncaught exceptions and prevent app from exiting
const defaultErrorHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
const errorHandler = (error, isFatal) => {
  try {
    console.error('Global caught error:', error, 'isFatal:', isFatal);
    // Optional: send to remote logging here
    if (isFatal) {
      // Show a simple alert to the user but DO NOT rethrow to avoid killing the app
      try {
        Alert.alert('Unexpected error', 'An unexpected error occurred. The app will try to continue.', [
          { text: 'OK' },
        ]);
      } catch (aErr) {
        // ignore alert failures
      }
    }
  } catch (logErr) {
    // ignore logging failure
  }
  // Do not call the default handler for fatal errors to avoid process termination
  if (!isFatal && typeof defaultErrorHandler === 'function') {
    try {
      defaultErrorHandler(error, isFatal);
    } catch (_) {
      // swallow
    }
  }
};
ErrorUtils.setGlobalHandler(errorHandler);

// Catch unhandled promise rejections where supported
try {
  if (typeof global !== 'undefined' && typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (evt) => {
      try {
        console.error('Unhandled promise rejection:', evt.reason || evt);
        // prevent default behavior
        if (evt && typeof evt.preventDefault === 'function') {
          evt.preventDefault();
        }
      } catch (e) { }
    });
  }
} catch (e) { }

// Register the playback service
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Register the main application component
AppRegistry.registerComponent(appName, () => App);
