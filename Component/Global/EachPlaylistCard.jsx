import {Pressable, View} from 'react-native';
import {PlainText} from './PlainText';
import {SmallText} from './SmallText';
// Removed unused Layout/SpaceBetween and FontAwesome5 imports
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';
import {ShimmerEffect} from './ShimmerEffect';
import {memo, useState, useEffect} from 'react';
import {useNavigation} from '@react-navigation/native';

export const EachPlaylistCard = memo(function EachPlaylistCard({
  image,
  name,
  follower,
  id,
  MainContainerStyle,
  ImageStyle,
  isArtist = false,
  source,
}) {
  const navigation = useNavigation();

  const computeImageUri = img => {
    if (!img) {return 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image';}
    if (typeof img === 'string') {return img;}
    if (Array.isArray(img)) {
      for (let i = img.length - 1; i >= 0; i--) {
        const it = img[i];
        if (!it) {continue;}
        if (typeof it === 'string') {return it;}
        if (it.url) {return it.url;}
        if (it.link) {return it.link;}
      }
    }
    if (img.url) {return img.url;}
    if (img.link) {return img.link;}
    return 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image';
  };

  const [imageUri, setImageUri] = useState(computeImageUri(image));
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageUri(computeImageUri(image));
  }, [image]);
  return (
    <Pressable
      onPress={() => {
        if (isArtist) {
          const artistRoute =
            String(source || '').toLowerCase() === 'ytmusic'
              ? 'ArtistPage'
              : 'ArtistSongsPage';

          navigation.navigate(artistRoute, {
            artistId: id,
            artistName: name,
            artistImage: image,
            source,
          });
        } else {
          // Navigate to playlist page
          navigation.navigate('Playlist', {id, image, name, follower});
        }
      }}
      style={{
        width: 180,
        height: 240,
        ...MainContainerStyle,
      }}>
      {imageUri.includes('placeholder') ? (
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 12,
            backgroundColor: '#1DB954', // Spotify Green for user playlists
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            elevation: 10,
            overflow: 'hidden',
          }}>
          <LinearGradient
            colors={['#1DB954', '#191414']}
            style={{position: 'absolute', width: '100%', height: '100%'}}
          />
          <MaterialCommunityIcons
            name="playlist-music"
            size={60}
            color="white"
          />
          <View
            style={{position: 'absolute', bottom: 10, right: 10, opacity: 0.2}}>
            <MaterialCommunityIcons
              name="pencil-plus"
              size={24}
              color="white"
            />
          </View>
        </View>
      ) : (
        <View style={{width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden'}}>
          {!imageLoaded && (
            <ShimmerEffect width={180} height={180} borderRadius={8} />
          )}
          <FastImage
            source={{
              uri: imageUri,
              priority: 'high',
            }}
            onLoadEnd={() => setImageLoaded(true)}
            onError={() => {
              setImageLoaded(true);
              setImageUri(
                'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image',
              );
            }}
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: 8,
              ...ImageStyle,
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            resizeMode="contain"
          />
        </View>
      )}
      <View
        style={{
          marginTop: 10,
          width: '100%',
          alignItems: 'center',
        }}>
        {name ? (
          <PlainText text={name} style={{fontWeight: 'bold'}} />
        ) : (
          <ShimmerEffect width={160} height={16} borderRadius={5} />
        )}
        {follower ? (
          <SmallText text={follower} />
        ) : (
          <View style={{marginTop: 6}}>
            <ShimmerEffect width={120} height={14} borderRadius={4} />
          </View>
        )}
      </View>
    </Pressable>
  );
});
