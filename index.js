/**
 * @format
 */
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import TrackPlayer from "react-native-track-player";
import { PlaybackService } from "./service";

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Global error handler
const defaultErrorHandler = ErrorUtils.getGlobalHandler();
const errorHandler = (error, isFatal) => {
  if (isFatal) {
    console.error('Fatal error:', error);
  }
  defaultErrorHandler(error, isFatal);
};
ErrorUtils.setGlobalHandler(errorHandler);

// Register the playback service
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Register the main application component
AppRegistry.registerComponent(appName, () => App);