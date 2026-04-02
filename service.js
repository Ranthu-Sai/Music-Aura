// service.js
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
  RepeatMode,
} from 'react-native-track-player';
import historyManager from './Utils/HistoryManager';
import autoRecommendations from './Utils/AutoRecommendations';
import ManualSkipFlag from './Utils/ManualSkipFlag';
import youtubeStreamingService from './Utils/YouTubeStreamingService';
// SmartPrefetchManager is initialized from UI; disabled in headless to preserve queue order

let isPlayerInitialized = false;
let initializePromise = null;

// Queue remote actions to avoid race conditions without relying on timers
// Legacy actionChain no longer required after making handlers immediate
// Keeping for reference but unused
// let actionChain = Promise.resolve();
// Track temporary ducking state to restore playback and volume when interruptions end
let wasPausedByDuck = false;
let previousVolume = 1.0;

// Prevent rapid-fire skip operations that can cause queue corruption
let lastSkipTime = 0;
const SKIP_DEBOUNCE_MS = 300; // 300ms minimum between skips

export default async function PlaybackService() {

  const ensureActiveTrackStreamReady = async () => {
    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      if (!activeTrack || typeof activeIndex !== 'number' || activeIndex < 0) {
        return false;
      }

      const hasPlaceholderUrl =
        typeof activeTrack.url === 'string' &&
        activeTrack.url.startsWith('ytmusic://');
      const needsStream =
        activeTrack._needsStream === true ||
        activeTrack.isYTMusic === true ||
        hasPlaceholderUrl;

      if (!needsStream) {
        return false;
      }

      const videoId =
        activeTrack.id ||
        (hasPlaceholderUrl ? activeTrack.url.replace('ytmusic://', '') : null);

      if (!videoId) {
        return false;
      }

      const streamData = await youtubeStreamingService.getStreamUrl(videoId);
      if (!streamData || !streamData.url) {
        return false;
      }

      const wasPlaying = (await TrackPlayer.getState()) === State.Playing;

      const updatedTrack = {
        ...activeTrack,
        id: videoId,
        url: streamData.url,
        headers: streamData.headers,
        userAgent: streamData.headers?.['User-Agent'],
        artwork: streamData.thumbnail || activeTrack.artwork,
        duration: streamData.duration || activeTrack.duration,
        title: activeTrack.title || streamData.title,
        _needsStream: false,
        isYTMusic: true,
      };

      await TrackPlayer.remove(activeIndex);
      await TrackPlayer.add(updatedTrack, activeIndex);
      await TrackPlayer.skip(activeIndex);

      if (wasPlaying) {
        await TrackPlayer.play();
      }

      return true;
    } catch (err) {
      console.warn('ensureActiveTrackStreamReady failed', err);
      return false;
    }
  };

  // Register remote handlers synchronously at module level so notification actions work
  // even when the app is backgrounded or killed
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    (async () => {
      try {
        if (!isPlayerInitialized && initializePromise) {
          try { await initializePromise; } catch {}
        }
        await ensureActiveTrackStreamReady();
        await TrackPlayer.play();
      } catch (e) {
        console.warn('RemotePlay handler failed', e);
      }
    })();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    (async () => {
      try {
        if (!isPlayerInitialized && initializePromise) {
          try { await initializePromise; } catch {}
        }
        await TrackPlayer.pause();
      } catch (e) {
        console.warn('RemotePause handler failed', e);
      }
    })();
  });

  // Some Android notification skins send a single Play/Pause toggle action
  TrackPlayer.addEventListener(Event.RemotePlayPause, () => {
    (async () => {
      try {
        if (!isPlayerInitialized && initializePromise) {
          try { await initializePromise; } catch {}
        }
        const state = await TrackPlayer.getState();
        if (state === State.Playing) {
          await TrackPlayer.pause();
        } else {
          await TrackPlayer.play();
        }
      } catch (e) {
        console.warn('RemotePlayPause handler failed', e);
      }
    })();
  });

  // Next: perform an explicit index-based skip to preserve queue order
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    (async () => {
      try {
        // Debounce to prevent rapid-fire skips that can corrupt queue order
        const now = Date.now();
        if (now - lastSkipTime < SKIP_DEBOUNCE_MS) {
          return;
        }
        lastSkipTime = now;

        // Suppress repeat-one revert for this user-initiated skip
        ManualSkipFlag.suppress();
        const queue = await TrackPlayer.getQueue();
        const currentIndex = await TrackPlayer.getActiveTrackIndex();

        if (typeof currentIndex !== 'number' || currentIndex < 0 || queue.length === 0) {
          // Fallback to native skipToNext if we can't determine position
          await TrackPlayer.skipToNext();
          await TrackPlayer.play();
          return;
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) {
          // At end of queue — try native skip which may wrap or trigger end-of-queue
          try {
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
          } catch (endErr) {
            // End of queue reached, nothing to skip to
          }
          return;
        }

        await TrackPlayer.skip(nextIndex);
        await TrackPlayer.play();
      } catch (e) {
        console.warn('RemoteNext failed', e);
      }
    })();
  });

  // Previous: perform an explicit index-based skip to preserve queue order
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    (async () => {
      try {
        // Debounce to prevent rapid-fire skips
        const now = Date.now();
        if (now - lastSkipTime < SKIP_DEBOUNCE_MS) {
          return;
        }
        lastSkipTime = now;

        // Suppress repeat-one revert for this user-initiated skip
        ManualSkipFlag.suppress();
        const currentIndex = await TrackPlayer.getActiveTrackIndex();

        if (typeof currentIndex !== 'number' || currentIndex < 0) {
          await TrackPlayer.skipToPrevious();
          await TrackPlayer.play();
          return;
        }

        if (currentIndex === 0) {
          // At beginning — restart current track
          await TrackPlayer.seekTo(0);
          await TrackPlayer.play();
          return;
        }

        await TrackPlayer.skip(currentIndex - 1);
        await TrackPlayer.play();
      } catch (e) {
        console.warn('RemotePrevious failed', e);
      }
    })();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, e => {
    (async () => {
      try {
        // Normalize position units. Different Android notification skins sometimes send
        // position as milliseconds, as a fraction (0..1), or as a percentage (0..100).
        // Heuristics below try to make sense of the value so seeking works reliably.
        let pos = typeof e.position === 'number' ? e.position : Number(e.position) || 0;
        try {
          const duration = await TrackPlayer.getDuration();
          if (duration) {
            // ms -> s
            if (pos > Math.max(duration * 3, 100000)) {
              pos = pos / 1000;

            } else if (pos > 0 && pos <= 1) {
              // fraction of duration
              pos = pos * duration;

            } else if (pos > 1 && pos <= 100 && pos < duration * 0.9) {
              // percentage (0-100)
              pos = (pos / 100) * duration;

            }
          } else if (pos > 100000) {
            // No duration available but value looks like milliseconds
            pos = pos / 1000;

          }
        } catch (dErr) {
          // Ignore duration lookup errors and proceed with given value
        }

        await TrackPlayer.seekTo(pos);

        // Read back position to encourage notification / media session state update on some devices
        try {
          await TrackPlayer.getPosition();

        } catch (pErr) {
          // no-op
        }
      } catch (e2) {
        console.warn('RemoteSeek failed', e2);
      }
    })();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    (async () => {
      try {
        await TrackPlayer.pause();
      } catch (e) {
        console.warn('RemoteStop handler failed', e);
      }
    })();
  });

  // Proactively resolve placeholder URLs as soon as active track changes.
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
    (async () => {
      try {
        await ensureActiveTrackStreamReady();
      } catch (e) {
        console.warn('ActiveTrack stream resolve failed', e);
      }
    })();
  });

  // If active track is a placeholder URL, resolve it and retry playback.
  TrackPlayer.addEventListener(Event.PlaybackError, () => {
    (async () => {
      try {
        const resolved = await ensureActiveTrackStreamReady();
        if (resolved) {
          await TrackPlayer.play();
        }
      } catch (e) {
        console.warn('PlaybackError recovery failed', e);
      }
    })();
  });

  // Handle audio ducking — lower volume or pause when ducked, resume when it ends
  TrackPlayer.addEventListener(Event.RemoteDuck, e => {
    (async () => {
      try {
        // Permanent interruptions: another app took exclusive focus (e.g., voice call)
        if (e?.permanent) {
          wasPausedByDuck = true;
          await TrackPlayer.pause();
          return;
        }

        // Temporary ducking: lower volume; if OS requests pause, pause
        if (e?.ducking) {
          try {
            // Remember previous volume and apply duck volume when provided
            const vol = await TrackPlayer.getVolume?.();
            if (typeof vol === 'number') {previousVolume = vol;}
          } catch {}
          const duckVolume = typeof e.volume === 'number' ? e.volume : 0.2;
          try { await TrackPlayer.setVolume(duckVolume); } catch {}

          if (e?.paused) {
            wasPausedByDuck = true;
            await TrackPlayer.pause();
          }
          return;
        }

        // Ducking ended: restore volume and resume if we paused due to duck
        try { await TrackPlayer.setVolume(previousVolume); } catch {}
        if (wasPausedByDuck) {
          wasPausedByDuck = false;
          try {
            await TrackPlayer.play();
          } catch (playErr) {
            console.warn('RemoteDuck resume play failed', playErr);
          }
        }
      } catch (err) {
        console.warn('RemoteDuck handler failed', err);
      }
    })();
  });

  // Initialize player setup asynchronously
  const initializePlayer = async () => {

    try {
      if (!isPlayerInitialized) {

        await TrackPlayer.setupPlayer({
          android: {
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.ContinuePlayback,
            alwaysPauseOnInterruption: false,
          },
          autoHandleInterruptions: true,
          autoUpdateMetadata: true,
          waitForBuffer: true,
        });
        console.log('[Service] Player setup completed');
        isPlayerInitialized = true;
      }

      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.ContinuePlayback,
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
      console.log('[Service] Player options updated');

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

      // vivi-music pattern: Handle repeat mode edge cases
      // Repeat-All: Loop back to start when queue finishes
      // Repeat-One: Re-seek to same track on auto-advance
      TrackPlayer.addEventListener(Event.PlaybackState, async event => {
        try {
          if (event.state === State.Ended) {
            const repeatMode = await TrackPlayer.getRepeatMode();
            if (repeatMode === RepeatMode.Queue) {
              // Repeat-All: queue ended, loop back to first track
              const queue = await TrackPlayer.getQueue();
              if (queue.length > 0) {
                await TrackPlayer.skip(0);
                await TrackPlayer.play();
              }
            }
          }
        } catch (err) {
          // Non-critical
        }
      });

      TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async event => {
        try {
          // If this track change was triggered by a user-initiated skip (prev/next button),
          // do NOT revert it even in repeat-one mode.
          if (ManualSkipFlag.consumeIfSuppressed()) {
            return;
          }
          const repeatMode = await TrackPlayer.getRepeatMode();
          if (repeatMode === RepeatMode.Track && event.lastIndex != null && event.index != null && event.index !== event.lastIndex) {
            // Repeat-One: player auto-advanced to next track, seek back
            await TrackPlayer.skip(event.lastIndex);
            await TrackPlayer.seekTo(0);
            await TrackPlayer.play();
          }
        } catch (err) {
          // Non-critical
        }
      });

      // Disable headless SmartPrefetchManager to avoid background queue mutations
      // Prefetching will be managed when the app is in foreground via UI flows
      // to preserve strict queue order during notification interactions

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

  // Kick off initialization and retain promise for remote handlers
  initializePromise = initializePlayer();
}
