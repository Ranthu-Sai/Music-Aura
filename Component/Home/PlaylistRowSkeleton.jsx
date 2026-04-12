import React from 'react';
import {View, StyleSheet} from 'react-native';

export const PlaylistRowSkeleton = ({count = 4}) => {
  return (
    <View style={styles.container}>
      <View style={styles.heading} />
      <View style={styles.row}>
        {Array.from({length: count}).map((_, index) => (
          <View key={index} style={styles.card} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {paddingHorizontal: 13, paddingVertical: 8},
  heading: {height: 22, width: 160, borderRadius: 6, backgroundColor: '#2a2a2a', marginBottom: 12},
  row: {flexDirection: 'row', gap: 10},
  card: {width: 180, height: 240, borderRadius: 12, backgroundColor: '#2a2a2a'},
});
