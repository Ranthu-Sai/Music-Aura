import React from 'react';
import {Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';

export const EachArtistChip = ({id, name, image}) => {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('ArtistSongsPage', {
      artistId: id,
      artistName: name,
      artistImage: image,
    });
  };

  const imageUrl =
    typeof image === 'string' && image.startsWith('http')
      ? image
      : 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}>
      <Image source={{uri: imageUrl}} style={styles.image} resizeMode="cover" />
      <Text style={[styles.artistName, {color: '#FFFFFF'}]} numberOfLines={1}>
        {name || 'Unknown Artist'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 150,
    marginRight: 8,
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 8,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
