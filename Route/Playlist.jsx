import {MainWrapper} from '../Layout/MainWrapper';
import {PlaylistTopHeader} from '../Component/Playlist/PlaylistTopHeader';
import {PlaylistDetails} from '../Component/Playlist/PlaylistDetails';
import {View, FlatList, ActivityIndicator} from 'react-native';
import {EachSongCard} from '../Component/Global/EachSongCard';
import {useEffect, useState, useCallback, useMemo} from 'react';
import {getPlaylistData} from '../Api/Playlist';
import {getSongStreamingUrl} from '../Api/Artists';

import {PlainText} from '../Component/Global/PlainText';
import {SmallText} from '../Component/Global/SmallText';
import FormatArtist from '../Utils/FormatArtists';
import {useActiveTrack} from 'react-native-track-player';

// Small skeleton row used while content is loading
const SkeletonSong = () => (
  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
    <View style={{width: 60, height: 60, borderRadius: 8, backgroundColor: '#2a2a2a', opacity: 0.6, marginRight: 10}} />
    <View style={{flex: 1}}>
      <View style={{height: 14, width: '70%', backgroundColor: '#2a2a2a', opacity: 0.6, borderRadius: 6, marginBottom: 6}} />
      <View style={{height: 12, width: '40%', backgroundColor: '#2a2a2a', opacity: 0.5, borderRadius: 6}} />
    </View>
  </View>
);

export const Playlist = ({route}) => {

  const [Loading, setLoading] = useState(true);
  const [Data, setData] = useState({});
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isResolvingInitial, setIsResolvingInitial] = useState(false);
  const [isFullListLoaded, setIsFullListLoaded] = useState(false);
  const pageSize = 10;
  const activeTrack = useActiveTrack();
  const {id, image, name, follower} = route.params;

  // Normalize playlist image to a single URL string for the header.
  // Search results can pass image as Saavn-style array (with .link) or YTMusic-style array (with .url) or string.
  const headerImageUrl = Array.isArray(image)
    ? image?.[2]?.link ||
      image?.[2]?.url ||
      image?.[1]?.link ||
      image?.[1]?.url ||
      image?.[0]?.link ||
      image?.[0]?.url ||
      ''
    : typeof image === 'string'
    ? image
    : '';

  const fetchPlaylistData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPlaylistData(id);

      if (data?.data) {
        // Show initial small page immediately for faster perceived load
        const initialSongs = (data.data.songs || []).slice(0, pageSize).map(s => ({...s, hasStreaming: !!s.downloadUrl}));
        setData({data: {...data.data, songs: initialSongs}});

        // Start resolving streaming URLs for initial batch in background
        (async () => {
          setIsResolvingInitial(true);
          try {
            const updated = await Promise.all(initialSongs.map(async s => {
              if (s.downloadUrl && s.hasStreaming) {return s;}
              const urls = await getSongStreamingUrl(s.id);
              return {...s, downloadUrl: urls || s.encrypted_media_url, hasStreaming: !!urls};
            }));
            setData(prev => ({...prev, data: {...prev.data, songs: updated.concat(prev.data.songs.slice(updated.length))}}));

            // Quietly prefetch next batch to reduce lag when user scrolls
            setTimeout(() => {
              try {
                if (typeof fetchStreamingUrlsForRange === 'function') {
                  fetchStreamingUrlsForRange(pageSize, {prefetch: true});
                }
              } catch (err) {
                // ignore
              }
            }, 200);
          } catch (e) {
            console.warn('Initial streaming resolution failed', e);
          } finally {
            setIsResolvingInitial(false);
          }
        })();

        // Background fetch full list and merge
        (async () => {
          try {
            const full = await getPlaylistData(id);
            if (full?.data?.songs) {
              // Merge new songs keeping initial first
              const existingIds = new Set((initialSongs || []).map(s => s.id));
              const merged = [
                ...initialSongs,
                ...full.data.songs.filter(s => !existingIds.has(s.id)).map(s => ({...s, hasStreaming: !!s.downloadUrl})),
              ];
              setData({data: {...full.data, songs: merged}});
            }
          } catch (e) {
            console.warn('Background full playlist fetch failed', e);
          } finally {
            setIsFullListLoaded(true);
          }
        })();

      } else {
        setData({});
      }
    } catch (e) {
      console.warn('Failed to fetch playlist', e);
    } finally {
      setLoading(false);
    }
  }, [id, fetchStreamingUrlsForRange]);
  useEffect(() => {
    fetchPlaylistData();

  }, [fetchPlaylistData]);



  // Ensure we show at least `pageSize` rows: pad with skeletons if there are fewer initial songs
  const displayData = useMemo(() => {
    const real = (Data?.data?.songs || []).map(s => ({...s}));
    if (real.length >= pageSize) {return real;}
    const pads = Array.from({length: Math.max(0, pageSize - real.length)}).map((_, i) => ({__placeholder: true, key: `pad-${i}`}));
    return [...real, ...pads];
  }, [Data?.data?.songs, pageSize]);

  // Helper to fetch streaming urls for a range
  const fetchStreamingUrlsForRange = useCallback(async (startIndex, opts = {isInitial: false, prefetch: false}) => {
    if (!Data?.data?.songs) {return;}
    if (opts.prefetch && (isFetchingMore || isResolvingInitial)) {return;}
    if (!opts.prefetch) {
      if (opts.isInitial && isResolvingInitial) {return;}
      if (!opts.isInitial && isFetchingMore) {return;}
    }

    const songs = Data.data.songs;
    const batch = songs.slice(startIndex, startIndex + pageSize);

    // Nothing to do
    if (!batch || batch.length === 0) {return;}
    if (batch.every(s => s.downloadUrl && s.hasStreaming)) {return;}

    if (!opts.prefetch) {
      if (opts.isInitial) {setIsResolvingInitial(true);}
      else {setIsFetchingMore(true);}
    }

    try {
      const updated = await Promise.all(batch.map(async s => {
        if (s.downloadUrl && s.hasStreaming) {return s;}
        const urls = await getSongStreamingUrl(s.id);
        return {...s, downloadUrl: urls || s.encrypted_media_url, hasStreaming: !!urls};
      }));

      setData(prev => {
        if (!prev?.data?.songs) {return prev;}
        const newSongs = [...prev.data.songs];
        for (let i = 0; i < updated.length; i++) {
          newSongs[startIndex + i] = updated[i];
        }
        return {...prev, data: {...prev.data, songs: newSongs}};
      });
    } catch (e) {
      console.warn('Failed to fetch streaming urls for playlist batch', e);
    } finally {
      if (!opts.prefetch) {
        if (opts.isInitial) {setIsResolvingInitial(false);}
        else {setIsFetchingMore(false);}
      }
    }
  }, [Data, isFetchingMore, isResolvingInitial, pageSize, setData, setIsFetchingMore, setIsResolvingInitial]);

  const ListHeader = useCallback(() => (
    <>
      <PlaylistTopHeader url={headerImageUrl} />
      <PlaylistDetails
        id={id}
        image={image}
        name={name}
        follower={follower}
        listener={follower ?? ''}
        releasedDate={Data?.data?.releaseDate ?? ''}
        Data={Data}
        Loading={Loading}
      />
    </>
  ), [headerImageUrl, id, image, name, follower, Data, Loading]);

  const renderSongItem = useCallback(({item, index}) => (
    item && item.__placeholder ? (
      <SkeletonSong />
    ) : (
      <EachSongCard
        Data={Data}
        isFromPlaylist={true}
        playlistId={id.startsWith('playlist_') ? id : null}
        index={index}
        artist={FormatArtist(item?.artists?.primary || item?.primaryArtists)}
        language={item?.language}
        playlist={true}
        artistID={item?.primary_artists_id || item?.primaryArtistsId}
        key={index}
        duration={item?.duration}
        item={item}
        title={item?.name || item?.title}
        image={item?.image || item?.artwork}
        id={item?.id}
        url={item?.downloadUrl || item?.url || item?.encrypted_media_url}
      />
    )
  ), [Data, id]);

  const onEndReached = () => {
    if (!Data?.data?.songs) {return;}
    if (isFetchingMore || isResolvingInitial) {return;}
    if (!isFullListLoaded) {return;} // wait for background full list
    const nextIndex = Data.data.songs.findIndex(s => !s.hasStreaming);
    if (nextIndex !== -1) {
      fetchStreamingUrlsForRange(nextIndex);
    }
  };

  const PlaylistFooter = useMemo(() => {
    return (isFetchingMore && !isResolvingInitial) ? (
      <View style={{paddingVertical: 12}}><ActivityIndicator size="small" color="#1DB954" /></View>
    ) : null;
  }, [isFetchingMore, isResolvingInitial]);

  const PlaylistEmpty = useMemo(() => (
    <View style={{flex:1, justifyContent: 'center', alignItems: 'center', paddingVertical: 30}}>
      <PlainText text={'Playlist not available'} />
      <SmallText text={'not available'} />
    </View>
  ), []);

  // Show skeleton top if completely empty while loading
  if (Loading && (!Data?.data || !Data?.data.songs || Data.data.songs.length === 0)) {
    return (
      <MainWrapper>
        <View style={{paddingHorizontal: 10, paddingTop: 20}}>
          <PlaylistTopHeader url={headerImageUrl} />
          <PlaylistDetails
            id={id}
            image={image}
            name={name}
            follower={follower}
            listener={follower ?? ''}
            releasedDate={''}
            Data={Data}
            Loading={Loading}
          />
          {Array.from({length: pageSize}).map((_, i) => (
            <SkeletonSong key={`skeleton-${i}`} />
          ))}
        </View>
      </MainWrapper>
    );
  }

// Helper to fetch streaming urls for a range (moved above to follow hook rules)

  return (
    <MainWrapper>
      <FlatList
        data={displayData}
        keyExtractor={(item, idx) => item?.id || item?.__placeholder ? item?.key || `song-${idx}` : `song-${idx}`}
        ListHeaderComponent={ListHeader}
        renderItem={renderSongItem}

        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
        ListFooterComponent={PlaylistFooter}
        contentContainerStyle={{paddingBottom: activeTrack ? 105 : 70, backgroundColor: '#101010', paddingHorizontal: 10}}
        ListEmptyComponent={PlaylistEmpty}
      />
    </MainWrapper>
  );
};
