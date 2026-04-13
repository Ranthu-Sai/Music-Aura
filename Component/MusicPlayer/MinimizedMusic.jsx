import {View, Pressable} from 'react-native';
import React, {memo, useMemo} from 'react';
import {PlainText} from '../Global/PlainText';
import {MarqueeText} from '../Global/MarqueeText';
import Animated, {FadeIn, runOnJS} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {PlayPauseButton} from './PlayPauseButton';
import {NextSongButton} from './NextSongButton';
import {PreviousSongButton} from './PreviousSongButton';
import {LikeSongButton} from './LikeSongButton';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
// react-native-svg removed — fallback implemented using native Views and Animated
import YTArtworkUtils from '../../Utils/YTMusicArtworkUtils';
import {
  useActiveTrack,
  useProgress,
  usePlaybackState,
} from 'react-native-track-player';
import {PlayNextSong, PlayPreviousSong} from '../../MusicPlayerFunctions';

import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';

const RNAnimated = require('react-native').Animated; // native Animated for value interpolation and Animated.View
const AnimatedFastImage = RNAnimated.createAnimatedComponent(FastImage);

// MiniProgressBar removed — bottom horizontal progress bar has been removed per request
// Previously displayed a horizontal bar at the bottom of the mini player; now we rely on the circular perimeter only.

const MiniTimeDisplay = memo(() => {
  const {position, duration} = useProgress(1000);
  const formatTime = seconds => {
    if (!seconds || isNaN(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  return (
    <PlainText
      text={`${formatTime(position)} / ${formatTime(duration)}`}
      style={{fontSize: 10, opacity: 0.6, color: '#999'}}
    />
  );
});

// TopEdgeProgress removed — using animated perimeter progress component instead

// Circular ring progress around artwork (four-side colored rounded ring)
const CircularProgress = memo(({size = 56, strokeWidth = 2, colors = ['#1DB954','#F59E0B','#F97316','#EF4444'], background = '#0c0c0c'}) => {
  const {position, duration} = useProgress(250);
  const pct = !duration || duration <= 0 ? 0 : Math.max(0, Math.min(position / duration, 1));

  const anim = React.useRef(new RNAnimated.Value(0));
  React.useEffect(() => {
    // Guard against NaN or invalid percentages
    const safePct = isNaN(pct) ? 0 : Math.max(0, Math.min(pct, 1));
    
    RNAnimated.timing(anim.current, {
      toValue: safePct,
      duration: 250,
      easing: require('react-native').Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const trackColor = 'rgba(255,255,255,0.06)';
  const s = strokeWidth;

  // interpolate per-side fills
  const topWidth = anim.current.interpolate({inputRange: [0, 0.25, 1], outputRange: [0, size, size], extrapolate: 'clamp'});
  const rightHeight = anim.current.interpolate({inputRange: [0, 0.25, 0.5, 1], outputRange: [0, 0, size, size], extrapolate: 'clamp'});
  const bottomWidth = anim.current.interpolate({inputRange: [0, 0.5, 0.75, 1], outputRange: [0, 0, size, size], extrapolate: 'clamp'});
  const leftHeight = anim.current.interpolate({inputRange: [0, 0.75, 1], outputRange: [0, 0, size], extrapolate: 'clamp'});

  return (
    <View style={{position: 'absolute', left: 0, top: 0, width: size, height: size}}>
      {/* Top track */}
      <View style={{position: 'absolute', left: 0, top: 0, width: size, height: s, backgroundColor: trackColor, overflow: 'hidden', borderTopLeftRadius: s / 2, borderTopRightRadius: s / 2}}>
        <RNAnimated.View style={{height: '100%', width: topWidth, backgroundColor: colors[0]}} />
      </View>
      {/* Right track */}
      <View style={{position: 'absolute', right: 0, top: 0, width: s, height: size, backgroundColor: trackColor, overflow: 'hidden', borderTopRightRadius: s / 2, borderBottomRightRadius: s / 2}}>
        <RNAnimated.View style={{position: 'absolute', top: 0, left: 0, width: '100%', height: rightHeight, backgroundColor: colors[1]}} />
      </View>
      {/* Bottom track */}
      <View style={{position: 'absolute', left: 0, bottom: 0, width: size, height: s, backgroundColor: trackColor, overflow: 'hidden', borderBottomLeftRadius: s / 2, borderBottomRightRadius: s / 2}}>
        <RNAnimated.View style={{position: 'absolute', right: 0, height: '100%', width: bottomWidth, backgroundColor: colors[2]}} />
      </View>
      {/* Left track */}
      <View style={{position: 'absolute', left: 0, top: 0, width: s, height: size, backgroundColor: trackColor, overflow: 'hidden', borderTopLeftRadius: s / 2, borderBottomLeftRadius: s / 2}}>
        <RNAnimated.View style={{position: 'absolute', bottom: 0, left: 0, width: '100%', height: leftHeight, backgroundColor: colors[3]}} />
      </View>
      {/* Inner hole for ring thickness */}
      <View style={{position: 'absolute', left: s, top: s, width: size - s * 2, height: size - s * 2, borderRadius: (size - s * 2) / 2, backgroundColor: background}} />
    </View>
  );
});

export const MinimizedMusic = memo(({setIndex, color}) => {

  const pan = React.useMemo(() => Gesture.Pan()
    .minDistance(20)
    .onFinalize(e => {
      'worklet';
      if (e.translationX > 80) {
        runOnJS(PlayPreviousSong)();
      } else if (e.translationX < -80) {
        runOnJS(PlayNextSong)();
      } else if (Math.abs(e.translationX) < 20) {
        // Only open full player if tap (minimal movement)
        runOnJS(setIndex)(1);
      }
    }), [setIndex]);

  // Use provided color prop to build a colorful gradient for the border
  const gradientColors = useMemo(() => {
    // Fallback gradient if color not provided
    const base = color || '#1DB954';
    return [base, '#8E2DE2', '#FF8C00'];
  }, [color]);

  const currentPlaying = useActiveTrack();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState === 'playing' || playbackState?.state === 'playing' || playbackState === 3 || playbackState?.state === 3;

  // Rotation animation for artwork
  const rotateAnim = React.useRef(new RNAnimated.Value(0));
  const rotateAnimRef = React.useRef(null);

  // Interpolate rotation
  const rotateInterpolate = rotateAnim.current.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});

  React.useEffect(() => {
    // Start looping rotation when playing
    if (isPlaying) {
      rotateAnim.current.setValue(0);
      rotateAnimRef.current = RNAnimated.loop(
        RNAnimated.timing(rotateAnim.current, {
          toValue: 1,
          duration: 8000,
          easing: require('react-native').Easing.linear,
          useNativeDriver: true,
        }),
      );
      rotateAnimRef.current.start();
    } else {
      // Stop rotation smoothly
      if (rotateAnimRef.current) {
        try {
          rotateAnimRef.current.stop();
        } catch (e) {}
        rotateAnimRef.current = null;
      }
    }
    return () => {
      if (rotateAnimRef.current) {
        try { rotateAnimRef.current.stop(); } catch (e) {}
        rotateAnimRef.current = null;
      }
    };
  }, [isPlaying, currentPlaying?.id]);

  if (!currentPlaying) {
    return null;
  }

  const progressColor = '#3B82F6'; // Blue progress bar per request (replaced white with blue)

  return (
    <GestureHandlerRootView
      style={{height: 90, backgroundColor: 'transparent'}}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={{
          marginHorizontal: 8,
          marginBottom: 8,
          borderRadius: 26,
          padding: 1.8,
          // subtle glow
          shadowColor: gradientColors[0],
          shadowOffset: {width: 0, height: 6},
          shadowOpacity: 0.18,
          shadowRadius: 10,
        }}>
      <View
        style={{
          overflow: 'hidden',
          backgroundColor: '#0c0c0c',
          height: 72,
          borderRadius: 24,
        }}>
        {/* Main Content Area */}
        <Animated.View
          entering={FadeIn}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 68,
            paddingHorizontal: 10,
          }}>
          <GestureDetector gesture={pan}>
            <Pressable
              onPress={() => setIndex(1)}
              style={{
                flexDirection: 'row',
                flex: 1,
                alignItems: 'center',
                height: '100%',
              }}>
              {/* Static Artwork (rotation disabled for performance) */}
              <View
                style={{
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {(() => {
                  try {
                    return <CircularProgress size={56} strokeWidth={2} color={progressColor} background={'#0c0c0c'} />;
                  } catch (e) {
                    console.warn('Perimeter render error:', e);
                    // Bottom progress removed — no fallback progress bar
                    return null;
                  }
                })()}
                {/* Rotating artwork */}
                <AnimatedFastImage
                  source={{
                    uri: (() => {
                      const art =
                        currentPlaying?.artwork ||
                        currentPlaying?.thumbnail ||
                        'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png';
                      return YTArtworkUtils.upgradeArtworkQuality(art);
                    })(),
                  }}
                  resizeMode={FastImage.resizeMode.cover}
                  style={{
                    height: 46,
                    width: 46,
                    borderRadius: 23,
                    backgroundColor: '#111',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    transform: [{rotate: rotateInterpolate}],
                  }}
                />
              </View>

              {/* Song Info (Ultra Clean Title) */}
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                  overflow: 'hidden',
                }}>
                <MarqueeText
                  text={FormatTitleAndArtist(
                    currentPlaying?.title ?? '',
                    currentPlaying?.artist,
                  )}
                  style={{fontSize: 13, fontWeight: 'bold', color: 'white'}}
                  nospace={true}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 1,
                  }}>
                  <MiniTimeDisplay />
                </View>
              </View>
            </Pressable>
          </GestureDetector>

          {/* Playback Controls */}
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <LikeSongButton size={22} color={'white'} />
            <PreviousSongButton size={22} color={'white'} />
            <PlayPauseButton isFullScreen={false} size={28} color={'white'} />
            <NextSongButton size={22} color={'white'} />
          </View>
        </Animated.View>

        {/* Bottom progress bar removed — perimeter circular progress is used instead */}
      </View>
      </LinearGradient>
    </GestureHandlerRootView>
  );
});
