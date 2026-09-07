import React, {
  memo,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {EachSongQueue} from './EachSongQueue';
import Context, {ActionsContext} from '../../Context/Context';
import {
  ActivityIndicator,
  View,
  InteractionManager,
  FlatList,
} from 'react-native';
import {useActiveTrack, usePlaybackState} from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import {removeFromQueue} from '../../MusicPlayerFunctions';

// Strict deduplication helper by ID and normalized title+artist
const getCleanUniqueQueue = songs => {
  if (!Array.isArray(songs)) {
    return [];
  }
  const seenIds = new Set();
  const seenSignatures = new Set();
  const clean = [];

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    if (!song) {
      continue;
    }

    const id = song.id ? String(song.id).trim() : null;
    const title = (song.title || song.name || '').trim().toLowerCase();
    const artist = (song.artist || '').trim().toLowerCase();
    const sig = title && artist ? `${title}|${artist}` : id || `index-${i}`;

    if (id && seenIds.has(id)) {
      continue;
    }
    if (sig && seenSignatures.has(sig)) {
      continue;
    }

    if (id) {
      seenIds.add(id);
    }
    if (sig) {
      seenSignatures.add(sig);
    }

    clean.push({
      ...song,
      _originalIndex: i,
    });
  }
  return clean;
};

export const QueueRenderSongs = memo(function QueueRenderSongs({
  Index,
  refreshSignal = 0,
}) {
  const {Queue} = useContext(Context);
  const {ensureMinimumQueue, updateTrack, AddRecommendedSongs} =
    useContext(ActionsContext);
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const [displayedSongs, setDisplayedSongs] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const flatListRef = useRef(null);
  const hasInitialScrolledRef = useRef(false);

  const playerStateValue = playbackState?.state;
  const currentTrackId = activeTrack?.id;

  const trackPlayerQueueCache = useRef(null);
  const trackPlayerQueueCacheTime = useRef(0);
  const QUEUE_CACHE_TTL = 2000;

  const lastQueueUpdateRef = useRef(0);
  const QUEUE_UPDATE_DEBOUNCE = 300;
  const fallbackHydrationInProgressRef = useRef(false);

  // Helper to safely scroll to the currently active track
  const scrollToActiveTrack = useCallback(
    (songs, animated = true) => {
      if (!Array.isArray(songs) || songs.length === 0 || !currentTrackId) {
        return;
      }
      const activeIdx = songs.findIndex(s => s.id === currentTrackId);
      if (activeIdx >= 0 && flatListRef.current) {
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index: Math.max(0, activeIdx),
              animated,
              viewPosition: 0.12, // Keep active track near top with upcoming songs below
            });
          } catch (_) {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, activeIdx * 66),
              animated,
            });
          }
        }, 120);
      }
    },
    [currentTrackId],
  );

  // Auto-fill queue when component mounts
  useEffect(() => {
    if (ensureMinimumQueue) {
      ensureMinimumQueue().catch(() => {});
    }
  }, [ensureMinimumQueue]);

  // Handle Manual Refresh: refresh recommendations from CURRENT song and scroll to it
  useEffect(() => {
    if (!refreshSignal) {
      return;
    }

    let cancelled = false;

    const forceRefreshQueue = async () => {
      try {
        trackPlayerQueueCache.current = null;
        trackPlayerQueueCacheTime.current = 0;

        const currentActive = await TrackPlayer.getActiveTrack();
        const activeIdx = await TrackPlayer.getActiveTrackIndex();

        // 1. Fetch recommendations based on the CURRENT active song (not track 0!)
        if (currentActive?.id && AddRecommendedSongs) {
          await AddRecommendedSongs(
            typeof activeIdx === 'number' ? activeIdx : 0,
            currentActive.id,
            true,
          );
        } else if (ensureMinimumQueue) {
          await ensureMinimumQueue();
        }

        if (updateTrack) {
          await updateTrack();
        }

        const freshTracks = await TrackPlayer.getQueue();
        if (!cancelled && Array.isArray(freshTracks) && freshTracks.length > 0) {
          const cleanQueue = getCleanUniqueQueue(freshTracks);
          setDisplayedSongs(cleanQueue);

          // 2. Scroll immediately to the current playing song place!
          scrollToActiveTrack(cleanQueue, true);
        }
      } catch (error) {
        console.warn('Queue manual refresh failed:', error?.message || error);
      }
    };

    forceRefreshQueue();

    return () => {
      cancelled = true;
    };
  }, [refreshSignal, ensureMinimumQueue, updateTrack, AddRecommendedSongs, scrollToActiveTrack]);

  // Fallback hydration if context queue is temporarily empty on cold start
  useEffect(() => {
    let cancelled = false;

    const hydrateFromTrackPlayer = async () => {
      if (fallbackHydrationInProgressRef.current) {
        return;
      }

      if (Array.isArray(Queue) && Queue.length > 0) {
        return;
      }

      fallbackHydrationInProgressRef.current = true;
      try {
        let resolvedQueue = [];

        for (let attempt = 0; attempt < 4; attempt++) {
          const tracks = await TrackPlayer.getQueue();
          if (Array.isArray(tracks) && tracks.length > 0) {
            resolvedQueue = tracks;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 120));
        }

        if (!cancelled && resolvedQueue.length > 0) {
          const cleanQueue = getCleanUniqueQueue(resolvedQueue);
          setDisplayedSongs(cleanQueue);
          updateTrack?.();
          scrollToActiveTrack(cleanQueue, false);
        }
      } catch (error) {
        console.warn('Queue fallback hydration failed:', error?.message || error);
      } finally {
        fallbackHydrationInProgressRef.current = false;
      }
    };

    hydrateFromTrackPlayer();

    return () => {
      cancelled = true;
    };
  }, [Queue, updateTrack, scrollToActiveTrack]);

  // Handle song removal
  const handleRemove = useCallback(
    async (index, id) => {
      try {
        setDisplayedSongs(prev => prev.filter(s => s.id !== id));

        InteractionManager.runAfterInteractions(async () => {
          try {
            const currentQueue = await TrackPlayer.getQueue();
            const actualIndex = currentQueue.findIndex(s => s.id === id);

            if (actualIndex !== -1) {
              await removeFromQueue(actualIndex);
              trackPlayerQueueCache.current = null;
              await updateTrack();
            }
          } catch (e) {
            console.error('TrackPlayer removal failed:', e);
            updateTrack();
          }
        });
      } catch (error) {
        console.error('Error in handleRemove:', error);
      }
    },
    [updateTrack],
  );

  // Sync displayed songs from Context Queue with strict deduplication
  useEffect(() => {
    const now = Date.now();
    if (now - lastQueueUpdateRef.current < QUEUE_UPDATE_DEBOUNCE) {
      return;
    }
    lastQueueUpdateRef.current = now;

    if (Queue && Queue.length > 0) {
      InteractionManager.runAfterInteractions(() => {
        const cleanQueue = getCleanUniqueQueue(Queue);
        setDisplayedSongs(cleanQueue);

        // Auto-scroll on initial load to current playing song
        if (!hasInitialScrolledRef.current && currentTrackId) {
          hasInitialScrolledRef.current = true;
          scrollToActiveTrack(cleanQueue, false);
        }
      });
    } else if (Queue && Queue.length === 0) {
      setDisplayedSongs([]);
    }
  }, [Queue, currentTrackId, scrollToActiveTrack]);

  // Load next batch when scrolling near end
  const loadMoreSongs = useCallback(() => {
    if (isLoadingMore) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      setIsLoadingMore(true);

      const appendNextBatch = async () => {
        try {
          let sourceQueue = Array.isArray(Queue) ? Queue : [];

          if (sourceQueue.length <= displayedSongs.length) {
            const now = Date.now();
            if (
              trackPlayerQueueCache.current &&
              now - trackPlayerQueueCacheTime.current < QUEUE_CACHE_TTL
            ) {
              sourceQueue = trackPlayerQueueCache.current;
            } else {
              const tracks = await TrackPlayer.getQueue();
              if (Array.isArray(tracks) && tracks.length > 0) {
                sourceQueue = tracks;
                trackPlayerQueueCache.current = tracks;
                trackPlayerQueueCacheTime.current = now;
              }
            }
          }

          const cleanSource = getCleanUniqueQueue(sourceQueue);
          if (cleanSource.length > displayedSongs.length) {
            setDisplayedSongs(cleanSource);
          }
        } catch (error) {
          console.warn('Queue load-more failed:', error?.message || error);
        } finally {
          setIsLoadingMore(false);
        }
      };

      appendNextBatch();
    });
  }, [isLoadingMore, displayedSongs.length, Queue]);

  const renderFooter = () => {
    if (!isLoadingMore) {
      return null;
    }
    return (
      <View style={{paddingVertical: 20, alignItems: 'center'}}>
        <ActivityIndicator size="small" color="#1DB954" />
      </View>
    );
  };

  const renderItem = useCallback(
    ({item, index}) => {
      if (!item) {
        return null;
      }
      return (
        <EachSongQueue
          song={item}
          index={index}
          playerState={playerStateValue}
          currentTrackId={currentTrackId}
          onRemove={handleRemove}
        />
      );
    },
    [playerStateValue, currentTrackId, handleRemove],
  );

  const keyExtractor = useCallback(
    (item, index) => `${item?.id || 'track'}-${item?._originalIndex ?? index}`,
    [],
  );

  return (
    <FlatList
      ref={flatListRef}
      contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 100}}
      data={displayedSongs}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      extraData={{playerStateValue, currentTrackId}}
      onEndReached={loadMoreSongs}
      onEndReachedThreshold={0.6}
      ListFooterComponent={renderFooter}
      removeClippedSubviews={true}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      getItemLayout={(data, index) => ({
        length: 66,
        offset: 66 * index,
        index,
      })}
      onScrollToIndexFailed={info => {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: info.index * 66,
            animated: true,
          });
        }, 100);
      }}
    />
  );
});
