import React from 'react';
import { Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemeContext } from '../../Context/Context';
import { useNavigation } from '@react-navigation/native';

export const EachArtistChip = ({ id, name, image }) => {
  const { currentThemeColors } = React.useContext(ThemeContext);
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('ArtistSongsPage', { artistId: id, artistName: name, artistImage: image });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: image }}
        style={styles.image}
        resizeMode="cover"
      />
      <Text
        style={[
          styles.artistName,
          { color: currentThemeColors.text },
        ]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 140,
    marginRight: 8,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  artistName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
