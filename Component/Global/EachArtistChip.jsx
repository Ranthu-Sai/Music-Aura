import React, {useState} from 'react';
import {Text, Image, TouchableOpacity, StyleSheet, View} from 'react-native';
import {ShimmerEffect} from './ShimmerEffect';
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
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        {!loaded && (
          <ShimmerEffect width={150} height={150} borderRadius={75} />
        )}
        <Image
          source={{uri: imageUrl}}
          style={styles.imageAbsolute}
          resizeMode="cover"
          onLoadEnd={() => setLoaded(true)}
        />
      </View>
      {name ? (
        <Text style={[styles.artistName, {color: '#FFFFFF'}]} numberOfLines={1}>
          {name}
        </Text>
      ) : (
        <View style={{marginTop: 8}}>
          <ShimmerEffect width={130} height={16} borderRadius={6} />
        </View>
      )}
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
  imageContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 8,
    overflow: 'hidden',
  },
  imageAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
