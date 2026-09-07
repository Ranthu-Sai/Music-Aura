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
  const stableDurationRef = useRef(0);

  // Keep slider in sync when not actively dragging
  useEffect(() => {
    if (!isSliding && Number.isFinite(position)) {
      setSliderValue(Math.max(0, position));
    }
  }, [position, isSliding]);

  // Reset on track change
  useEffect(() => {
    setSliderValue(0);
    setIsSliding(false);
    stableDurationRef.current = 0;
  }, [currentTrack?.id]);

  // Stabilize duration to avoid flicker
  useEffect(() => {
    const d = Number.isFinite(duration) ? duration : 0;
    if (d > 0) {
      if (stableDurationRef.current === 0) {
        stableDurationRef.current = d;
      } else if (d >= stableDurationRef.current - 1) {
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
      : Number.isFinite(duration)
      ? duration
      : 0;

  const clampedSliderValue = isSliding
    ? Math.max(0, Math.min(sliderValue, accurateDuration || 0))
    : Math.max(0, Math.min(position || 0, accurateDuration || 0));

  const progressPercent =
    accurateDuration > 0
      ? Math.max(0, Math.min(100, (clampedSliderValue / accurateDuration) * 100))
      : 0;

  const updateSliderFromEvent = event => {
    const maxValue = accurateDuration || 0;
    const locationX = Math.max(0, Math.min(event.nativeEvent.locationX, BAR_WIDTH));
    const value = maxValue > 0 ? (locationX / BAR_WIDTH) * maxValue : 0;
    setIsSliding(true);
    setSliderValue(Math.max(0, Math.min(value, maxValue)));
  };

  const completeSliderFromEvent = async event => {
    const maxValue = accurateDuration || 0;
    const locationX = Math.max(0, Math.min(event.nativeEvent.locationX, BAR_WIDTH));
    const target = Math.max(
      0,
      Math.min(maxValue > 0 ? (locationX / BAR_WIDTH) * maxValue : 0, maxValue),
    );
    try {
      setSliderValue(target);
      await TrackPlayer.seekTo(target);
      if (wasPlaying) {
        await TrackPlayer.play();
      }
    } catch (e) {
      // no-op
    } finally {
      setTimeout(() => setIsSliding(false), 80);
    }
  };

  return (
    <View style={styles.container}>
      {/* Reduced-width Touch & Progress Track */}
      <View
        style={[styles.touchArea, {width: BAR_WIDTH}]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={event => {
          const playing =
            playbackState?.state === 3 ||
            playbackState === 3 ||
            playbackState?.state === 'playing';
          setWasPlaying(Boolean(playing));
          updateSliderFromEvent(event);
        }}
        onResponderMove={updateSliderFromEvent}
        onResponderRelease={completeSliderFromEvent}>
        {/* Strong Background Track */}
        <View
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
            style={[
              styles.trackActive,
              {
                width: `${progressPercent}%`,
                backgroundColor: '#FFFFFF',
              },
            ]}
          />
        </View>

        {/* Strong Tactile Thumb Indicator */}
        <View
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
