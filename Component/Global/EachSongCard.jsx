import {Dimensions, Pressable, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {PlainText} from './PlainText';
import {SmallText} from './SmallText';
import FastImage from 'react-native-fast-image';
import {PlaySongWithRelated} from '../../MusicPlayerFunctions';
import React, {memo, useContext, useState, useCallback, useMemo} from 'react';
import {ActionsContext} from '../../Context/Context';
import {useActiveTrack, usePlaybackState} from 'react-native-track-player';
import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';
import {EachSongMenuButton} from '../MusicPlayer/EachSongMenuButton';

const SongStatusImage = memo(({id, artworkUri}) => {
  const currentPlaying = useActiveTrack();
  const playerState = usePlaybackState();

  const isCurrentSong = id === currentPlaying?.id;
  const isPlaying = playerState.state === 'playing' || playerState.state === 3; // State.Playing

  const source = useMemo(() => {
    if (isCurrentSong && isPlaying) {
      return require('../../Images/playing.gif');
    } else if (isCurrentSong && !isPlaying) {
      return require('../../Images/songPaused.gif');
    }
    return {uri: artworkUri};
  }, [isCurrentSong, isPlaying, artworkUri]);

  return (
    <FastImage
      source={source}
      resizeMode={FastImage.resizeMode.cover}
      style={{
        height: 60,
        width: 60,
        borderRadius: 8,
      }}
    />
  );
});

export const EachSongCard = memo(function EachSongCard({
  title,
  artist,
  image,
  id,
  url,
  duration,
  language,
  artistID,
  isLibraryLiked,
  width,
  titleandartistwidth,
  isFromPlaylist,
  Data,
  index,
  albumName,
  releaseDate,
  albumId,
  isHighlighted,
  playlistId,
  isHistory,
  onRemove,
  source,
}) {
  const width1 = Dimensions.get('window').width;
  const {updateTrack, setVisible, lyricsCacheRef} = useContext(ActionsContext);
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  // Normalize artwork formats (string, array, object) to a single URI
  const normalizeArtwork = useCallback(img => {
    if (!img) {
      return null;
    }
    if (typeof img === 'string' && img.trim().length > 0) {
      return img;
    }

    // If it's an array, find the best quality URL
    if (Array.isArray(img) && img.length > 0) {
      // Create a copy and reverse to search from highest quality
      const reversed = [...img].reverse();
      for (const item of reversed) {
        if (!item) {
          continue;
        }
        if (typeof item === 'string' && item.trim().length > 0) {
          return item;
        }
        if (
          item.url &&
          typeof item.url === 'string' &&
          item.url.trim().length > 0
        ) {
          return item.url;
        }
        if (
          item.uri &&
          typeof item.uri === 'string' &&
          item.uri.trim().length > 0
        ) {
          return item.uri;
        }
        if (
          item.link &&
          typeof item.link === 'string' &&
          item.link.trim().length > 0
        ) {
          return item.link;
        }
      }
    }

    // If it's an object, check common fields
    if (typeof img === 'object') {
      if (img.url && typeof img.url === 'string' && img.url.trim().length > 0) {
        return img.url;
      }
      if (img.uri && typeof img.uri === 'string' && img.uri.trim().length > 0) {
        return img.uri;
      }
      if (
        img.link &&
        typeof img.link === 'string' &&
        img.link.trim().length > 0
      ) {
        return img.link;
      }
      if (img.thumbnail) {
        if (
          typeof img.thumbnail === 'string' &&
          img.thumbnail.trim().length > 0
        ) {
          return img.thumbnail;
        }
        if (
          img.thumbnail.url &&
          typeof img.thumbnail.url === 'string' &&
          img.thumbnail.url.trim().length > 0
        ) {
          return img.thumbnail.url;
        }
        if (
          img.thumbnail.uri &&
          typeof img.thumbnail.uri === 'string' &&
          img.thumbnail.uri.trim().length > 0
        ) {
          return img.thumbnail.uri;
        }
      }
    }
    return null;
  }, []);

  const artworkUri = useMemo(
    () =>
      normalizeArtwork(image) ||
      (url &&
      typeof url === 'string' &&
      (url.startsWith('/') || url.startsWith('file://'))
        ? 'https://img.icons8.com/ios-filled/100/1DB954/music-track.png'
        : 'https://via.placeholder.com/60x60/cccccc/000000?text=No+Img'),
    [image, url, normalizeArtwork],
  );


  const AddSongToPlayer = useCallback(async () => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      if (lyricsCacheRef?.current) {
        lyricsCacheRef.current = {};
      }

      // Check if this song is from an album/playlist with Data prop
      if (
        Data &&
        Data.data &&
        Data.data.songs &&
        Array.isArray(Data.data.songs)
      ) {
        // Album/Playlist mode: Play from this song and queue remaining songs
        const {
          AddPlaylist,
          getIndexQuality,
        } = require('../../MusicPlayerFunctions');
        const FormatArtist = require('../../Utils/FormatArtists').default;

        const quality = await getIndexQuality();
        const ForMusicPlayer = Data.data.songs.map((e, i) => {
          // Handle the case where downloadUrl might be a single URL or an array
          const download = Array.isArray(e?.downloadUrl)
            ? e?.downloadUrl[quality]?.url || e?.downloadUrl[0]?.url
            : e?.downloadUrl;

          return {
            url: download,
            title: FormatTitleAndArtist(e?.name || e?.title),
            artist: FormatTitleAndArtist(FormatArtist(e?.artists?.primary)),
            artwork: Array.isArray(e?.image)
              ? e?.image[2]?.url || e?.image[0]?.url
              : e?.image,
            image: Array.isArray(e?.image)
              ? e?.image[2]?.url || e?.image[0]?.url
              : e?.image,
            duration: e?.duration,
            id: e?.id,
            language: e?.language,
            artistID: e?.primary_artists_id,
            source: e?.source || Data.data.source,
          };
        });

        // Play from the clicked song using startSongId
        await AddPlaylist(ForMusicPlayer, id);
        await updateTrack();
      } else if (Data && Array.isArray(Data)) {
        // Liked songs or other array-based lists: Play from this song and queue remaining songs
        const {
          AddPlaylist,
          getIndexQuality,
        } = require('../../MusicPlayerFunctions');

        const quality = await getIndexQuality();
        const ForMusicPlayer = Data.map((e, i) => {
          // Handle the case where downloadUrl might be a single URL or an array
          const download = Array.isArray(e?.downloadUrl)
            ? e?.downloadUrl[quality]?.url || e?.downloadUrl[0]?.url
            : e?.downloadUrl || e?.url;

          return {
            url: download,
            title: FormatTitleAndArtist(e?.title || e?.name),
            artist: FormatTitleAndArtist(e?.artist),
            artwork: e?.artwork || e?.image,
            image: e?.artwork || e?.image,
            duration: e?.duration,
            id: e?.id,
            language: e?.language,
            artistID: e?.artistID || e?.primary_artists_id,
            source: e?.source,
          };
        });

        // Play from the clicked song using startSongId
        await AddPlaylist(ForMusicPlayer, id);
        await updateTrack();
      } else {
        // Single song mode: Use existing behavior with recommendations
        await PlaySongWithRelated(id, image, {
          title,
          artist,
          url,
          duration,
          language,
        });
        await updateTrack();
      }
    } catch (error) {
      console.error('Error in AddSongToPlayer:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    id,
    image,
    title,
    artist,
    url,
    duration,
    language,
    updateTrack,
    lyricsCacheRef,
    Data,
  ]);

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          width: width ? width : width1,
          marginRight: 10,
          alignItems: 'center',
          paddingRight: 4,
          backgroundColor: isHighlighted
            ? 'rgba(52, 152, 219, 0.15)'
            : 'transparent',
          borderRadius: 10,
          paddingVertical: isHighlighted ? 4 : 0,
          paddingLeft: isHighlighted ? 6 : 0,
          borderWidth: isHighlighted ? 1 : 0,
          borderColor: isHighlighted
            ? 'rgba(52, 152, 219, 0.3)'
            : 'transparent',
        }}>
        <Pressable
          onPress={AddSongToPlayer}
          disabled={isLoading}
          style={{
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            elevation: 10,
            marginBottom: 4,
            flex: 1,
            opacity: isLoading ? 0.5 : 1,
          }}>
          <SongStatusImage id={id} artworkUri={artworkUri} />
          <View
            style={{
              flex: 1,
            }}>
            <PlainText
              text={FormatTitleAndArtist(title, artist)}
              style={{
                width: titleandartistwidth
                  ? titleandartistwidth
                  : width1 * 0.67,
              }}
            />
            <SmallText
              text={FormatTitleAndArtist(artist)}
              style={{
                width: titleandartistwidth
                  ? titleandartistwidth
                  : width1 * 0.67,
              }}
            />
          </View>
        </Pressable>
        <EachSongMenuButton
          Onpress={() => {
            setVisible({
              visible: true,
              title,
              artist,
              image,
              id,
              url,
              duration,
              language,
              playlistId,
              albumId,
              albumName,
              navigation,
              isHistory,
              onRemove,
              source,
            });
          }}
        />
      </View>
    </>
  );
});
