import {Pressable, View} from 'react-native';
import {PlainText} from './PlainText';
import {SmallText} from './SmallText';
import FastImage from 'react-native-fast-image';
import {ShimmerEffect} from './ShimmerEffect';
import React, {memo, useContext, useState, useCallback, useMemo} from 'react';
import {PlaySongWithRelated} from '../../MusicPlayerFunctions';
import {ActionsContext} from '../../Context/Context';
import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';
import FormatArtist from '../../Utils/FormatArtists';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useActiveTrack, usePlaybackState} from 'react-native-track-player';

const TrendingSongStatusIcon = memo(({id}) => {
  const currentPlaying = useActiveTrack();
  const playerState = usePlaybackState();

  const isCurrentSong = id === currentPlaying?.id;
  const isPlaying = playerState.state === 'playing' || playerState.state === 3;

  const getIconName = () => {
    if (isCurrentSong) {
      return isPlaying ? 'pause' : 'play';
    }
    return 'play';
  };

  return (
    <View
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 8,
      }}>
      <MaterialCommunityIcons name={getIconName()} size={24} color="white" />
    </View>
  );
});

export const EachTrendingSongCard = memo(function EachTrendingSongCard({
  image,
  name,
  artists,
  id,
  url,
  duration,
  language,
}) {
  const {updateTrack, lyricsCacheRef} = useContext(ActionsContext);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUri, setImageUri] = useState(
    image || 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image',
  );
  const [imageLoaded, setImageLoaded] = useState(false);

  const artistsNames = useMemo(() => FormatArtist(artists), [artists]);
  const formattedName = useMemo(() => FormatTitleAndArtist(name || ''), [name]);

  const PlaySong = useCallback(async () => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      if (lyricsCacheRef?.current) {
        lyricsCacheRef.current = {};
      }
      // For Saavn songs from Home, url is actually the downloadUrl array
      const songData = {
        downloadUrl: url || undefined,
        duration: duration || undefined,
        language: language || undefined,
        title: name || undefined,
        artist: artistsNames || undefined,
      };
      await PlaySongWithRelated(id, image, songData);
      await updateTrack();
    } catch (error) {
      console.error('Error playing song:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    id,
    image,
    updateTrack,
    lyricsCacheRef,
    url,
    duration,
    language,
    name,
    artistsNames,
  ]);

  return (
    <Pressable
      onPress={PlaySong}
      disabled={isLoading}
      style={{
        borderRadius: 8,
        width: 150,
        backgroundColor: 'rgba(55,55,79,0)',
        overflow: 'hidden',
        opacity: isLoading ? 0.5 : 1,
      }}>
      <View style={{height: 140, width: '100%', borderRadius: 8, overflow: 'hidden'}}>
        {!imageLoaded && (
          <ShimmerEffect width={150} height={140} borderRadius={8} />
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
            height: 140,
            width: '100%',
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
          }}>
          <TrendingSongStatusIcon id={id} />
        </FastImage>
      </View>
      <View
        style={{
          padding: 8,
        }}>
        {formattedName ? (
          <PlainText text={formattedName} numberOfLine={2} />
        ) : (
          <ShimmerEffect width={135} height={18} borderRadius={6} />
        )}
        {artistsNames ? (
          <SmallText text={artistsNames} maxLine={1} />
        ) : (
          <View style={{marginTop: 6}}>
            <ShimmerEffect width={115} height={15} borderRadius={5} />
          </View>
        )}
      </View>
    </Pressable>
  );
});
