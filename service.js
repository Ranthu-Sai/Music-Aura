// service.js
import TrackPlayer, {Capability, Event} from 'react-native-track-player';
import historyManager from './Utils/HistoryManager';
import autoRecommendations from './Utils/AutoRecommendations';
import smartPrefetchManager from './Utils/SmartPrefetchManager';
import queueManager from './Utils/QueueManager';

let isPlayerInitialized = false;

export default async function PlaybackService() {

  // Queue remote actions to avoid race conditions without relying on timers
  let actionChain = Promise.resolve();
  // Register remote handlers immediately so notification actions work
  // even when the app is backgrounded or killed
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {

    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        await TrackPlayer.play();
      } catch (e) {
        console.warn('RemotePlay handler failed', e);
      }
    });
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {

    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        await TrackPlayer.pause();
      } catch (e) {
        console.warn('RemotePause handler failed', e);
      }
    });
  });

  // Some Android notification skins send a single Play/Pause toggle action
  TrackPlayer.addEventListener(Event.RemotePlayPause, async () => {

    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        const state = await TrackPlayer.getState();
        // State.Playing == 3 (TrackPlayer.State.Playing) but use truthy check
        if (state === TrackPlayer.STATE_PLAYING || state === 3) {
          await TrackPlayer.pause();
        } else {
          await TrackPlayer.play();
        }
      } catch (e) {
        console.warn('RemotePlayPause handler failed', e);
      }
    });
  });

  // Next: perform an immediate native skip (fast) and queue background repairs
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {

    // Immediate fast path: perform native skip without waiting on the action chain
    (async () => {
      try {

        await TrackPlayer.skipToNext();
        await TrackPlayer.play();
      } catch (e) {
        console.warn('Immediate skipToNext failed', e);
      }
    })();

    // Background repair task queued so it does not delay the immediate response
    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        // Small delay to allow native player to update active track
        await new Promise(res => setTimeout(res, 120));

        const active = await TrackPlayer.getActiveTrack();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        const queue = await TrackPlayer.getQueue();

        if (active && smartPrefetchManager.needsStream(active)) {
          try {
            const cached = smartPrefetchManager.getPrefetchedStream(active.id);
            const data = cached || (await smartPrefetchManager.fetchOnDemand(active.id));
            if (data && data.url) {
              const idx = typeof activeIndex === 'number' && activeIndex >= 0 ? activeIndex : queue.findIndex(t => t && t.id === active.id);
              if (idx >= 0) {
                await smartPrefetchManager.replaceTrackImmediately(idx, active, data);
                await TrackPlayer.play();
              }
            }
          } catch (e) {
            console.warn('Failed to ensure stream for active track after skip (background):', e);
          }
        }

        // If queue is short (e.g., single song), append recommendations to avoid repeats
        try {
          const MIN_QUEUE_LENGTH = 3;
          if (!queue || queue.length <= MIN_QUEUE_LENGTH) {
            const refId = active?.id;
            if (refId) {

              const recs = await queueManager.buildQueueFromRecommendations(
                refId,
                active?.isYTMusic ? 'ytmusic' : active?.source || 'saavn',
                10,
              );

              if (recs && recs.length > 0) {
                await TrackPlayer.add(recs);

                // Kick off prefetch for immediate next track
                try {
                  await queueManager.prefetchNextTrack();
                } catch (pfErr) {
                  console.warn('prefetchNextTrack failed after appending recommendations', pfErr);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Failed to append recommendations after skip (background):', e);
        }
      } catch (err) {
        console.error('RemoteNext background handler failed', err);
      }
    });
  });

  // Previous: perform an immediate native previous (fast) and queue background repairs
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {

    // Immediate fast path
    (async () => {
      try {

        await TrackPlayer.skipToPrevious();
        await TrackPlayer.play();
      } catch (e) {
        console.warn('Immediate skipToPrevious failed', e);
      }
    })();

    // Background repair task queued so it does not delay the immediate response
    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        // Allow native to settle
        await new Promise(res => setTimeout(res, 120));

        const active = await TrackPlayer.getActiveTrack();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        const queue = await TrackPlayer.getQueue();

        if (active && smartPrefetchManager.needsStream(active)) {
          try {
            const cached = smartPrefetchManager.getPrefetchedStream(active.id);
            const data = cached || (await smartPrefetchManager.fetchOnDemand(active.id));
            if (data && data.url) {
              const idx = typeof activeIndex === 'number' && activeIndex >= 0 ? activeIndex : queue.findIndex(t => t && t.id === active.id);
              if (idx >= 0) {
                await smartPrefetchManager.replaceTrackImmediately(idx, active, data);
                await TrackPlayer.play();
              }
            }
          } catch (e) {
            console.warn('Failed to ensure stream for active track after previous (background):', e);
          }
        }

        // If queue is short after previous, append recommendations to avoid repeating the same song
        try {
          const MIN_QUEUE_LENGTH = 3;
          if (!queue || queue.length <= MIN_QUEUE_LENGTH) {
            const refId = active?.id;
            if (refId) {

              const recs = await queueManager.buildQueueFromRecommendations(
                refId,
                active?.isYTMusic ? 'ytmusic' : active?.source || 'saavn',
                10,
              );

              if (recs && recs.length > 0) {
                await TrackPlayer.add(recs);

                // Kick off prefetch for immediate next track
                try {
                  await queueManager.prefetchNextTrack();
                } catch (pfErr) {
                  console.warn('prefetchNextTrack failed after appending recommendations (previous)', pfErr);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Failed to append recommendations after previous (background):', e);
        }
      } catch (err) {
        console.error('RemotePrevious background handler failed', err);
      }
    });
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async e => {

    actionChain = actionChain.catch(() => {}).then(async () => {
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
    });
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {

    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        await TrackPlayer.pause();
      } catch (e) {
        console.warn('RemoteStop handler failed', e);
      }
    });
  });

  // Handle audio ducking (optional) — lower volume or pause when ducked
  TrackPlayer.addEventListener(Event.RemoteDuck, async e => {

    actionChain = actionChain.catch(() => {}).then(async () => {
      try {
        if (e && e.permanent) {
          await TrackPlayer.pause();
        } else {
          // For temporary ducking, pause to avoid harsh audio overlap
          await TrackPlayer.pause();
          // Optionally resume after a short timeout — but we avoid auto-resume to let user decide
        }
      } catch (err) {
        console.warn('RemoteDuck handler failed', err);
      }
    });
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
          // Keep notification persistent when app killed
          appKilledNotification: true,
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
