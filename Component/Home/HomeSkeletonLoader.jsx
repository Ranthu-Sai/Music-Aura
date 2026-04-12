import React, {useEffect, useRef, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import {useTheme} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {PlaylistRowSkeleton} from './PlaylistRowSkeleton';
import {QuickPicksSkeleton} from './YTMusic/QuickPicksSkeleton';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const HeadingSkeleton = ({shimmerOpacity, styles}) => (
  <View style={styles.headingContainer}>
    <Animated.View
      style={[styles.headingSkeleton, {opacity: shimmerOpacity}]}
    />
  </View>
);

// Genre chip skeleton
const GenreChipSkeleton = ({width, shimmerOpacity, styles}) => (
  <Animated.View
    style={[styles.genreChip, {width, opacity: shimmerOpacity}]}
  />
);

// Playlist card skeleton
const PlaylistCardSkeleton = ({cardWidth, cardHeight, imageHeight, shimmerOpacity, styles}) => (
  <View
    style={[styles.cardContainer, {width: cardWidth, height: cardHeight}]}>
    <Animated.View
      style={[
        styles.cardImage,
        {height: imageHeight, opacity: shimmerOpacity},
      ]}
    />
    <View style={styles.cardTextContainer}>
      <Animated.View
        style={[styles.cardTitleSkeleton, {opacity: shimmerOpacity}]}
      />
      <Animated.View
        style={[styles.cardSubtitleSkeleton, {opacity: shimmerOpacity}]}
      />
    </View>
  </View>
);

// Album card skeleton (square with overlaid text)
const AlbumCardSkeleton = ({albumCardSize, shimmerOpacity, styles}) => (
  <View
    style={[
      styles.albumCardContainer,
      {width: albumCardSize, height: albumCardSize},
    ]}>
    <Animated.View
      style={[styles.albumCardImage, {opacity: shimmerOpacity}]}
    />
    <LinearGradient
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
      style={styles.albumGradient}>
      <Animated.View
        style={[styles.albumTitleSkeleton, {opacity: shimmerOpacity}]}
      />
      <Animated.View
        style={[styles.albumSubtitleSkeleton, {opacity: shimmerOpacity}]}
      />
    </LinearGradient>
  </View>
);

// Song row skeleton (for HorizontalScrollSongs)
const SongRowSkeleton = ({shimmerOpacity, styles}) => (
  <View style={styles.songRowContainer}>
    {[1, 2, 3, 4].map((_, index) => (
      <View key={index} style={styles.songRow}>
        <Animated.View
          style={[styles.songArtwork, {opacity: shimmerOpacity}]}
        />
        <View style={styles.songTextContainer}>
          <Animated.View
            style={[
              styles.songTitleSkeleton,
              {opacity: shimmerOpacity, width: 80 + Math.random() * 60},
            ]}
          />
          <Animated.View
            style={[
              styles.songArtistSkeleton,
              {opacity: shimmerOpacity, width: 50 + Math.random() * 40},
            ]}
          />
        </View>
      </View>
    ))}
  </View>
);

// Chart card skeleton (smaller, for Top Charts section)
const ChartCardSkeleton = ({shimmerOpacity, styles}) => (
  <View style={styles.chartCard}>
    <Animated.View style={[styles.chartImage, {opacity: shimmerOpacity}]} />
    <Animated.View style={[styles.chartTitle, {opacity: shimmerOpacity}]} />
  </View>
);

export const HomeSkeletonLoader = ({source = 'Hybrid'}) => {
  const {dark} = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create smooth infinite shimmer animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  // Smooth shimmer opacity interpolation
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 180,
    },
    routeHeadingPlaceholder: {
      height: 60,
    },

    // Genre chips
    genreContainer: {
      marginVertical: 10,
    },
    genreContent: {
      paddingHorizontal: 13,
      gap: 10,
      flexDirection: 'row',
    },
    genreChip: {
      height: 36,
      borderRadius: 18,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
    },

    // Section
    sectionContainer: {
      marginBottom: 20,
    },
    headingContainer: {
      paddingHorizontal: 13,
      marginBottom: 12,
      marginTop: 8,
    },
    headingSkeleton: {
      height: 24,
      width: 160,
      borderRadius: 4,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
    },

    // Horizontal scroll
    horizontalScroll: {
      paddingLeft: 10,
    },
    horizontalScrollContent: {
      paddingRight: 20,
      gap: 8,
      flexDirection: 'row',
    },

    // Playlist cards
    cardContainer: {
      borderRadius: 10,
      overflow: 'hidden',
      marginRight: 4,
    },
    cardImage: {
      width: '100%',
      borderRadius: 10,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
    },
    cardTextContainer: {
      paddingHorizontal: 5,
      paddingVertical: 8,
    },
    cardTitleSkeleton: {
      height: 14,
      borderRadius: 3,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
      marginBottom: 4,
    },
    cardSubtitleSkeleton: {
      height: 11,
      borderRadius: 3,
      backgroundColor: dark ? '#252525' : '#d0d0d0',
    },

    // Album cards
    albumCardContainer: {
      borderRadius: 10,
      overflow: 'hidden',
      marginRight: 4,
    },
    albumCardImage: {
      width: '100%',
      height: '100%',
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
    },
    albumGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
      justifyContent: 'flex-end',
      padding: 8,
    },
    albumTitleSkeleton: {
      height: 14,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.8)',
      marginBottom: 4,
    },
    albumSubtitleSkeleton: {
      height: 11,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.6)',
    },

    // Song rows
    songRowContainer: {
      paddingHorizontal: 13,
    },
    songRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    songArtwork: {
      width: 50,
      height: 50,
      borderRadius: 6,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
    },
    songTextContainer: {
      marginLeft: 12,
      flex: 1,
    },
    songTitleSkeleton: {
      height: 14,
      borderRadius: 3,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
      marginBottom: 6,
    },
    songArtistSkeleton: {
      height: 11,
      borderRadius: 3,
      backgroundColor: dark ? '#252525' : '#d0d0d0',
    },

    // Top charts
    chartCard: {
      width: 140,
      marginRight: 12,
      alignItems: 'center',
    },
    chartImage: {
      width: 140,
      height: 140,
      borderRadius: 10,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
      marginBottom: 8,
    },
    chartTitle: {
      height: 12,
      width: '80%',
      borderRadius: 3,
      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
    },
  }), [dark]);

  // Card dimensions (matching actual card sizes)
  const cardWidth = Math.max(180, SCREEN_WIDTH * 0.42);
  const cardHeight = cardWidth * 1.2;
  const imageHeight = cardWidth * 0.9;
  const albumCardSize = cardWidth;

  if (source === 'YTMusic') {
    return (
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.routeHeadingPlaceholder} />
        <QuickPicksSkeleton />
        <PlaylistRowSkeleton count={4} showHeading={true} />
        <PlaylistRowSkeleton count={4} showHeading={true} />
        <PlaylistRowSkeleton count={4} showHeading={true} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}>
      {/* Route Heading placeholder */}
      <View style={styles.routeHeadingPlaceholder} />

      {/* Genre chips skeleton */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genreContainer}
        contentContainerStyle={styles.genreContent}>
        <GenreChipSkeleton width={70} shimmerOpacity={shimmerOpacity} styles={styles} />
        <GenreChipSkeleton width={90} shimmerOpacity={shimmerOpacity} styles={styles} />
        <GenreChipSkeleton width={65} shimmerOpacity={shimmerOpacity} styles={styles} />
        <GenreChipSkeleton width={85} shimmerOpacity={shimmerOpacity} styles={styles} />
        <GenreChipSkeleton width={75} shimmerOpacity={shimmerOpacity} styles={styles} />
        <GenreChipSkeleton width={95} shimmerOpacity={shimmerOpacity} styles={styles} />
      </ScrollView>

      {/* Songs section skeleton */}
      <View style={styles.sectionContainer}>
        <HeadingSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
        <SongRowSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
      </View>

      {/* Recommended Playlists skeleton */}
      <View style={styles.sectionContainer}>
        <HeadingSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={styles.horizontalScrollContent}>
          <PlaylistCardSkeleton
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            imageHeight={imageHeight}
            shimmerOpacity={shimmerOpacity}
            styles={styles}
          />
          <PlaylistCardSkeleton
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            imageHeight={imageHeight}
            shimmerOpacity={shimmerOpacity}
            styles={styles}
          />
          <PlaylistCardSkeleton
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            imageHeight={imageHeight}
            shimmerOpacity={shimmerOpacity}
            styles={styles}
          />
        </ScrollView>
      </View>

      {/* Trending Albums skeleton */}
      <View style={styles.sectionContainer}>
        <HeadingSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={styles.horizontalScrollContent}>
          <AlbumCardSkeleton
            albumCardSize={albumCardSize}
            shimmerOpacity={shimmerOpacity}
            styles={styles}
          />
          <AlbumCardSkeleton
            albumCardSize={albumCardSize}
            shimmerOpacity={shimmerOpacity}
            styles={styles}
          />
          <AlbumCardSkeleton
            albumCardSize={albumCardSize}
            shimmerOpacity={shimmerOpacity}
            styles={styles}
          />
        </ScrollView>
      </View>

      {/* Top Charts skeleton */}
      <View style={styles.sectionContainer}>
        <HeadingSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={styles.horizontalScrollContent}>
          <ChartCardSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
          <ChartCardSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
          <ChartCardSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
          <ChartCardSkeleton shimmerOpacity={shimmerOpacity} styles={styles} />
        </ScrollView>
      </View>
    </ScrollView>
  );
};
