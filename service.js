import TrackPlayer, { Capability, Event } from "react-native-track-player";

let playerInitialized = false;

export const PlaybackService = async function () {
  if (!playerInitialized) {
    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
        autoHandleInterruptions: true, // Auto-handle audio focus
      });
      playerInitialized = true;
    } catch (error) {
      if (error.message?.includes('already been initialized')) {
        playerInitialized = true;
      }
    }
  }

  try {
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
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
