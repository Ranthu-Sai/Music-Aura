import Slider from '@react-native-community/slider';
import React, {useEffect, useMemo, useRef, useState, memo} from 'react';
import {Dimensions, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {
  useActiveTrack,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import {SmallText} from '../Global/SmallText';

export const ProgressBar = memo(() => {
  const theme = useTheme();
  const width = useMemo(() => Dimensions.get('window').width, []);
  // Faster updates for snappier UI feel
  const {position, duration} = useProgress(250);
  const currentTrack = useActiveTrack();
  const playbackState = usePlaybackState();

  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [wasPlaying, setWasPlaying] = useState(false);
  const stableDurationRef = useRef(0);

  // Keep slider in sync when not sliding
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

  // Stabilize duration to avoid flicker (RNTP can briefly report 0)
  useEffect(() => {
    const d = Number.isFinite(duration) ? duration : 0;
    if (d > 0) {
      if (stableDurationRef.current === 0) {
        stableDurationRef.current = d;
      } else if (d >= stableDurationRef.current - 1) {
        // allow minor backward jitter up to 1s
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

  // Prefer track metadata duration if available
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

  return (
    <>
      <Slider
        style={{width: width, height: 40}}
        minimumValue={0}
        maximumValue={Math.max(accurateDuration || 0, 1)}
        value={clampedSliderValue}
        onValueChange={value => {
          setIsSliding(true);
          setSliderValue(value ?? 0);
        }}
        onSlidingStart={() => {
          const playing =
            playbackState?.state === 3 ||
            playbackState === 3 ||
            playbackState?.state === 'playing';
          setWasPlaying(Boolean(playing));
          setIsSliding(true);
        }}
        onSlidingComplete={async value => {
          try {
            const target = Math.max(
              0,
              Math.min(value ?? 0, accurateDuration || 0),
            );
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
        }}
        minimumTrackTintColor={theme.colors.text}
        maximumTrackTintColor={
          theme.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
        }
        thumbTintColor={theme.colors.text}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '90%',
        }}>
        <SmallText text={formatTime(clampedSliderValue)} />
        <SmallText text={formatTime(accurateDuration)} />
      </View>
    </>
  );
});
