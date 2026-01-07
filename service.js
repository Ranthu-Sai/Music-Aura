// service.js
import TrackPlayer, {Capability, Event} from 'react-native-track-player';
import historyManager from './Utils/HistoryManager';
import autoRecommendations from './Utils/AutoRecommendations';
import smartPrefetchManager from './Utils/SmartPrefetchManager';

let isPlayerInitialized = false;

export default async function PlaybackService() {
  // Queue remote actions to avoid race conditions without relying on timers
  let actionChain = Promise.resolve();
  // Register remote handlers immediately so notification actions work
  // even when the app is backgrounded or killed
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      await TrackPlayer.play();
    } catch (e) {
      console.warn('RemotePlay handler failed', e);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      await TrackPlayer.pause();
    } catch (e) {
      console.warn('RemotePause handler failed', e);
    }
  });

  // Next: use TrackPlayer's skipToNext to avoid headless index issues
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    actionChain = actionChain.then(async () => {
      try {
        const active = await TrackPlayer.getActiveTrack();
        const queue = await TrackPlayer.getQueue();
        const currentIndex = queue.findIndex(
          t => t && active && t.id === active.id,
        );

        if (currentIndex >= 0) {
          const nextIndex = currentIndex + 1;
          const nextTrack = queue[nextIndex];
          if (nextTrack) {
            // Ensure next track has a valid stream BEFORE skipping
            if (smartPrefetchManager.needsStream(nextTrack)) {
              const cached = smartPrefetchManager.getPrefetchedStream(
                nextTrack.id,
              );
              const data =
                cached ||
                (await smartPrefetchManager.fetchOnDemand(nextTrack.id));
              if (data && data.url) {
                await smartPrefetchManager.replaceTrackImmediately(
                  nextIndex,
                  nextTrack,
                  data,
                );
              }
            }
            await TrackPlayer.skip(nextIndex);
            await TrackPlayer.play();

            // Opportunistically prepare N+1
            const q2 = await TrackPlayer.getQueue();
            const t2 = q2[nextIndex + 1];
            if (t2 && smartPrefetchManager.needsStream(t2)) {
              const c2 = smartPrefetchManager.getPrefetchedStream(t2.id);
              const d2 =
                c2 || (await smartPrefetchManager.fetchOnDemand(t2.id));
              if (d2 && d2.url) {
                await smartPrefetchManager.replaceTrackImmediately(
                  nextIndex + 1,
                  t2,
                  d2,
                );
              }
            }
            return;
          }
        }

        // Fallback if index resolution failed
        await TrackPlayer.skipToNext();
        await TrackPlayer.play();
      } catch (err) {
        console.error('RemoteNext handler failed', err);
      }
    });
  });

  // Previous: use TrackPlayer's skipToPrevious to avoid headless index issues
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    actionChain = actionChain.then(async () => {
      try {
        const active = await TrackPlayer.getActiveTrack();
        const queue = await TrackPlayer.getQueue();
        const currentIndex = queue.findIndex(
          t => t && active && t.id === active.id,
        );

        if (currentIndex >= 0) {
          const prevIndex = currentIndex - 1;
          const prevTrack = queue[prevIndex];
          if (prevTrack && prevIndex >= 0) {
            if (smartPrefetchManager.needsStream(prevTrack)) {
              const cached = smartPrefetchManager.getPrefetchedStream(
                prevTrack.id,
              );
              const data =
                cached ||
                (await smartPrefetchManager.fetchOnDemand(prevTrack.id));
              if (data && data.url) {
                await smartPrefetchManager.replaceTrackImmediately(
                  prevIndex,
                  prevTrack,
                  data,
                );
              }
            }
            await TrackPlayer.skip(prevIndex);
            await TrackPlayer.play();
            return;
          }
        }

        await TrackPlayer.skipToPrevious();
        await TrackPlayer.play();
      } catch (err) {
        console.error('RemotePrevious handler failed', err);
      }
    });
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async e => {
    try {
      await TrackPlayer.seekTo(e.position);
    } catch (e2) {
      console.warn('RemoteSeek failed', e2);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try {
      await TrackPlayer.pause();
    } catch (e) {
      console.warn('RemoteStop handler failed', e);
    }
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
      TrackPlayer.addEventListener(
        Event.PlaybackActiveTrackChanged,
        async event => {
          if (event.track?.id) {
            // Just log the track change, HistoryManager handles the "add unique" logic
            await historyManager.startTracking(event.track);
          }
        },
      );

      // Auto-recommendations listeners
      autoRecommendations.initializeListeners();

      // Ensure Smart Prefetch Manager is active in headless/background service
      // so remote next/previous work reliably when the app is closed
      try {
        // Mark prefetch manager as headless to disable grace period
        smartPrefetchManager.setHeadlessMode(true);
        smartPrefetchManager.initialize();
      } catch (e) {
        console.warn(
          'SmartPrefetchManager initialization in service failed',
          e,
        );
      }

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
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
      });

      // Initialize history manager (now lightweight)
      await historyManager.initialize();
    } catch (error) {
      if (
        error.message &&
        error.message.includes('player has already been initialized')
      ) {
        isPlayerInitialized = true;
      } else if (
        error.message &&
        error.message.includes('app must be in the foreground')
      ) {
        // Player initialization failed because app is in background - this is expected
        // The player will be initialized when the app comes to foreground
        console.warn('Player setup deferred: App is in background');
      } else {
        console.error('Error initializing player in service.js:', error);
      }
    }
  };

  // Return initialization promise as expected by react-native-track-player
  // to properly wire up the headless service lifecycle.
  return initializePlayer();
}
