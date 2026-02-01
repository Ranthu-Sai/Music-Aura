import React, {useEffect, useRef} from 'react';
import {View, Animated, StyleSheet, Dimensions, ScrollView} from 'react-native';
import Reanimated, {FadeIn} from 'react-native-reanimated';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

/**
 * Modern Shimmer Effect Component
 * Creates smooth, delightful loading animations with pulse and wave effects
 */
export const ShimmerEffect = ({width, height, borderRadius = 8, style}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
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
    ).start();

    // Wave animation
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
    ).start();
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
  <View style={styles.albumCardContainer}>
    <ShimmerEffect width={180} height={180} borderRadius={8} />
    <View style={{marginTop: 10, width: 180}}>
      <ShimmerEffect
        width={160}
        height={16}
        borderRadius={5}
      />
    </View>
    <View style={{marginTop: 6, width: 180}}>
      <ShimmerEffect
        width={140}
        height={14}
        borderRadius={5}
      />
    </View>
  </View>
);

/**
 * Shimmer for Horizontal Lists
 */
export const ShimmerHorizontalList = ({
  itemCount = 5,
  itemWidth = 140,
  itemHeight = 140,
  CardComponent = ShimmerSongCard,
}) => (
  <Reanimated.View
    entering={FadeIn.duration(400)}
    style={styles.horizontalListContainer}>
    {Array.from({length: itemCount}).map((_, index) => (
      <Reanimated.View
        key={`shimmer-${index}`}
        entering={FadeIn.delay(index * 100).duration(400)}
        style={{marginRight: 12}}>
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
        style={{marginRight: 12}}>
        <ShimmerEffect width={150} height={140} borderRadius={8} />
        <View style={{marginTop: 12, width: 150}}>
          <ShimmerEffect
            width={135}
            height={18}
            borderRadius={6}
          />
        </View>
        <View style={{marginTop: 8, width: 150}}>
          <ShimmerEffect
            width={115}
            height={15}
            borderRadius={5}
          />
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
 * Full Page Shimmer Loader (Initial Load)
 */
export const ShimmerFullPage = () => (
  <View style={styles.fullPageContainer}>
    {/* Header Skeleton */}
    <View style={styles.headerSection}>
      <ShimmerEffect width={160} height={40} borderRadius={12} />
      <ShimmerEffect width={110} height={36} borderRadius={10} />
    </View>

    {/* Top Genres Chips */}
    <View style={{paddingHorizontal: 15, marginTop: 20, marginBottom: 15}}>
      <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
        {Array.from({length: 6}).map((_, i) => (
          <View key={`genre-${i}`} style={{marginRight: 8, marginBottom: 8}}>
            <ShimmerEffect width={85} height={36} borderRadius={18} />
          </View>
        ))}
      </View>
    </View>

    {/* Section Title */}
    <View style={styles.sectionTitle}>
      <ShimmerEffect width={190} height={30} borderRadius={8} />
    </View>

    {/* Horizontal List */}
    <ShimmerTrendingSongsList itemCount={3} />

    {/* Section Title */}
    <View style={styles.sectionTitle}>
      <ShimmerEffect width={210} height={30} borderRadius={8} />
    </View>

    {/* Horizontal List */}
    <ShimmerHorizontalList itemCount={3} />
  </View>
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
        <ShimmerEffect width={64} height={64} borderRadius={10} />
        <View style={styles.searchResultTextContainer}>
          <ShimmerEffect width={SCREEN_WIDTH - 130} height={19} borderRadius={6} />
          <View style={{marginTop: 8}}>
            <ShimmerEffect width={SCREEN_WIDTH - 170} height={15} borderRadius={5} />
          </View>
        </View>
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
        <ShimmerEffect width={(SCREEN_WIDTH - 50) / 2} height={(SCREEN_WIDTH - 50) / 2} borderRadius={12} />
        <View style={{marginTop: 8, width: (SCREEN_WIDTH - 50) / 2}}>
          <ShimmerEffect width={(SCREEN_WIDTH - 70) / 2} height={16} borderRadius={5} />
        </View>
        <View style={{marginTop: 6, width: (SCREEN_WIDTH - 50) / 2}}>
          <ShimmerEffect width={(SCREEN_WIDTH - 90) / 2} height={13} borderRadius={4} />
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
        <ShimmerEffect width={(SCREEN_WIDTH - 50) / 2} height={(SCREEN_WIDTH - 50) / 2} borderRadius={12} />
        <View style={{marginTop: 8, width: (SCREEN_WIDTH - 50) / 2}}>
          <ShimmerEffect width={(SCREEN_WIDTH - 70) / 2} height={16} borderRadius={5} />
        </View>
        <View style={{marginTop: 6, width: (SCREEN_WIDTH - 50) / 2}}>
          <ShimmerEffect width={(SCREEN_WIDTH - 90) / 2} height={13} borderRadius={4} />
        </View>
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#1c1c1e',
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
