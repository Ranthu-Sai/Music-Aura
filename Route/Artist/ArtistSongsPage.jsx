import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
  FlatList,
} from 'react-native';
import {ThemeContext} from '../../Context/Context';
import {MainWrapper} from '../../Layout/MainWrapper';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {Heading} from '../../Component/Global/Heading';
import {EachSongCard} from '../../Component/Global/EachSongCard';
import {getArtistSongList, getSongStreamingUrl} from '../../Api/Artists';
import {useActiveTrack} from 'react-native-track-player';
import {GetLanguageValue} from '../../LocalStorage/Languages';

const SkeletonSong = () => (
  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
    <View style={{width: 60, height: 60, borderRadius: 8, backgroundColor: '#2a2a2a', opacity: 0.6, marginRight: 10}} />
    <View style={{flex: 1}}>
      <View style={{height: 14, width: '70%', backgroundColor: '#2a2a2a', opacity: 0.6, borderRadius: 6, marginBottom: 6}} />
      <View style={{height: 12, width: '40%', backgroundColor: '#2a2a2a', opacity: 0.5, borderRadius: 6}} />
    </View>
  </View>
);

export const ArtistSongsPage = ({route}) => {
  const {artistId, artistName, artistImage} = route.params;
  const {currentThemeColors} = React.useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [artistData, setArtistData] = useState(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isResolvingInitial, setIsResolvingInitial] = useState(false);
  const [isFullListLoaded, setIsFullListLoaded] = useState(false);
  const pageSize = 10; // Number of songs to fetch/render initially per batch
  const activeTrack = useActiveTrack();

  const songs = useMemo(() => artistData?.songs || [], [artistData]);

  // Normalize songs for EachSongCard compatibility
  const normalizedSongs = useMemo(() => {
    return songs.map(song => ({
      id: song.id,
      title: song.song || song.title || song.name,
      artist: song.primary_artists || song.artist || song.subtitle,
      url: song.id, // Use song ID, the app will handle fetching stream URL
      downloadUrl: song.downloadUrl, // Array of quality URLs from streaming API
      artwork: song.image,
      image: song.image,
      duration: song.duration || 0,
      language: song.language || 'unknown',
      artistID: song.primary_artists_id || song.artistID,
      albumName: song.album,
      releaseDate: song.release_date || song.year,
      albumId: song.album_id || song.albumid,
      source: 'saavn',
      // Keep original fields for reference
      ...song,
    }));
  }, [songs]);

  const fetchArtistSongs = useCallback(async () => {
    try {
      setLoading(true);
      const language = await GetLanguageValue();

      // Fast initial fetch WITHOUT streaming URLs so UI can render immediately
      const initial = await getArtistSongList(artistId, pageSize, language, true);
      if (initial) {
        setArtistData(initial);
      } else {
        setArtistData({id: artistId, name: artistName, image: artistImage, songs: []});
      }

      // Start resolving streaming URLs for the initial batch in background (do not show bottom loader)
      fetchStreamingUrlsForRange(0, {isInitial: true});

      // Background: fetch the full list quickly WITHOUT resolving streaming URLs and merge
      (async () => {
        try {
          const full = await getArtistSongList(artistId, 200, language, true);
          if (full && full.songs && Array.isArray(full.songs)) {
            const existingIds = new Set((initial?.songs || []).map(s => s.id));
            const merged = [
              ...(initial?.songs || []),
              ...full.songs.filter(s => !existingIds.has(s.id)),
            ];
            setArtistData(prev => ({
              ...prev,
              songs: merged,
              name: full.name || prev?.name,
              image: full.image || prev?.image,
              followerCount: full.followerCount || prev?.followerCount,
            }));
          }
        } catch (e) {
          console.warn('Background fetch for full artist list failed', e);
        } finally {
          // Mark that the full list attempt finished (success or failure)
          setIsFullListLoaded(true);
        }
      })();
    } catch (error) {
      console.error('Failed to fetch artist songs:', error);
      setArtistData({id: artistId, name: artistName, image: artistImage, songs: []});
    } finally {
      // Hide the big loading indicator — we now show skeleton rows in the list instead
      setLoading(false);
    }
  }, [artistId, artistName, artistImage, fetchStreamingUrlsForRange]);

  // Fetch streaming URLs for a batch range (used by onEndReached)
  const fetchStreamingUrlsForRange = useCallback(async (startIndex, opts = {isInitial: false, prefetch: false}) => {
    if (!artistData?.songs) {return;}

    // Respect flags: prefetch doesn't flip visible loading flags to avoid footers
    if (!opts.prefetch) {
      if (!opts.isInitial && isFetchingMore) {return;}
      if (opts.isInitial && isResolvingInitial) {return;}

      if (opts.isInitial) {
        setIsResolvingInitial(true);
      } else {
        setIsFetchingMore(true);
      }
    } else {
      // If prefetching and already fetching, skip
      if (isFetchingMore || isResolvingInitial) {return;}
    }

    try {
      const batchSongs = artistData.songs;
      const batch = batchSongs.slice(startIndex, startIndex + pageSize);

      // Nothing to do if batch is empty
      if (!batch || batch.length === 0) {
        return;
      }

      // Skip if all items already have streaming or are currently being resolved
      if (batch.every(s => (s.downloadUrl && s.hasStreaming) || s.resolvingStreaming)) {
        return;
      }

      // Mark items in this batch as resolving to avoid duplicate simultaneous requests
      setArtistData(prev => {
        if (!prev || !prev.songs) {return prev;}
        const newSongs = [...prev.songs];
        for (let i = 0; i < batch.length; i++) {
          const idx = startIndex + i;
          newSongs[idx] = {...newSongs[idx], resolvingStreaming: true};
        }
        return {...prev, songs: newSongs};
      });

      const updated = await Promise.all(batch.map(async (s) => {
        // If another process already fetched it, keep it
        if (s.downloadUrl && s.hasStreaming) {return {...s, resolvingStreaming: false};}
        try {
          const urls = await getSongStreamingUrl(s.id);
          return {
            ...s,
            downloadUrl: urls || s.encrypted_media_url,
            hasStreaming: !!urls,
            resolvingStreaming: false,
          };
        } catch (e) {
          // ensure we clear resolving flag even on error
          return {...s, resolvingStreaming: false};
        }
      }));

      // Merge back into artistData.songs
      setArtistData(prev => {
        if (!prev || !prev.songs) {return prev;}
        const newSongs = [...prev.songs];
        for (let i = 0; i < updated.length; i++) {
          newSongs[startIndex + i] = updated[i];
        }
        return {...prev, songs: newSongs};
      });

      // If this was the initial resolve, kick off a quiet prefetch of the next batch to reduce scroll lag
      if (opts.isInitial && !opts.prefetch) {
        // Do not await
        setTimeout(() => {
          fetchStreamingUrlsForRange(startIndex + pageSize, {prefetch: true});
        }, 200);
      }
    } catch (err) {
      console.warn('Failed to fetch streaming urls for batch', err);
    } finally {
      if (!opts.prefetch) {
        if (opts.isInitial) {
          setIsResolvingInitial(false);
        } else {
          setIsFetchingMore(false);
        }
      }
    }
  }, [artistData, isFetchingMore, isResolvingInitial]);

  useEffect(() => {
    fetchArtistSongs();
  }, [fetchArtistSongs]);

  // Handler for when the user scrolls near the end - fetch next batch of streaming URLs
  const onEndReached = useCallback(() => {
    if (!artistData?.songs) {return;}
    if (isFetchingMore || isResolvingInitial) {return;} // avoid concurrent or initial resolving

    const currentCount = artistData.songs.length;
    const nextIndex = artistData.songs.findIndex(s => !s.hasStreaming);

    // If we haven't loaded the full list yet, wait for background merge first
    if (nextIndex === -1 && !isFullListLoaded) {
      return;
    }

    if (nextIndex !== -1 && nextIndex < currentCount) {
      fetchStreamingUrlsForRange(nextIndex);
    }
  }, [artistData, fetchStreamingUrlsForRange, isFetchingMore, isResolvingInitial, isFullListLoaded]);

  const formatFollowers = count => {
    if (!count) {
      return '';
    }
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M followers`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K followers`;
    }
    return `${count} followers`;
  };

  // Use FlatList as the primary scroll container to avoid nested VirtualizedList issues


  // Ensure we always render at least `pageSize` rows by padding with skeletons if needed
  const displayData = useMemo(() => {
    const real = normalizedSongs;
    // Only show placeholder skeleton rows while the initial loading/resolving is in progress.
    // When loading is finished and there are no real songs, return an empty array so the
    // ListEmptyComponent is rendered instead of persistent skeletons.
    if (loading && real.length < pageSize) {
      const pads = Array.from({length: Math.max(0, pageSize - real.length)}).map((_, i) => ({__placeholder: true, key: `pad-${i}`}));
      return [...real, ...pads];
    }
    return real;
  }, [normalizedSongs, pageSize, loading]);



  const HeaderComponent = useMemo(() => {
    return (
      <>
        <View style={[styles.header, {backgroundColor: currentThemeColors.secondaryBackground}]}>
          <Image source={{uri: artistImage || artistData?.image}} style={styles.artistImage} resizeMode="cover" />
          <Text style={[styles.artistName, {color: currentThemeColors.text}]}> {artistName || artistData?.name} </Text>
          {artistData?.followerCount && (
            <Text style={[styles.followers, {color: currentThemeColors.secondaryText}]}> {formatFollowers(artistData.followerCount)} </Text>
          )}
        </View>
        <PaddingConatiner>
          <Heading text={`Top Songs (${normalizedSongs.length})`} />
        </PaddingConatiner>
      </>
    );
  }, [currentThemeColors, artistImage, artistData, artistName, normalizedSongs.length]);

  const renderSongItem = useCallback(({item, index}) => (
    item && item.__placeholder ? (
      <SkeletonSong />
    ) : (
      <EachSongCard
        key={item.id || `song-${index}`}
        id={item.id}
        title={item.title}
        artist={item.artist}
        image={item.image}
        url={item.downloadUrl || item.url}
        duration={item.duration}
        language={item.language}
        artistID={item.artistID}
        albumName={item.albumName}
        releaseDate={item.releaseDate}
        albumId={item.albumId}
        source="saavn"
        Data={normalizedSongs}
        index={index}
      />
    )
  ), [normalizedSongs]);

  const ListFooter = useMemo(() => {
    return (isFetchingMore && !isResolvingInitial) ? (
      <View style={{paddingVertical: 12}}>
        <ActivityIndicator size="small" color={currentThemeColors.primary} />
      </View>
    ) : null;
  }, [isFetchingMore, isResolvingInitial, currentThemeColors]);

  const ListEmpty = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, {color: currentThemeColors.secondaryText}]}>No songs found for the selected language</Text>
    </View>
  ), [currentThemeColors]);

  if (loading && (!artistData || !artistData.songs || artistData.songs.length === 0)) {
    // Show skeleton list immediately if we have no data yet
    return (
      <MainWrapper>
        <View style={{paddingHorizontal: 10, paddingTop: 20}}>
          {Array.from({length: pageSize}).map((_, i) => (
            <SkeletonSong key={`skeleton-${i}`} />
          ))}
        </View>
      </MainWrapper>
    );
  }

  // duplicate HeaderComponent removed (defined earlier)
  //






  return (
    <MainWrapper>
      <FlatList
        data={displayData}
        keyExtractor={(item, idx) => item?.id || item?.__placeholder ? item?.key || `song-${idx}` : `song-${idx}`}
        renderItem={renderSongItem}
        ListHeaderComponent={HeaderComponent}
        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
        ListFooterComponent={ListFooter}
        contentContainerStyle={{
          paddingBottom: activeTrack ? 105 : 70,
          paddingHorizontal: 10,
        }}
        ListEmptyComponent={ListEmpty}
      />
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  artistImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 16,
  },
  artistName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  followers: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
