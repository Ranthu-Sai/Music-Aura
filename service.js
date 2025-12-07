import TrackPlayer, { Capability, Event } from "react-native-track-player";

let playerInitialized = false;

export const PlaybackService = async function () {
  if (!playerInitialized) {
    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
        autoHandleInterruptions: true,
        // Android-specific options for better streaming
        androidAudioContentType: 'music',
        androidAudioFocusMode: 'audiofocus_gain',
        // iOS-specific options
        iosCategory: 'playback',
        iosCategoryMode: 'default',
      });
      playerInitialized = true;
    } catch (error) {
      if (error.message?.includes('already been initialized')) {
        playerInitialized = true;
      }
    }
  }

  try {
    // Debounce mechanism to prevent rapid successive skips
    let lastSkipTime = 0;
    const SKIP_DEBOUNCE_MS = 300; // Minimum time between skips

    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());

    TrackPlayer.addEventListener(Event.RemoteNext, async () => {
      const now = Date.now();
      if (now - lastSkipTime < SKIP_DEBOUNCE_MS) {
        console.log('⏭️ Skip debounced - too fast');
        return;
      }
      lastSkipTime = now;

      try {
        const queue = await TrackPlayer.getQueue();
        const currentIndex = await TrackPlayer.getActiveTrackIndex();

        if (!queue || queue.length === 0) {
          console.warn('⚠️ Cannot skip: Queue is empty');
          return;
        }

        if (currentIndex !== null && currentIndex < queue.length - 1) {
          await TrackPlayer.skipToNext();
          await TrackPlayer.play();
        }
      } catch (error) {
        console.error('❌ Remote next error:', error);
      }
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
      const now = Date.now();
      if (now - lastSkipTime < SKIP_DEBOUNCE_MS) {
        console.log('⏮️ Skip back debounced - too fast');
        return;
      }
      lastSkipTime = now;

      try {
        const queue = await TrackPlayer.getQueue();
        const currentIndex = await TrackPlayer.getActiveTrackIndex();

        if (!queue || queue.length === 0) {
          console.warn('⚠️ Cannot skip back: Queue is empty');
          return;
        }

        if (currentIndex !== null && currentIndex > 0) {
          await TrackPlayer.skipToPrevious();
          await TrackPlayer.play();
        }
      } catch (error) {
        console.error('❌ Remote previous error:', error);
      }
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position));

    // Handle audio focus interruptions from other apps
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
      if (event.paused) {
        // Another app is playing audio, pause our playback
        await TrackPlayer.pause();
      } else if (event.permanent) {
        // Another app took permanent audio focus, stop playback
        await TrackPlayer.pause();
      } else {
        // Temporary interruption, lower volume (ducking)
        await TrackPlayer.setVolume(0.3);
      }
    });

    // Resume when audio focus is regained
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
      // Restore volume when interruption ends
      await TrackPlayer.setVolume(1.0);
    });

    // Add playback error handler
    TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
      // Error logged silently
    });

    await TrackPlayer.updateOptions({
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
  } catch (error) {
    // Error ignored
  }
};
