// service.js
import TrackPlayer, { Capability, Event } from "react-native-track-player";
import historyManager from './Utils/HistoryManager';
import autoRecommendations from './Utils/AutoRecommendations';
import smartPrefetchManager from './Utils/SmartPrefetchManager';

let isPlayerInitialized = false;

export const PlaybackService = function () {
  let remoteSkipLock = false;
  // Register remote handlers immediately so notification actions work
  // even when the app is backgrounded or killed
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try { await TrackPlayer.play(); } catch (e) { console.warn('RemotePlay handler failed', e); }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try { await TrackPlayer.pause(); } catch (e) { console.warn('RemotePause handler failed', e); }
  });

  // Next: prefetch and replace if needed, then skip deterministically
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    if (remoteSkipLock) { return; }
    remoteSkipLock = true;
    try {
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      const nextIndex = typeof currentIndex === 'number' ? currentIndex + 1 : 1;
      const queue = await TrackPlayer.getQueue();
      const nextTrack = queue[nextIndex];

      if (!nextTrack) { return; }

      if (smartPrefetchManager.needsStream(nextTrack)) {
        const cached = smartPrefetchManager.getPrefetchedStream(nextTrack.id);
        let streamData = cached;
        if (!streamData) {
          streamData = await smartPrefetchManager.fetchOnDemand(nextTrack.id);
        }
        if (streamData && streamData.url) {
          await smartPrefetchManager.replaceTrackAndWait(nextIndex, nextTrack, streamData);
        }
      }

      await TrackPlayer.skip(nextIndex);
      await TrackPlayer.play();
    } catch (err) {
      console.error('RemoteNext handler failed', err);
    } finally {
      setTimeout(() => { remoteSkipLock = false; }, 300);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    if (remoteSkipLock) { return; }
    remoteSkipLock = true;
    try {
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      const prevIndex = typeof currentIndex === 'number' ? currentIndex - 1 : 0;
      const queue = await TrackPlayer.getQueue();
      const prevTrack = queue[prevIndex];

      if (!prevTrack || prevIndex < 0) { return; }

      if (smartPrefetchManager.needsStream(prevTrack)) {
        const cached = smartPrefetchManager.getPrefetchedStream(prevTrack.id);
        let streamData = cached;
        if (!streamData) {
          streamData = await smartPrefetchManager.fetchOnDemand(prevTrack.id);
        }
        if (streamData && streamData.url) {
          await smartPrefetchManager.replaceTrackAndWait(prevIndex, prevTrack, streamData);
        }
      }

      await TrackPlayer.skip(prevIndex);
      await TrackPlayer.play();
    } catch (err) {
      console.error('RemotePrevious handler failed', err);
    } finally {
      setTimeout(() => { remoteSkipLock = false; }, 300);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (e) => {
    try { await TrackPlayer.seekTo(e.position); } catch (e2) { console.warn('RemoteSeek failed', e2); }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try { await TrackPlayer.pause(); } catch (e) { console.warn('RemoteStop handler failed', e); }
  });

  // Initialize player setup asynchronously
  const initializePlayer = async () => {
    try {
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

  // Start initialization and return the promise
  return initializePlayer();
};
