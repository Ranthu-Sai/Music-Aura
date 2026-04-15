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
import smartPrefetchManager from './Utils/SmartPrefetchManager';
// SmartPrefetchManager is now initialized in both UI and headless for seamless background playback

let isPlayerInitialized = false;
let initializePromise = null;
let streamResolutionPromise = null;
let baseListenersRegistered = false;
let playerStateListenersRegistered = false;

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
let lastKnownTrackId = null;
let lastKnownPositionSec = 0;

export default async function PlaybackService() {

  const rememberCurrentPosition = async () => {
    try {
      const track = await TrackPlayer.getActiveTrack();
      const position = Number(await TrackPlayer.getPosition()) || 0;
      if (track?.id && position >= 0) {
        lastKnownTrackId = track.id;
        lastKnownPositionSec = position;
      }
    } catch (_) {}
  };

  const ensureActiveTrackStreamReady = async () => {
    if (streamResolutionPromise) {
      return streamResolutionPromise;
    }

    streamResolutionPromise = (async () => {
      try {
        const activeTrack = await TrackPlayer.getActiveTrack();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        const queue = await TrackPlayer.getQueue();

        if (
          !activeTrack ||
          typeof activeIndex !== 'number' ||
          activeIndex < 0 ||
          activeIndex >= queue.length
        ) {
          return false;
        }

        const hasPlaceholderUrl =
          typeof activeTrack.url === 'string' &&
          activeTrack.url.startsWith('ytmusic://');
        const needsStream =
          activeTrack._needsStream === true || hasPlaceholderUrl;

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

        let currentPosition = 0;
        try {
          currentPosition = Number(await TrackPlayer.getPosition()) || 0;
        } catch (_) {
          currentPosition = 0;
        }

        if (
          currentPosition <= 0 &&
          activeTrack?.id &&
          lastKnownTrackId === activeTrack.id &&
          lastKnownPositionSec > 0
        ) {
          currentPosition = lastKnownPositionSec;
        }

        // Re-verify position and track ID haven't changed during async call
        const latestTrack = await TrackPlayer.getActiveTrack();
        const latestIndex = await TrackPlayer.getActiveTrackIndex();
        const latestQueue = await TrackPlayer.getQueue();

        if (
          !latestTrack ||
          latestTrack.id !== activeTrack.id ||
          latestIndex !== activeIndex ||
          latestIndex < 0 ||
          latestIndex >= latestQueue.length
        ) {
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

        if (wasPlaying) {
          try {
            await TrackPlayer.pause();
          } catch (_) {}
        }

        // Critical: Verify indices again before mutating queue
        const finalQueue = await TrackPlayer.getQueue();
        if (
          latestIndex < finalQueue.length &&
          finalQueue[latestIndex]?.id === activeTrack.id
        ) {
          ManualSkipFlag.suppress();

          // NON-DISRUPTIVE SWAP: Add before remove to prevent player auto-advance
          // 1. Add the updated track at the TARGET index (pushes old one to index + 1)
          await TrackPlayer.add(updatedTrack, latestIndex);

          // 2. Skip to the new track immediately
          await TrackPlayer.skip(latestIndex);

          // 3. Remove the old track (now at latestIndex + 1)
          const queueAfterSwap = await TrackPlayer.getQueue();
          if (latestIndex + 1 < queueAfterSwap.length) {
            await TrackPlayer.remove(latestIndex + 1);
          }

          if (currentPosition > 0) {
            try {
              const duration = Number(streamData.duration) || Number(activeTrack.duration) || 0;
              const safePosition = duration > 0 ? Math.min(currentPosition, duration - 0.5) : currentPosition;
              if (safePosition > 0) {
                await TrackPlayer.seekTo(safePosition);
                lastKnownTrackId = videoId;
                lastKnownPositionSec = safePosition;
              }
            } catch (seekErr) {
              console.warn('Failed to restore playback position after stream swap', seekErr);
            }
          }

          if (wasPlaying) {
            await TrackPlayer.play();
          }

          // Prefetch NEXT track stream to ensure seamless continuation
          const nextIndex = latestIndex + 1;
          if (nextIndex < finalQueue.length) {
            const nextTrack = finalQueue[nextIndex];
            if (
              nextTrack &&
              (nextTrack._needsStream ||
                nextTrack.isYTMusic ||
                (typeof nextTrack.url === 'string' &&
                  nextTrack.url.startsWith('ytmusic://')))
            ) {
              youtubeStreamingService.getStreamUrl(nextTrack.id).catch(() => {});
            }
          }

          return true;
        }
        return false;
      } catch (err) {
        console.warn('ensureActiveTrackStreamReady failed', err);
        return false;
      } finally {
        streamResolutionPromise = null;
      }
    })();

    return streamResolutionPromise;
  };

  // Register remote handlers once so repeated service starts don't stack duplicate listeners.
  if (!baseListenersRegistered) {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    (async () => {
      try {
        if (!isPlayerInitialized && initializePromise) {
          try { await initializePromise; } catch {}
        }
        const activeTrack = await TrackPlayer.getActiveTrack();
        const resumePosition =
          activeTrack?.id && lastKnownTrackId === activeTrack.id
            ? lastKnownPositionSec
            : 0;
        await ensureActiveTrackStreamReady();
        if (resumePosition > 0) {
          try { await TrackPlayer.seekTo(resumePosition); } catch (_) {}
        }
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
        await rememberCurrentPosition();
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
          await rememberCurrentPosition();
          await TrackPlayer.pause();
        } else {
          const activeTrack = await TrackPlayer.getActiveTrack();
          const resumePosition =
            activeTrack?.id && lastKnownTrackId === activeTrack.id
              ? lastKnownPositionSec
              : 0;
          await ensureActiveTrackStreamReady();
          if (resumePosition > 0) {
            try { await TrackPlayer.seekTo(resumePosition); } catch (_) {}
          }
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

        const nextTrack = queue[nextIndex];
        if (!nextTrack) {
          return;
        }

        // Prefetch stream if needed
        if (smartPrefetchManager.needsStream(nextTrack)) {
          const cached = smartPrefetchManager.getPrefetchedStream(nextTrack.id);
          let streamData = cached;
          if (!streamData) {
            streamData = await smartPrefetchManager.fetchOnDemand(nextTrack.id);
          }
          if (streamData && streamData.url) {
            await smartPrefetchManager.replaceTrackAndWait(
              nextIndex,
              nextTrack,
              streamData,
            );
          }
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
        const queue = await TrackPlayer.getQueue();
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

        const prevIndex = currentIndex - 1;
        const prevTrack = queue[prevIndex];
        if (!prevTrack) {
          return;
        }

        // Prefetch stream if needed
        if (smartPrefetchManager.needsStream(prevTrack)) {
          const cached = smartPrefetchManager.getPrefetchedStream(prevTrack.id);
          let streamData = cached;
          if (!streamData) {
            streamData = await smartPrefetchManager.fetchOnDemand(prevTrack.id);
          }
          if (streamData && streamData.url) {
            await smartPrefetchManager.replaceTrackAndWait(
              prevIndex,
              prevTrack,
              streamData,
            );
          }
        }

        await TrackPlayer.skip(prevIndex);
        await TrackPlayer.play();
      } catch (e) {
        console.warn('RemotePrevious failed', e);
      }
    })();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, e => {
    (async () => {
      try {
        // Android remote seek should normally send position in seconds.
        // Some devices/skins may send milliseconds or a 0..1 fraction.
        // Do NOT treat 0..100 as percentage because that corrupts normal seeks
        // in the first 100 seconds of most songs.
        let pos =
          typeof e.position === 'number' ? e.position : Number(e.position) || 0;
        let duration = 0;

        try {
          duration = Number(await TrackPlayer.getDuration()) || 0;
        } catch (_) {
          duration = 0;
        }

        // 0..1 fraction of duration
        if (duration > 0 && pos > 0 && pos <= 1) {
          pos = pos * duration;
        }

        // Milliseconds -> seconds (very large values only)
        if (pos > 100000) {
          pos = pos / 1000;
        }

        // If value is clearly beyond duration, assume milliseconds
        if (duration > 0 && pos > duration + 5) {
          const maybeSeconds = pos / 1000;
          if (maybeSeconds <= duration + 5) {
            pos = maybeSeconds;
          }
        }

        // Clamp to valid playback range
        if (!Number.isFinite(pos)) {
          pos = 0;
        }
        if (pos < 0) {
          pos = 0;
        }
        if (duration > 0 && pos > duration) {
          pos = duration;
        }

        await TrackPlayer.seekTo(pos);

        try {
          const track = await TrackPlayer.getActiveTrack();
          if (track?.id) {
            lastKnownTrackId = track.id;
            lastKnownPositionSec = pos;
          }
        } catch (_) {}

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

  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async event => {
    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      const eventPosition = Number(event?.position);
      if (activeTrack?.id && Number.isFinite(eventPosition) && eventPosition >= 0) {
        lastKnownTrackId = activeTrack.id;
        lastKnownPositionSec = eventPosition;
      }
    } catch (_) {}
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
  baseListenersRegistered = true;
  }

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
        progressUpdateEventInterval: 1,
      });

      if (!playerStateListenersRegistered) {
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

        playerStateListenersRegistered = true;
      }

      // Disable headless SmartPrefetchManager to avoid background queue mutations
      // Prefetching will be managed when the app is in foreground via UI flows
      // to preserve strict queue order during notification interactions

      // Initialize history manager (now lightweight)
      await historyManager.initialize();

      // Enable SmartPrefetchManager in headless mode for background pre-resolution
      smartPrefetchManager.setHeadlessMode(true);
      smartPrefetchManager.initialize();
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
