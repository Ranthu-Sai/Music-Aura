import React, { memo, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { EachSongQueue } from "./EachSongQueue";
import { GetQueueSongs } from "../../LocalStorage/storeQueue";
import Context, { ActionsContext } from "../../Context/Context";
import { ActivityIndicator, View, ToastAndroid, InteractionManager } from "react-native";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";
import TrackPlayer from "react-native-track-player";
import { removeFromQueue } from "../../MusicPlayerFunctions";

export const QueueRenderSongs = memo(function QueueRenderSongs({ Index }) {
  const { Queue } = useContext(Context)
  const { ensureMinimumQueue, updateTrack } = useContext(ActionsContext)
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const [displayedSongs, setDisplayedSongs] = useState([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const SONGS_PER_PAGE = 50

  const activeTrackId = activeTrack?.id;
  const isPlaying = playbackState.state === "playing";

  // Auto-fill queue when component mounts
  useEffect(() => {
    if (ensureMinimumQueue) {
      ensureMinimumQueue().catch(err => {
        // Error silently handled
      });
    }
  }, [ensureMinimumQueue]);

  // Handle song removal
  const handleRemove = useCallback(async (index, id) => {
    try {
      // Optimistic update: Remove from local display immediately for smooth animation
      setDisplayedSongs(prev => prev.filter(s => s.id !== id));
      
      // Schedule the heavy TrackPlayer/Context operations after the swipe animation
      InteractionManager.runAfterInteractions(async () => {
        try {
          const currentQueue = await TrackPlayer.getQueue();
          const actualIndex = currentQueue.findIndex(s => s.id === id);
          
          if (actualIndex !== -1) {
            await removeFromQueue(actualIndex);
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
  }, [updateTrack]);

  // Initialize and update displayed songs
  useEffect(() => {
    if (Queue && Queue.length > 0) {
      setDisplayedSongs(prev => {
        // If we already have songs, just update the existing items from the new Queue
        if (prev.length > 0) {
          const nextCount = Math.min(Queue.length, Math.max(prev.length, SONGS_PER_PAGE));
          return Queue.slice(0, nextCount);
        }
        
        // First load: Load enough to see current track plus some buffer
        const loadInitial = async () => {
           try {
             const trackIdx = await TrackPlayer.getActiveTrackIndex() || 0;
             const initialCount = Math.min(Queue.length, Math.max(SONGS_PER_PAGE, trackIdx + 10));
             setDisplayedSongs(Queue.slice(0, initialCount));
           } catch (e) {
             setDisplayedSongs(Queue.slice(0, SONGS_PER_PAGE));
           }
        };
        loadInitial();
        return prev;
      });
    } else if (Queue && Queue.length === 0) {
      setDisplayedSongs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Queue]);

  // Load next 50 songs when user scrolls near the end
  const loadMoreSongs = useCallback(() => {
    if (isLoadingMore || displayedSongs.length >= Queue.length) {
      return
    }
    
    setIsLoadingMore(true)
    const startIndex = displayedSongs.length;
    const endIndex = Math.min(Queue.length, startIndex + SONGS_PER_PAGE);
    const newSongs = Queue.slice(startIndex, endIndex);

    if (newSongs.length > 0) {
      setDisplayedSongs(prev => [...prev, ...newSongs]);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, displayedSongs.length, Queue]);

  const renderFooter = () => {
    if (!isLoadingMore) { return null; }
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    )
  }

  const renderItem = useCallback(({ item, index }) => {
    const song = item || {};
    // Normalize artwork field from various possible properties
    const image = song.artwork || song.image || song.thumbnail || (song.thumbnail && song.thumbnail.url) || song.thumbnails || song.artwork?.url || song.image?.url || song.bestThumbnail || null;
    return (
      <EachSongQueue 
        index={index} 
        song={{ ...song, image }} 
        isActive={song.id === activeTrackId}
        isPlaying={isPlaying && song.id === activeTrackId}
        onRemove={handleRemove}
      />
    );
  }, [activeTrackId, isPlaying, handleRemove]);

  return <BottomSheetFlatList
    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
    data={displayedSongs}
    keyExtractor={(item, index) => {
      const id = item?.id || item?.item?.id || item?.item?.title || `idx_${index}`;
      return `${id.toString()}-${index}`;
    }}
    renderItem={renderItem}
    onEndReached={loadMoreSongs}
    onEndReachedThreshold={0.5}
    ListFooterComponent={renderFooter}
    removeClippedSubviews={true}
    initialNumToRender={10}
    maxToRenderPerBatch={10}
    windowSize={5}
  />
})


