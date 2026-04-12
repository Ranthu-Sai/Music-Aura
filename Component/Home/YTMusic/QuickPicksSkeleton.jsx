import React, {useEffect, useRef} from 'react';
import {
  View,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@react-navigation/native';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export const QuickPicksSkeleton = () => {
  const {dark} = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  const SONG_WIDTH = SCREEN_WIDTH * 0.85;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.heading,
          {
            backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
            opacity: shimmerOpacity,
          },
        ]}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columns}>
        {[...Array(2)].map((_, colIndex) => (
          <View key={colIndex} style={[styles.column, {width: SONG_WIDTH}]}>
            {[...Array(4)].map((__, songIndex) => (
              <View key={songIndex} style={styles.songCard}>
                <Animated.View
                  style={[
                    styles.songImage,
                    {
                      backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
                      opacity: shimmerOpacity,
                    },
                  ]}
                />
                <View style={styles.textContainer}>
                  <Animated.View
                    style={[
                      styles.songTitle,
                      {
                        backgroundColor: dark ? '#2a2a2a' : '#e0e0e0',
                        opacity: shimmerOpacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.songArtist,
                      {
                        backgroundColor: dark ? '#252525' : '#d0d0d0',
                        opacity: shimmerOpacity,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
  },
  heading: {
    height: 22,
    width: 140,
    borderRadius: 4,
    marginBottom: 16,
    marginHorizontal: 13,
  },
  columns: {
    paddingLeft: 0,
    paddingRight: 10,
  },
  column: {
    marginRight: 8,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  songImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  songTitle: {
    height: 14,
    width: '60%',
    borderRadius: 3,
    marginBottom: 6,
  },
  songArtist: {
    height: 11,
    width: '40%',
    borderRadius: 3,
  },
});
