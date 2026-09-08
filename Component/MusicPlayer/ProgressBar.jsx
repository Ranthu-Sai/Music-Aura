import React, {useEffect, useRef, useState, memo} from 'react';
import {Dimensions, View, Text, StyleSheet} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {
  useActiveTrack,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';

const {width} = Dimensions.get('window');
// Proportional progress bar width: balanced with artwork (86% of screen, max 380)
const BAR_WIDTH = Math.min(width * 0.86, 380);

export const ProgressBar = memo(() => {
  const theme = useTheme();
  const {position, duration} = useProgress(250);
  const currentTrack = useActiveTrack();
  const playbackState = usePlaybackState();

  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [wasPlaying, setWasPlaying] = useState(false);

  // Stable references for gesture and playback coordination
  const stableDurationRef = useRef(0);
  const sliderValueRef = useRef(0);
  const isSlidingRef = useRef(false);
  const lastSeekTimeRef = useRef(0);
  const touchAreaRef = useRef(null);
  const barLayoutRef = useRef({pageX: 0, width: BAR_WIDTH});

  const updateSliderValue = val => {
    const safeVal = Number.isFinite(val) ? Math.max(0, val) : 0;
    sliderValueRef.current = safeVal;
    setSliderValue(safeVal);
  };

  // Keep slider in sync with playback when not dragging and not recovering from a seek
  useEffect(() => {
    if (isSliding || isSlidingRef.current) {
      return;
    }

    // Ignore temporary stale position reports right after seeking (ExoPlayer buffering)
    if (Date.now() - lastSeekTimeRef.current < 800) {
      if (Math.abs((position || 0) - sliderValueRef.current) > 3) {
        return;
      }
    }

    if (Number.isFinite(position)) {
      updateSliderValue(Math.max(0, position));
    }
  }, [position, isSliding]);

  // Reset on track change
  useEffect(() => {
    updateSliderValue(0);
    isSlidingRef.current = false;
    setIsSliding(false);
    stableDurationRef.current = 0;
  }, [currentTrack?.id]);

  // Stabilize duration to avoid flicker
  useEffect(() => {
    const d = Number.isFinite(duration) ? duration : 0;
    if (d > 0) {
      if (stableDurationRef.current === 0 || d >= stableDurationRef.current - 1) {
        stableDurationRef.current = Math.max(stableDurationRef.current, d);
      }
    }
  }, [duration]);

  const formatTime = val => {
    if (!Number.isFinite(val) || val < 0) {
      return '0:00';
    }
    const total = Math.round(val);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const accurateDuration =
    Number.isFinite(currentTrack?.duration) && currentTrack?.duration > 0
      ? currentTrack.duration
      : stableDurationRef.current > 0
      ? stableDurationRef.current
      : Number.isFinite(duration) && duration > 0
      ? duration
      : 0;

  const clampedSliderValue = isSliding
    ? Math.max(0, Math.min(sliderValue, accurateDuration || 0))
    : Math.max(0, Math.min(position || 0, accurateDuration || 0));

  const progressPercent =
    accurateDuration > 0
      ? Math.max(0, Math.min(100, (clampedSliderValue / accurateDuration) * 100))
      : 0;

  const measureBar = () => {
    if (touchAreaRef.current) {
      touchAreaRef.current.measure((x, y, measuredWidth, height, pageX) => {
        if (measuredWidth > 0) {
          barLayoutRef.current = {
            pageX: pageX || 0,
            width: measuredWidth || BAR_WIDTH,
          };
        }
      });
    }
  };

  const getPositionFromEvent = event => {
    const maxValue = accurateDuration || 0;
    if (maxValue <= 0) {
      return 0;
    }

    const barWidth = barLayoutRef.current.width || BAR_WIDTH;
    let localX = 0;

    // Use absolute screen pageX if available to avoid coordinate jumps from nested views
    if (
      typeof event?.nativeEvent?.pageX === 'number' &&
      barLayoutRef.current.pageX > 0
    ) {
      localX = event.nativeEvent.pageX - barLayoutRef.current.pageX;
    } else if (typeof event?.nativeEvent?.locationX === 'number') {
      localX = event.nativeEvent.locationX;
    }

    const clampedX = Math.max(0, Math.min(localX, barWidth));
    return (clampedX / barWidth) * maxValue;
  };

  const handleTouchGrant = event => {
    measureBar();
    const playing =
      playbackState?.state === 3 ||
      playbackState === 3 ||
      playbackState?.state === 'playing';
    setWasPlaying(Boolean(playing));

    isSlidingRef.current = true;
    setIsSliding(true);

    const target = getPositionFromEvent(event);
    updateSliderValue(target);
  };

  const handleTouchMove = event => {
    if (!isSlidingRef.current) {
      return;
    }
    const target = getPositionFromEvent(event);
    updateSliderValue(target);
  };

  const handleTouchRelease = async event => {
    // Determine the intended seek position:
    // If event has valid coordinates, compute them; otherwise use sliderValueRef (last scrubbed point)
    let target = sliderValueRef.current;
    if (event && event.nativeEvent) {
      const releasePos = getPositionFromEvent(event);
      if (Number.isFinite(releasePos) && releasePos > 0) {
        target = releasePos;
      }
    }

    const maxValue = accurateDuration || 0;
    const safeTarget = Math.max(0, Math.min(target, maxValue));

    updateSliderValue(safeTarget);
    lastSeekTimeRef.current = Date.now();

    try {
      await TrackPlayer.seekTo(safeTarget);
      if (wasPlaying) {
        await TrackPlayer.play();
      }
    } catch (e) {
      console.warn('TrackPlayer.seekTo failed:', e);
    } finally {
      // Keep isSliding true briefly while player buffers the new position
      setTimeout(() => {
        isSlidingRef.current = false;
        setIsSliding(false);
      }, 350);
    }
  };

  return (
    <View style={styles.container}>
      {/* Touch & Progress Track */}
      <View
        ref={touchAreaRef}
        style={[styles.touchArea, {width: BAR_WIDTH}]}
        hitSlop={{top: 14, bottom: 14, left: 0, right: 0}}
        onLayout={measureBar}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouchGrant}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchRelease}
        onResponderTerminate={handleTouchRelease}>
        {/* Background Track - pointerEvents="none" prevents event target hijacking */}
        <View
          pointerEvents="none"
          style={[
            styles.trackBackground,
            {
              backgroundColor: theme.dark
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(0, 0, 0, 0.15)',
            },
          ]}>
          {/* Active Filled Track */}
          <View
            pointerEvents="none"
            style={[
              styles.trackActive,
              {
                width: `${progressPercent}%`,
                backgroundColor: '#FFFFFF',
              },
            ]}
          />
        </View>

        {/* Tactile Thumb Indicator - pointerEvents="none" so touch targets the bar */}
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: `${progressPercent}%`,
              transform: [{scale: isSliding ? 1.25 : 1}],
            },
          ]}
        />
      </View>

      {/* Timestamps perfectly aligned with Progress Track */}
      <View style={[styles.timeRow, {width: BAR_WIDTH}]}>
        <Text style={styles.timeText}>{formatTime(clampedSliderValue)}</Text>
        <Text style={styles.timeText}>{formatTime(accurateDuration)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 2,
  },
  touchArea: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  trackActive: {
    height: 5,
    borderRadius: 2.5,
  },
  thumb: {
    position: 'absolute',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1DB954',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    paddingHorizontal: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.2,
  },
});
