/**
 * @format
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import TrackPlayer from "react-native-track-player";
import { PlaybackService } from "./service";

// Register the playback service
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Register the main application component
AppRegistry.registerComponent(appName, () => App);