import React, {
  memo,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import {EachSongQueue} from './EachSongQueue';
import Context, {ActionsContext} from '../../Context/Context';
import {
  ActivityIndicator,
  View,
  InteractionManager,
} from 'react-native';
import {useActiveTrack, usePlaybackState} from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import {removeFromQueue} from '../../MusicPlayerFunctions';

export const QueueRenderSongs = memo(function QueueRenderSongs({Index}) {
  const {Queue} = useContext(Context);
  const {ensureMinimumQueue, updateTrack} = useContext(ActionsContext);
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const [displayedSongs, setDisplayedSongs] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const SONGS_PER_PAGE = 20; // Reduced from 50 to 20 for better progressive loading

  // Extract primitive values to prevent object reference changes causing re-renders
  const playerStateValue = playbackState?.state;
  const currentTrackId = activeTrack?.id;

  // PERFORMANCE FIX: Cache TrackPlayer queue to avoid repeated expensive bridge calls
  const trackPlayerQueueCache = useRef(null);
  const trackPlayerQueueCacheTime = useRef(0);
  const QUEUE_CACHE_TTL = 2000; // 2 second cache

  // Debounce reference to prevent excessive updates
  const lastQueueUpdateRef = useRef(0);
  const QUEUE_UPDATE_DEBOUNCE = 300; // 300ms debounce

  // Auto-fill queue when component mounts
  useEffect(() => {
    if (ensureMinimumQueue) {
      ensureMinimumQueue().catch(err => {
        console.warn(err);
      });
    }
  }, [ensureMinimumQueue]);

  // Handle song removal with optimized caching
  const handleRemove = useCallback(
    async (index, id) => {
      try {
        // Optimistic update: Remove from local display immediately for smooth animation
        setDisplayedSongs(prev => prev.filter(s => s.id !== id));

        // Schedule the heavy TrackPlayer/Context operations after the swipe animation
        InteractionManager.runAfterInteractions(async () => {
          try {
            // PERFORMANCE: Try cache first, fallback to fresh queue if needed
            const now = Date.now();
            let currentQueue;

            if (
              trackPlayerQueueCache.current &&
              now - trackPlayerQueueCacheTime.current < QUEUE_CACHE_TTL
            ) {
              currentQueue = trackPlayerQueueCache.current;
            } else {
              currentQueue = await TrackPlayer.getQueue();
              trackPlayerQueueCache.current = currentQueue;
              trackPlayerQueueCacheTime.current = now;
            }

            const actualIndex = currentQueue.findIndex(s => s.id === id);

            if (actualIndex !== -1) {
              await removeFromQueue(actualIndex);
              // Invalidate cache after modification
              trackPlayerQueueCache.current = null;
              // updateTrack will eventually sync the Context Queue
              await updateTrack();
            }
          } catch (e) {
            // Rollback if failed
            console.error('TrackPlayer removal failed:', e);
            updateTrack(); // Force sync from real queue
          }
        });
      } catch (error) {
        console.error('Error in handleRemove:', error);
      }
    },
    [updateTrack],
  );

  // Initialize and update displayed songs with debouncing and deferred loading
  useEffect(() => {
    // Debounce rapid queue updates
    const now = Date.now();
    if (now - lastQueueUpdateRef.current < QUEUE_UPDATE_DEBOUNCE) {
      return; // Ignore rapid fire updates
    }
    lastQueueUpdateRef.current = now;

    if (Queue && Queue.length > 0) {
      // PERFORMANCE: Defer queue state updates using InteractionManager
      // This ensures UI animations complete before processing queue changes
      InteractionManager.runAfterInteractions(() => {
        setDisplayedSongs(prev => {
          // If we already have songs, just update the existing items from the new Queue
          if (prev.length > 0) {
            const nextCount = Math.min(
              Queue.length,
              Math.max(prev.length, SONGS_PER_PAGE),
            );
            return Queue.slice(0, nextCount);
          }

          // First load: Load initial batch with current track visible
          const loadInitial = async () => {
            try {
              const trackIdx = (await TrackPlayer.getActiveTrackIndex()) || 0;
              // Load current track + 15 more for smooth initial render
              const initialCount = Math.min(
                Queue.length,
                Math.max(15, trackIdx + 10),
              );
              setDisplayedSongs(Queue.slice(0, initialCount));
            } catch (e) {
              // Fallback to smaller initial batch
              setDisplayedSongs(Queue.slice(0, 15));
            }
          };
          loadInitial();
          return prev;
        });
      });
    } else if (Queue && Queue.length === 0) {
      setDisplayedSongs([]);
    }
  }, [Queue]);

  // Load next batch of songs when user scrolls near the end (optimized batching)
  const loadMoreSongs = useCallback(() => {
    if (isLoadingMore || displayedSongs.length >= Queue.length) {
      return;
    }

    // PERFORMANCE: Defer loading to prevent blocking scroll
    InteractionManager.runAfterInteractions(() => {
      setIsLoadingMore(true);
      const startIndex = displayedSongs.length;
      const endIndex = Math.min(Queue.length, startIndex + SONGS_PER_PAGE);
      const newSongs = Queue.slice(startIndex, endIndex);

      if (newSongs.length > 0) {
        setDisplayedSongs(prev => [...prev, ...newSongs]);
      }
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, displayedSongs.length, Queue, SONGS_PER_PAGE]);

  const renderFooter = () => {
    if (!isLoadingMore) {
      return null;
    }
    return (
      <View style={{paddingVertical: 20, alignItems: 'center'}}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  };

  // CRITICAL: Memoize renderItem - pass song object directly from data array
  // Song objects from displayedSongs should be stable references
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

  // PERFORMANCE: Stable, unique keys even for duplicate IDs (use index)
  const keyExtractor = useCallback(
    (item, index) => `${item?.id || 'track'}-${index}`,
    [],
  );

  return (
    <BottomSheetFlatList
      contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 100}}
      data={displayedSongs}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      extraData={{playerStateValue, currentTrackId}}
      onEndReached={loadMoreSongs}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      removeClippedSubviews={true}
      initialNumToRender={8}
      maxToRenderPerBatch={4}
      windowSize={3}
      updateCellsBatchingPeriod={100}
      getItemLayout={(data, index) => ({
        length: 66,
        offset: 66 * index,
        index,
      })}
    />
  );
});
