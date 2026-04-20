import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Dimensions, ScrollView, StyleSheet, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ShimmerArtistChips,
  ShimmerHorizontalList,
  ShimmerHorizontalSongList,
  ShimmerTrendingSongsList,
} from '../Global/ShimmerEffect';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const LoadingHeading = ({width, opacity, styles}) => (
  <View style={styles.headingBlock}>
    <Animated.View
      style={[
        styles.headingSkeleton,
        {
          width,
          opacity,
        },
      ]}
    />
  </View>
);

const LoadingAura = ({dark, pulse, styles}) => {
  const topGlow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.3],
  });
  const bottomGlow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.24],
  });
  const sideGlow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.18],
  });

  return (
    <View style={styles.auraContainer} pointerEvents="none">
      <LinearGradient
        colors={dark ? ['#050505', '#0d0d0d'] : ['#f5f8f4', '#ffffff']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.auraBlob,
          styles.auraTop,
          {
            opacity: topGlow,
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.08],
                }),
              },
            ],
            backgroundColor: dark
              ? 'rgba(29, 185, 84, 0.9)'
              : 'rgba(29, 185, 84, 0.45)',
          },
        ]}
      />
      <Animated.View
        style={[
          styles.auraBlob,
          styles.auraBottom,
          {
            opacity: bottomGlow,
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.04, 0.98],
                }),
              },
            ],
            backgroundColor: dark
              ? 'rgba(64, 224, 208, 0.8)'
              : 'rgba(64, 224, 208, 0.4)',
          },
        ]}
      />
      <Animated.View
        style={[
          styles.auraBlob,
          styles.auraSide,
          {
            opacity: sideGlow,
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.04],
                }),
              },
            ],
            backgroundColor: dark
              ? 'rgba(124, 255, 180, 0.65)'
              : 'rgba(124, 255, 180, 0.3)',
          },
        ]}
      />
    </View>
  );
};

const LoadingSection = ({titleWidth, children, pulseOpacity, styles}) => (
  <View style={styles.sectionBlock}>
    <LoadingHeading width={titleWidth} opacity={pulseOpacity} styles={styles} />
    {children}
  </View>
);

export const HomeSkeletonLoader = () => {
  const {dark} = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.32, 0.64, 0.32],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        contentContainer: {
          paddingBottom: 180,
        },
        auraContainer: {
          ...StyleSheet.absoluteFillObject,
          overflow: 'hidden',
        },
        auraBlob: {
          position: 'absolute',
          borderRadius: SCREEN_WIDTH,
        },
        auraTop: {
          top: -120,
          right: -100,
          width: SCREEN_WIDTH * 0.95,
          height: SCREEN_WIDTH * 0.95,
        },
        auraBottom: {
          left: -140,
          bottom: 40,
          width: SCREEN_WIDTH * 1.05,
          height: SCREEN_WIDTH * 1.05,
        },
        auraSide: {
          right: -80,
          top: SCREEN_HEIGHT * 0.32,
          width: SCREEN_WIDTH * 0.42,
          height: SCREEN_WIDTH * 0.42,
        },
        contentSurface: {
          flex: 1,
        },
        routeBar: {
          paddingHorizontal: 13,
          paddingTop: 10,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        routeTitle: {
          height: 26,
          width: 140,
          borderRadius: 6,
          backgroundColor: dark ? '#2a2a2a' : '#dfe6df',
        },
        routeChip: {
          height: 26,
          width: 74,
          borderRadius: 13,
          backgroundColor: dark ? '#222' : '#e9efe7',
        },
        pillRow: {
          paddingLeft: 13,
          marginBottom: 8,
        },
        pillScroll: {
          gap: 10,
          flexDirection: 'row',
        },
        pill: {
          height: 34,
          borderRadius: 17,
          backgroundColor: dark ? '#242424' : '#e5ebe3',
        },
        headingBlock: {
          paddingHorizontal: 13,
          marginBottom: 12,
          marginTop: 8,
        },
        headingSkeleton: {
          height: 28,
          borderRadius: 6,
          backgroundColor: dark ? '#2a2a2a' : '#dfe6df',
        },
        sectionBlock: {
          marginBottom: 10,
        },
      }),
    [dark],
  );

  return (
    <View style={styles.container}>
      <LoadingAura dark={dark} pulse={pulse} styles={styles} />
      <ScrollView
        style={styles.contentSurface}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.routeBar}>
          <View style={styles.routeTitle} />
          <View style={styles.routeChip} />
        </View>

        <View style={styles.pillRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillScroll}>
            <View style={[styles.pill, {width: 74}]} />
            <View style={[styles.pill, {width: 96}]} />
            <View style={[styles.pill, {width: 68}]} />
            <View style={[styles.pill, {width: 88}]} />
            <View style={[styles.pill, {width: 82}]} />
          </ScrollView>
        </View>

        <LoadingSection titleWidth={180} pulseOpacity={pulseOpacity} styles={styles}>
          <ShimmerTrendingSongsList itemCount={6} />
        </LoadingSection>

        <LoadingSection titleWidth={200} pulseOpacity={pulseOpacity} styles={styles}>
          <ShimmerHorizontalSongList />
        </LoadingSection>

        <LoadingSection titleWidth={190} pulseOpacity={pulseOpacity} styles={styles}>
          <ShimmerHorizontalList itemCount={6} />
        </LoadingSection>

        <LoadingSection titleWidth={160} pulseOpacity={pulseOpacity} styles={styles}>
          <ShimmerArtistChips itemCount={8} />
        </LoadingSection>

        <LoadingSection titleWidth={240} pulseOpacity={pulseOpacity} styles={styles}>
          <ShimmerHorizontalList itemCount={6} />
        </LoadingSection>

        <LoadingSection titleWidth={200} pulseOpacity={pulseOpacity} styles={styles}>
          <ShimmerHorizontalSongList />
        </LoadingSection>
      </ScrollView>
    </View>
  );
};
