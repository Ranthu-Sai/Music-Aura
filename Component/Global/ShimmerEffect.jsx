import React, {useEffect, useRef} from 'react';
import {View, Animated, StyleSheet, Dimensions, ScrollView} from 'react-native';
import Reanimated, {FadeIn} from 'react-native-reanimated';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

/**
 * Lightweight Shimmer Effect Component (Static)
 * Simple static placeholder without animations to prevent memory leaks
 */
export const ShimmerEffect = ({width, height, borderRadius = 8, style}) => {
  return (
    <View
      style={[
        styles.shimmerContainer,
        {width, height, borderRadius, backgroundColor: '#1c1c1e'},
        style,
      ]}
    />
  );
};

/**
 * Animated Shimmer Effect Component (Use sparingly - creates animations)
 * Creates smooth, delightful loading animations with pulse and wave effects
 */
export const AnimatedShimmerEffect = ({width, height, borderRadius = 8, style}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const animationsRef = useRef({pulse: null, wave: null});

  useEffect(() => {
    // Use a local animations object so cleanup isn't impacted by ref changes
    const animations = {pulse: null, wave: null};

    // Pulse animation
    animations.pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ]),
    );
    animations.pulse.start();

    // Wave animation
    animations.wave = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
    );
    animations.wave.start();

    // Persist to ref for external debugging/visibility
    animationsRef.current = animations;

    // Cleanup: Stop animations and reset values when component unmounts
    return () => {
      if (animations.pulse) {
        animations.pulse.stop();
      }
      if (animations.wave) {
        animations.wave.stop();
      }
      // Reset animated values to prevent memory leaks
      pulseAnim.setValue(0);
      waveAnim.setValue(0);
    };
  }, [pulseAnim, waveAnim]);

  const shimmerWidth = typeof width === 'number' ? width : SCREEN_WIDTH - 30;

  const backgroundColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#1c1c1e', '#2c2c2e'],
  });

  const translateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth * 2, shimmerWidth * 2],
  });

  return (
    <Animated.View
      style={[
        styles.shimmerContainer,
        {width, height, borderRadius, backgroundColor},
        style,
      ]}>
      <Animated.View
        style={[
          styles.shimmerWave,
          {
            width: shimmerWidth,
            transform: [{translateX}, {skewX: '-20deg'}],
          },
        ]}
      />
    </Animated.View>
  );
};

/**
 * Shimmer Card for Song Items
 */
export const ShimmerSongCard = () => (
  <View style={styles.songCardContainer}>
    <ShimmerEffect width={145} height={145} borderRadius={18} />
    <View style={{marginTop: 12, width: 145}}>
      <ShimmerEffect
        width={130}
        height={18}
        borderRadius={6}
      />
    </View>
    <View style={{marginTop: 8, width: 145}}>
      <ShimmerEffect
        width={110}
        height={15}
        borderRadius={5}
      />
    </View>
  </View>
);

/**
 * Shimmer Card for Album/Playlist Items
 */
export const ShimmerAlbumCard = () => (
  <View style={{
    borderRadius: 8,
    height: 250,
    width: 180,
    backgroundColor: 'rgba(55,55,79,0)',
    overflow: 'hidden',
    marginVertical: 8,
  }}>
    <ShimmerEffect width={180} height={180} borderRadius={8} />
    <View style={{
      padding: 8,
      height: 60,
      alignItems: 'center',
    }}>
      <ShimmerEffect
        width={160}
        height={16}
        borderRadius={5}
      />
      <View style={{marginTop: 6}}>
        <ShimmerEffect
          width={140}
          height={14}
          borderRadius={5}
        />
      </View>
    </View>
  </View>
);

/**
 * Shimmer for Horizontal Lists
 */
export const ShimmerHorizontalList = ({
  itemCount = 5,
  CardComponent = ShimmerAlbumCard,
}) => (
  <Reanimated.View
    entering={FadeIn.duration(400)}
    style={styles.horizontalListContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-col-${index}`}
        entering={FadeIn.delay(index * 100).duration(400)}
        style={{marginRight: 12}}>
        <View style={{marginBottom: 12}}>
          <CardComponent />
        </View>
        <CardComponent />
      </Reanimated.View>
    ))}
  </Reanimated.View>
);

/**
 * Shimmer for Vertical Grid (Albums/Playlists)
 */
export const ShimmerVerticalGrid = ({itemCount = 4}) => (
  <View style={styles.verticalGridContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <View key={`shimmer-grid-${index}`} style={styles.gridItem}>
        <ShimmerEffect width={160} height={160} borderRadius={12} />
        <ShimmerEffect
          width={140}
          height={14}
          borderRadius={4}
          style={{marginTop: 8}}
        />
        <ShimmerEffect
          width={120}
          height={12}
          borderRadius={4}
          style={{marginTop: 6}}
        />
      </View>
    ))}
  </View>
);

/**
 * Shimmer for Trending Songs List
 */
export const ShimmerTrendingSongsList = ({itemCount = 6}) => (
  <Reanimated.View
    entering={FadeIn.duration(400)}
    style={styles.horizontalListContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-trending-${index}`}
        entering={FadeIn.delay(index * 80).duration(400)}
        style={{
          marginRight: 12,
          width: 150,
          borderRadius: 8,
          backgroundColor: 'rgba(55,55,79,0)',
          overflow: 'hidden',
        }}>
        <ShimmerEffect width={150} height={140} borderRadius={8} />
        <View style={{padding: 8}}>
          <ShimmerEffect
            width={135}
            height={18}
            borderRadius={6}
          />
          <View style={{marginTop: 6}}>
            <ShimmerEffect
              width={115}
              height={15}
              borderRadius={5}
            />
          </View>
        </View>
      </Reanimated.View>
    ))}
  </Reanimated.View>
);

/**
 * Shimmer for Artist Chips
 */
export const ShimmerArtistChips = ({itemCount = 8}) => (
  <Reanimated.View
    entering={FadeIn.duration(400)}
    style={styles.artistChipsHorizontalContainer}>
    {Array.from({length: Math.ceil(itemCount / 2)}).map((_, colIndex) => (
      <Reanimated.View
        key={`shimmer-artist-col-${colIndex}`}
        entering={FadeIn.delay(colIndex * 60).duration(400)}
        style={styles.artistChipColumn}>
        <View style={styles.artistChipItem}>
          <ShimmerEffect width={150} height={150} borderRadius={75} />
          <View style={{marginTop: 10, alignItems: 'center', width: 150}}>
            <ShimmerEffect
              width={120}
              height={16}
              borderRadius={5}
            />
          </View>
        </View>
        {colIndex * 2 + 1 < itemCount && (
          <View style={styles.artistChipItem}>
            <ShimmerEffect width={150} height={150} borderRadius={75} />
            <View style={{marginTop: 10, alignItems: 'center', width: 150}}>
              <ShimmerEffect
                width={120}
                height={16}
                borderRadius={5}
              />
            </View>
          </View>
        )}
      </Reanimated.View>
    ))}
  </Reanimated.View>
);

/**
 * Shimmer for Top Charts Cards
 */
export const ShimmerTopCharts = ({itemCount = 4}) => (
  <View style={styles.horizontalListContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <View key={`shimmer-chart-${index}`} style={{marginRight: 12}}>
        <ShimmerEffect width={180} height={200} borderRadius={16} />
        <View style={{marginTop: 12, width: 180}}>
          <ShimmerEffect
            width={160}
            height={18}
            borderRadius={6}
          />
        </View>
      </View>
    ))}
  </View>
);

/**
 * Full Page Shimmer Loader (Initial Load) — scrollable and mirrors Home layout exactly
 */
export const ShimmerFullPage = () => (
  <ScrollView contentContainerStyle={{paddingBottom: 120}} showsVerticalScrollIndicator={false}>
    {/* RouteHeading (Header) */}
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingTop: 20,
      paddingBottom: 10,
    }}>
      <ShimmerEffect width={140} height={36} borderRadius={10} />
      <ShimmerEffect width={36} height={36} borderRadius={18} />
    </View>

    {/* DisplayTopGenres */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{gap: 10, paddingHorizontal: 10, marginVertical: 10}}>
      {Array.from({length: 8}).map((_, i) => (
        <ShimmerEffect key={`genre-${i}`} width={85} height={40} borderRadius={20} />
      ))}
    </ScrollView>

    {/* Latest Top Songs Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 12, marginBottom: 8}}>
      <ShimmerEffect width={180} height={28} borderRadius={6} />
    </View>
    <ShimmerTrendingSongsList itemCount={6} />

    {/* HorizontalScrollSongs placeholder (after Latest Top Songs) */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={200} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalSongList />

    {/* Trending Albums Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={190} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalList itemCount={6} />

    {/* Latest Artists (conditional - shown only when language !== 'All') */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={160} height={28} borderRadius={6} />
    </View>
    <ShimmerArtistChips itemCount={8} />

    {/* Recommended Playlists Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={240} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalList itemCount={6} />

    {/* HorizontalScrollSongs placeholder (after Recommended Playlists) */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={200} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalSongList />

    {/* Top Charts Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={140} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalList itemCount={4} />

    {/* Viral Hits Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={130} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalSongList />

    {/* HorizontalScrollSongs placeholder (after Viral Hits) */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={200} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalSongList />

    {/* Recommended Albums Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={220} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalList itemCount={6} />

    {/* HorizontalScrollSongs placeholder (after Recommended Albums) */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={200} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalSongList />

    {/* Trending Now Heading + Content */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 8}}>
      <ShimmerEffect width={170} height={28} borderRadius={6} />
    </View>
    <ShimmerHorizontalSongList />
  </ScrollView>
);

/**
 * Shimmer for Search Results (Songs List)
 */
export const ShimmerSearchResults = ({itemCount = 8}) => (
  <View style={styles.searchResultsContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-search-${index}`}
        entering={FadeIn.delay(index * 50).duration(400)}
        style={styles.searchResultItem}>
        <AnimatedShimmerEffect width={60} height={60} borderRadius={8} />
        <View style={styles.searchResultTextContainer}>
          <AnimatedShimmerEffect width={SCREEN_WIDTH - 190} height={17} borderRadius={5} />
          <View style={{marginTop: 8}}>
            <AnimatedShimmerEffect width={SCREEN_WIDTH - 230} height={14} borderRadius={4} />
          </View>
        </View>
        <AnimatedShimmerEffect width={37} height={37} borderRadius={19} style={{marginRight: 10}} />
      </Reanimated.View>
    ))}
  </View>
);

/**
 * Shimmer for Search Albums Grid
 */
export const ShimmerSearchAlbums = ({itemCount = 6}) => (
  <View style={styles.searchGridContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-album-${index}`}
        entering={FadeIn.delay(index * 80).duration(400)}
        style={styles.searchAlbumItem}>
        <AnimatedShimmerEffect width={(SCREEN_WIDTH - 50) / 2} height={(SCREEN_WIDTH - 50) / 2} borderRadius={12} />
        <View style={{marginTop: 8, width: (SCREEN_WIDTH - 50) / 2}}>
          <AnimatedShimmerEffect width={(SCREEN_WIDTH - 70) / 2} height={16} borderRadius={5} />
        </View>
        <View style={{marginTop: 6, width: (SCREEN_WIDTH - 50) / 2}}>
          <AnimatedShimmerEffect width={(SCREEN_WIDTH - 90) / 2} height={13} borderRadius={4} />
        </View>
      </Reanimated.View>
    ))}
  </View>
);

/**
 * Shimmer for Search Playlists Grid
 */
export const ShimmerSearchPlaylists = ({itemCount = 6}) => (
  <View style={styles.searchGridContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-playlist-${index}`}
        entering={FadeIn.delay(index * 80).duration(400)}
        style={styles.searchAlbumItem}>
        <AnimatedShimmerEffect width={(SCREEN_WIDTH - 50) / 2} height={(SCREEN_WIDTH - 50) / 2} borderRadius={12} />
        <View style={{marginTop: 8, width: (SCREEN_WIDTH - 50) / 2}}>
          <AnimatedShimmerEffect width={(SCREEN_WIDTH - 70) / 2} height={16} borderRadius={5} />
        </View>
        <View style={{marginTop: 6, width: (SCREEN_WIDTH - 50) / 2}}>
          <AnimatedShimmerEffect width={(SCREEN_WIDTH - 90) / 2} height={13} borderRadius={4} />
        </View>
      </Reanimated.View>
    ))}
  </View>
);

/**
 * Shimmer for Search Suggestions (used in SearchSuggestions)
 */
export const ShimmerSearchSuggestions = ({itemCount = 5}) => (
  <View style={{paddingHorizontal: 15, paddingTop: 10}}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-suggestion-${index}`}
        entering={FadeIn.delay(index * 60).duration(300)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          gap: 12,
        }}>
        <ShimmerEffect width={40} height={40} borderRadius={12} />
        <ShimmerEffect width={SCREEN_WIDTH - 120} height={16} borderRadius={6} style={{flex: 1}} />
        <ShimmerEffect width={24} height={24} borderRadius={6} />
      </Reanimated.View>
    ))}
  </View>
);

/**
 * Shimmer for Horizontal Song Lists (used in HorizontalScrollSongs)
 */
export const ShimmerHorizontalSongList = () => {
  const width = Dimensions.get('window').width;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{paddingHorizontal: 15}}>
        {Array.from({length: 4}).map((_, index) => (
          <Reanimated.View
            key={`shimmer-hsong-1-${index}`}
            entering={FadeIn.delay(index * 60).duration(400)}
            style={{marginBottom: 8, flexDirection: 'row', alignItems: 'center'}}>
            <ShimmerEffect width={60} height={60} borderRadius={8} />
            <View style={{marginLeft: 12, flex: 1}}>
              <ShimmerEffect width={width * 0.5} height={16} borderRadius={5} />
              <View style={{marginTop: 6}}>
                <ShimmerEffect width={width * 0.35} height={14} borderRadius={4} />
              </View>
            </View>
          </Reanimated.View>
        ))}
      </View>
      <View style={{paddingHorizontal: 15}}>
        {Array.from({length: 4}).map((_, index) => (
          <Reanimated.View
            key={`shimmer-hsong-2-${index}`}
            entering={FadeIn.delay((index + 4) * 60).duration(400)}
            style={{marginBottom: 8, flexDirection: 'row', alignItems: 'center'}}>
            <ShimmerEffect width={60} height={60} borderRadius={8} />
            <View style={{marginLeft: 12, flex: 1}}>
              <ShimmerEffect width={width * 0.5} height={16} borderRadius={5} />
              <View style={{marginTop: 6}}>
                <ShimmerEffect width={width * 0.35} height={14} borderRadius={4} />
              </View>
            </View>
          </Reanimated.View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  shimmerContainer: {
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
  },
  shimmerWave: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  songCardContainer: {
    marginVertical: 8,
  },
  albumCardContainer: {
    marginVertical: 8,
  },
  horizontalListContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginVertical: 10,
  },
  verticalGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    marginVertical: 10,
    justifyContent: 'space-between',
  },
  gridItem: {
    marginBottom: 20,
  },
  artistChipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginVertical: 10,
    flexWrap: 'wrap',
  },
  artistChipsHorizontalContainer: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    marginVertical: 10,
  },
  artistChipColumn: {
    marginRight: 8,
    alignItems: 'center',
  },
  artistChipItem: {
    marginBottom: 6,
    alignItems: 'center',
  },
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 15,
  },
  bannerSection: {
    paddingHorizontal: 15,
    marginVertical: 20,
  },
  sectionTitle: {
    paddingHorizontal: 15,
    marginTop: 20,
    marginBottom: 12,
  },
  searchResultsContainer: {
    paddingHorizontal: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  searchResultTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  searchGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  searchAlbumItem: {
    marginBottom: 20,
  },
});
