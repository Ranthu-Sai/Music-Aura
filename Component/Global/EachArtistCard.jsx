import React, {memo} from 'react';
import {Image, Pressable, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {useNavigation} from '@react-navigation/native';
import {PlainText} from './PlainText';
import {SmallText} from './SmallText';

export const EachArtistCard = memo(function EachArtistCard({
  name,
  subtitle,
  image,
  id,
  browseId,
  style,
  width = 160,
  containerStyle,
  source,
  ringEffect = false,
}) {
  const {colors} = useTheme();
  const navigation = useNavigation();

  const handlePress = () => {
    const artistId = browseId || id;
    if (!artistId) {
      return;
    }

    const artistRoute =
      String(source || '').toLowerCase() === 'ytmusic'
        ? 'ArtistPage'
        : 'ArtistSongsPage';

    navigation.navigate(artistRoute, {
      artistId: artistId,
      artistName: name,
      artistImage: image,
      source,
    });
  };

  const imageUri =
    image || 'https://via.placeholder.com/150x150/cccccc/666666?text=Artist';

  return (
    <Pressable
      onPress={handlePress}
      style={[
        {
          width: width,
          paddingHorizontal: 6,
        },
        containerStyle,
      ]}>
      {/* Artist Image - Circular */}
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: 80,
          overflow: 'hidden',
          marginBottom: 8,
          backgroundColor: colors.border,
          borderWidth: ringEffect ? 2 : 0,
          borderColor: ringEffect ? 'rgba(255,255,255,0.28)' : 'transparent',
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}>
        <Image
          source={{uri: imageUri}}
          style={{
            width: '100%',
            height: '100%',
          }}
          onError={() => {}}
          resizeMode="cover"
        />
      </View>

      {/* Artist Name */}
      <View style={{marginBottom: 4}}>
        <PlainText
          text={name || 'Unknown Artist'}
          numberOfLines={2}
          style={{
            fontSize: 14,
            fontWeight: '600',
            textAlign: 'center',
          }}
        />
      </View>

      {/* Subtitle/Role */}
      {subtitle && (
        <SmallText
          text={subtitle}
          numberOfLines={1}
          style={{
            textAlign: 'center',
            fontSize: 12,
          }}
        />
      )}
    </Pressable>
  );
});

EachArtistCard.displayName = 'EachArtistCard';
