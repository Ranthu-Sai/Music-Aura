// service.js
import TrackPlayer, { Capability, Event } from "react-native-track-player";
import historyManager from './Utils/HistoryManager';
import autoRecommendations from './Utils/AutoRecommendations';
import { PlayNextSong, PlayPreviousSong } from './MusicPlayerFunctions';

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
          // Optimistic immediate skip so notification updates quickly
          const queue = await TrackPlayer.getQueue();
          const current = await TrackPlayer.getCurrentTrack();
          const nextIndex = (typeof current === 'number') ? current + 1 : 0;

          // If next exists, try a fast cached replacement before skip
          if (queue && queue.length > nextIndex) {
            const next = queue[nextIndex];
            try {
              // Try to require smartPrefetchManager only if present (avoid hard dependency in headless)
              const spm = (function tryRequire() {
                try { return require('./Utils/SmartPrefetchManager'); } catch (e) { return null; }
              })();
              if (spm && typeof spm.getPrefetchedStream === 'function') {
                const cached = spm.getPrefetchedStream(next.id);
                if (cached && cached.url) {
                  // Replace track quickly so TrackPlayer shows correct metadata/url
                  await spm.replaceTrackAndWait(nextIndex, next, cached);
                }
              }
            } catch (e) {
              console.warn('Quick prefetch replace failed (non-fatal)', e);
            }
          }

          // Perform an immediate skip to next so notification updates
          try {
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
          } catch (skipErr) {
            console.warn('Immediate skipToNext failed, trying TrackPlayer.skip()', skipErr);
            try { await TrackPlayer.skip(nextIndex); await TrackPlayer.play(); } catch (e2) { console.error('Fallback skip failed', e2); }
          }

          // NOTE: Removed PlayNextSong() call to prevent double-skip
          // TrackPlayer.skipToNext() already handles the skip operation
          // PlayNextSong().catch(e => console.warn('PlayNextSong background failed', e));
        } catch (err) {
          console.error('RemoteNext handler failed', err);
        }
      });

      TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
        try {
          // Immediate previous for responsive notification behavior
          try {
            await TrackPlayer.skipToPrevious();
            await TrackPlayer.play();
          } catch (skipErr) {
            console.warn('Immediate skipToPrevious failed, falling back to PlayPreviousSong', skipErr);
            await PlayPreviousSong();
          }

          // Run higher-level logic in background to maintain queue/history
          PlayPreviousSong().catch(e => console.warn('PlayPreviousSong background failed', e));
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
