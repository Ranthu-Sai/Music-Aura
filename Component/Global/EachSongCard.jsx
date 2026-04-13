import {Dimensions, Pressable, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {PlainText} from './PlainText';
import {SmallText} from './SmallText';
import FastImage from 'react-native-fast-image';
import {ShimmerEffect} from './ShimmerEffect';
import {PlaySongWithRelated} from '../../MusicPlayerFunctions';
import React, {memo, useContext, useState, useCallback, useMemo} from 'react';
import {ActionsContext} from '../../Context/Context';
import {getSongStreamingUrl} from '../../Api/Artists';
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

  const isGif = useMemo(() => typeof source !== 'object' || !source.uri, [source]);
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={{height: 60, width: 60, borderRadius: 8, overflow: 'hidden'}}>
      {!isGif && !loaded && (
        <ShimmerEffect width={60} height={60} borderRadius={8} />
      )}
      <FastImage
        source={source}
        resizeMode={FastImage.resizeMode.cover}
        onLoadEnd={() => setLoaded(true)}
        style={{
          height: 60,
          width: 60,
          borderRadius: 8,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </View>
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
  onPress,
  source,
  item,
}) {
  const width1 = Dimensions.get('window').width;
  const {updateTrack, setVisible, lyricsCacheRef} = useContext(ActionsContext);
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const isProcessingRef = React.useRef(false);

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
      for (const it of reversed) {
        if (!it) {
          continue;
        }
        if (typeof it === 'string' && it.trim().length > 0) {
          return it;
        }
        if (
          it.url &&
          typeof it.url === 'string' &&
          it.url.trim().length > 0
        ) {
          return it.url;
        }
        if (
          it.uri &&
          typeof it.uri === 'string' &&
          it.uri.trim().length > 0
        ) {
          return it.uri;
        }
        if (
          it.link &&
          typeof it.link === 'string' &&
          it.link.trim().length > 0
        ) {
          return it.link;
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

  const displayTitle = title || item?.name || item?.title || '';

  const artworkUri = useMemo(
    () =>
      normalizeArtwork(image || item?.image || item?.artwork) ||
      (url &&
      typeof url === 'string' &&
      (url.startsWith('/') || url.startsWith('file://'))
        ? 'https://img.icons8.com/ios-filled/100/1DB954/music-track.png'
        : 'https://via.placeholder.com/60x60/cccccc/000000?text=No+Img'),
    [image, url, normalizeArtwork, item],
  );


  const AddSongToPlayer = useCallback(async () => {
    if (isLoading || isProcessingRef.current) {
      return;
    }
    // set a synchronous guard to avoid race where multiple taps fire before state updates
    isProcessingRef.current = true;
    setIsLoading(true);
    try {
      if (typeof onPress === 'function') {
        onPress({
          id,
          title: displayTitle,
          artist,
          language,
          source,
          item,
        });
      }

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

        // Fetch streaming URLs only for a nearby window around the clicked song to avoid heavy redundant fetching
        try {
          const total = Data.data.songs.length;
          const windowStart = Math.max(0, index - 1);
          const windowEnd = Math.min(total, windowStart + 20); // fetch up to 20 songs starting from clicked index
          const windowSlice = Data.data.songs.slice(windowStart, windowEnd);
          const missing = windowSlice.filter(s => (!s.downloadUrl || !s.hasStreaming) && !s.resolvingStreaming);
          if (missing.length > 0) {
            // mark resolvingStreaming to avoid duplicate fetches
            missing.forEach(s => (s.resolvingStreaming = true));
            await Promise.all(
              missing.map(async s => {
                try {
                  const urls = await getSongStreamingUrl(s.id);
                  s.downloadUrl = urls || s.encrypted_media_url || s.url;
                  s.hasStreaming = !!urls;
                } catch (err) {
                  // ignore per-song errors
                } finally {
                  s.resolvingStreaming = false;
                }
              }),
            );
          }
        } catch (e) {
          console.warn('Failed to fetch missing streaming urls before playing playlist', e);
        }

        const quality = await getIndexQuality();
        const ForMusicPlayer = Data.data.songs.map((e, i) => {
          // Handle the case where downloadUrl might be a single URL or an array
          const download = Array.isArray(e?.downloadUrl)
            ? e?.downloadUrl[quality]?.url || e?.downloadUrl[quality]?.link || e?.downloadUrl[0]?.url || e?.downloadUrl[0]?.link
            : e?.downloadUrl;

          return {
            url: download,
            title: FormatTitleAndArtist(e?.name || e?.title),
            artist: FormatTitleAndArtist(FormatArtist(e?.artists?.primary || e?.primaryArtists)),
            artwork: Array.isArray(e?.image)
              ? e?.image[2]?.url || e?.image[2]?.link || e?.image[0]?.url || e?.image[0]?.link
              : e?.image,
            image: Array.isArray(e?.image)
              ? e?.image[2]?.url || e?.image[2]?.link || e?.image[0]?.url || e?.image[0]?.link
              : e?.image,
            duration: e?.duration,
            id: e?.id,
            language: e?.language,
            artistID: e?.primary_artists_id || e?.primaryArtistsId,
            source: e?.source || Data.data.source,
          };
        });

        // Play from the clicked song using startSongId
        await AddPlaylist(ForMusicPlayer, id);
        await updateTrack();
      } else if (
        Data &&
        Data.data &&
        Data.data.results &&
        Array.isArray(Data.data.results)
      ) {
        // Search results mode: Add the tapped song to the queue and play it
        const {AddSongsToQueue} = require('../../MusicPlayerFunctions');
        // Fix: Ensure Saavn songs have correct downloadUrl
        let downloadUrlValue = url;
        if (source === 'saavn' && item && item.downloadUrl) {
          downloadUrlValue = Array.isArray(item.downloadUrl)
            ? item.downloadUrl
            : [item.downloadUrl];
        }
        const songToAdd = {
          id,
          title: displayTitle,
          artist,
          url,
          duration,
          language,
          source,
          artwork: artworkUri,
          image: artworkUri,
          downloadUrl: downloadUrlValue,
        };
        await AddSongsToQueue([songToAdd]);
        await PlaySongWithRelated(id, artworkUri, songToAdd);
        await updateTrack();
      } else if (Data && Array.isArray(Data)) {
        // Liked songs or other array-based lists: Play from this song and queue remaining songs
        const {
          AddPlaylist,
          getIndexQuality,
        } = require('../../MusicPlayerFunctions');

        // Ensure missing streaming URLs are fetched for songs in this list (array mode)
        try {
          const missing = Data.filter(s => !s.downloadUrl || !s.hasStreaming);
          if (missing.length > 0) {
            await Promise.all(
              missing.map(async s => {
                const urls = await getSongStreamingUrl(s.id);
                s.downloadUrl = urls || s.encrypted_media_url || s.url;
                s.hasStreaming = !!urls;
              }),
            );
          }
        } catch (e) {
          console.warn('Failed to fetch missing streaming urls before playing list', e);
        }

        const quality = await getIndexQuality();
        const ForMusicPlayer = Data.map((e, i) => {
          // Handle the case where downloadUrl might be a single URL or an array
          const download = Array.isArray(e?.downloadUrl)
            ? e?.downloadUrl[quality]?.url || e?.downloadUrl[quality]?.link || e?.downloadUrl[0]?.url || e?.downloadUrl[0]?.link
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
        await PlaySongWithRelated(id, artworkUri, {
          title: displayTitle,
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
      isProcessingRef.current = false;
      setIsLoading(false);
    }
  }, [
    isLoading,
    id,
    artist,
    url,
    duration,
    language,
    onPress,
    updateTrack,
    lyricsCacheRef,
    Data,
    artworkUri,
    displayTitle,
    index,
    source,
    item,
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
          }}>
          <Pressable
            onPress={AddSongToPlayer}
            disabled={isLoading}
            style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              flex: 1,
              opacity: isLoading ? 0.5 : 1,
            }}>
            <SongStatusImage id={id} artworkUri={artworkUri} />
            <View
              style={{
                flex: 1,
                paddingRight: 45, // Increased padding to avoid overlap with menu button
              }}>
              {displayTitle ? (
                <PlainText
                  text={FormatTitleAndArtist(displayTitle, artist)}
                  numberOfLine={1}
                  style={{
                    fontSize: width1 * 0.038,
                    width: '100%',
                  }}
                />
              ) : (
                <ShimmerEffect
                  width={width1 * 0.5}
                  height={16}
                  borderRadius={5}
                />
              )}
              <View style={{height: 2}} />
              {artist ? (
                <SmallText
                  text={FormatTitleAndArtist(artist)}
                  maxLine={2} // Allow artist to fill the second line as requested
                  style={{
                    fontSize: width1 * 0.032,
                    opacity: 0.7,
                    width: '100%',
                  }}
                />
              ) : (
                <View style={{marginTop: 4}}>
                  <ShimmerEffect
                    width={width1 * 0.35}
                    height={14}
                    borderRadius={4}
                  />
                </View>
              )}
            </View>
          </Pressable>
          
          <View style={{position: 'absolute', right: 5, top: '50%', marginTop: -20}}>
            <EachSongMenuButton
              Onpress={() => {
                setVisible({
                  visible: true,
                  title: displayTitle,
                  artist,
                  image: artworkUri,
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
        </View>
      </View>
    </>
  );
});
