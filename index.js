/**
 * @format
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry, LogBox, Alert } from 'react-native';
import App from './App';
import appJson from './app.json';
const appName = appJson.name;
import TrackPlayer, { Event } from "react-native-track-player";
import { PlaybackService } from "./service";
import { CacheManager } from './Utils/NavigationCacheManager';
import smartPrefetchManager from './Utils/SmartPrefetchManager';
import { hideLogs, showLogs } from './Utils/LogControl';
import { PlayNextSong, PlayPreviousSong } from './MusicPlayerFunctions';
import { PermissionsAndroid, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Logging: keep logs visible in development, hide only in production
if (__DEV__) {
  showLogs();
} else {
  hideLogs();
}

// Request notification permission for Android 13+
if (Platform.OS === 'android') {
  const systemVersion = parseFloat(DeviceInfo.getSystemVersion());
  if (systemVersion >= 13) {
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
  }
}

// Optional extra hard-mute in production (already handled by hideLogs)
// Keeping for parity but guarded to production only
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
    // Removed user-facing error dialog to prevent interruption
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

// Register the playback service using require to ensure proper headless loading
TrackPlayer.registerPlaybackService(() => require('./service').PlaybackService);

// Register the main application component
AppRegistry.registerComponent(appName, () => App);
