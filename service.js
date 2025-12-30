// service.js
import TrackPlayer, { Capability, Event } from "react-native-track-player";
import historyManager from './Utils/HistoryManager';
import autoRecommendations from './Utils/AutoRecommendations';
import { PlayPreviousSong } from './MusicPlayerFunctions';

let isPlayerInitialized = false;

export const PlaybackService = async function () {
  try {
    // Register remote handlers early so notification actions work even when
    // the app is backgrounded or player setup is deferred.
    let handlersRegistered = false;
    const registerRemoteHandlers = () => {
      if (handlersRegistered) { return; }
      handlersRegistered = true;

      TrackPlayer.addEventListener(Event.RemotePlay, async () => {
        try { await TrackPlayer.play(); } catch (e) { console.warn('RemotePlay handler failed', e); }
      });

      TrackPlayer.addEventListener(Event.RemotePause, async () => {
        try { await TrackPlayer.pause(); } catch (e) { console.warn('RemotePause handler failed', e); }
      });

      TrackPlayer.addEventListener(Event.RemoteNext, async () => {
        try {
          await TrackPlayer.skipToNext();
          await TrackPlayer.play();
        } catch (err) {
          console.error('RemoteNext handler failed', err);
        }
      });

      TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
        try {
          await TrackPlayer.skipToPrevious();
          await TrackPlayer.play();
        } catch (err) {
          console.error('RemotePrevious handler failed', err);
        }
      });

      TrackPlayer.addEventListener(Event.RemoteSeek, async (e) => {
        try { await TrackPlayer.seekTo(e.position); } catch (e2) { console.warn('RemoteSeek failed', e2); }
      });

      TrackPlayer.addEventListener(Event.RemoteStop, async () => {
        try { await TrackPlayer.pause(); } catch (e) { console.warn('RemoteStop handler failed', e); }
      });
    };

    // Register handlers immediately so notification controls are responsive
    registerRemoteHandlers();

    if (!isPlayerInitialized) {
      await TrackPlayer.setupPlayer({
        android: {
          appKilledPlaybackBehavior: 'ContinuePlayback',
          alwaysPauseOnInterruption: false,
        },
        autoHandleInterruptions: true,
        autoUpdateMetadata: true,
        waitForBuffer: true,
      });
      isPlayerInitialized = true;
    }

    // Simple Event-Driven History Tracking
    TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      if (event.track?.id) {
        // Just log the track change, HistoryManager handles the "add unique" logic
        await historyManager.startTracking(event.track);
      }
    });

    // Auto-recommendations listeners
    autoRecommendations.initializeListeners();

    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: 'ContinuePlayback',
        alwaysPauseOnInterruption: false,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
    });

    // Initialize history manager (now lightweight)
    await historyManager.initialize();

  } catch (error) {
    if (error.message && error.message.includes('player has already been initialized')) {
      isPlayerInitialized = true;
    } else if (error.message && error.message.includes('app must be in the foreground')) {
      // Player initialization failed because app is in background - this is expected
      // The player will be initialized when the app comes to foreground
      console.warn('Player setup deferred: App is in background');
    } else {
      console.error('Error initializing player in service.js:', error);
    }
  }
};
