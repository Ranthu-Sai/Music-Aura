import {Pressable, View} from 'react-native';
import {PlainText} from './PlainText';
import {SmallText} from './SmallText';
import FastImage from 'react-native-fast-image';
import {ShimmerEffect} from './ShimmerEffect';
import React, {memo, useContext, useState, useCallback, useMemo} from 'react';
import {PlaySongWithRelated} from '../../MusicPlayerFunctions';
import {ActionsContext} from '../../Context/Context';
import {getSongData} from '../../Api/Songs';
import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';
import FormatArtist from '../../Utils/FormatArtists';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useActiveTrack, usePlaybackState} from 'react-native-track-player';

const TrendingSongStatusIcon = memo(({id}) => {
  const currentPlaying = useActiveTrack();
  const playerState = usePlaybackState();
  const stateVal =
    typeof playerState === 'object' && playerState !== null
      ? playerState.state
      : playerState;

  const isCurrentSong = id === currentPlaying?.id;
  const isPlaying = stateVal === 'playing' || stateVal === 3;

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
  source = 'saavn',
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
      console.log('[Home Trending Tap] pressed', {
        id,
        name,
        source,
        hasUrl: !!url,
        urlType: Array.isArray(url) ? 'array' : typeof url,
      });

      if (lyricsCacheRef?.current) {
        lyricsCacheRef.current = {};
      }

      let resolvedDownloadUrl = url || undefined;
      let resolvedTitle = name || undefined;
      let resolvedArtist = artistsNames || undefined;
      let resolvedArtwork = image;
      let resolvedDuration = duration || undefined;

      try {
        const songDetails = await getSongData(id);
        const songInfo =
          songDetails?.data?.[0] || songDetails?.data?.results?.[0] || songDetails?.data || {};

        const candidateDownload =
          songInfo?.downloadUrl ||
          songInfo?.download_url ||
          songInfo?.downloadUrls ||
          songInfo?.media?.downloadUrl ||
          songInfo?.media?.download_url;

        if (Array.isArray(candidateDownload) && candidateDownload.length > 0) {
          resolvedDownloadUrl = candidateDownload;
        } else if (typeof candidateDownload === 'string' && candidateDownload) {
          resolvedDownloadUrl = candidateDownload;
        }

        resolvedTitle = resolvedTitle || songInfo?.title || songInfo?.name;
        resolvedArtist =
          resolvedArtist ||
          songInfo?.primaryArtists ||
          songInfo?.primary_artists ||
          songInfo?.artist ||
          songInfo?.artists ||
          songInfo?.subtitle;
        resolvedDuration =
          resolvedDuration || songInfo?.duration || songInfo?.length || 0;
        resolvedArtwork =
          resolvedArtwork ||
          songInfo?.image ||
          songInfo?.thumbnails ||
          songInfo?.albumCover ||
          songInfo?.cover;
      } catch (resolveError) {
        // Fall back to the API-less path below.
        console.warn('[Home Trending Tap] resolve failed', {
          id,
          message: resolveError?.message || String(resolveError),
        });
      }

      // For Saavn songs from Home, url is actually the downloadUrl array
      const songData = {
        downloadUrl: resolvedDownloadUrl,
        duration: resolvedDuration,
        language: language || undefined,
        title: resolvedTitle,
        artist: resolvedArtist,
        artwork: resolvedArtwork,
        source,
      };
      console.log('[Home Trending Tap] resolved payload', {
        id,
        source: songData.source,
        title: songData.title,
        artist: songData.artist,
        duration: songData.duration,
        downloadUrlType: Array.isArray(songData.downloadUrl)
          ? 'array'
          : typeof songData.downloadUrl,
        hasDownloadUrl: !!songData.downloadUrl,
      });

      await PlaySongWithRelated(id, resolvedArtwork || image, songData);
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
    source,
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
