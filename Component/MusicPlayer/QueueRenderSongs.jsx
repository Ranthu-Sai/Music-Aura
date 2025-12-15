import React, { memo, useContext, useEffect, useState } from "react";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { EachSongQueue } from "./EachSongQueue";
import { GetQueueSongs } from "../../LocalStorage/storeQueue";
import Context from "../../Context/Context";
import { ActivityIndicator, View } from "react-native";

export const QueueRenderSongs = memo(function QueueRenderSongs({Index}) {
  const { Queue, ensureMinimumQueue, Index: currentIndex } = useContext(Context)
  const [displayedSongs, setDisplayedSongs] = useState([])
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const SONGS_PER_PAGE = 50

  // Auto-fill queue when component mounts
  useEffect(() => {
    if (ensureMinimumQueue) {
      ensureMinimumQueue().catch(err => {
        // Error silently handled
      });
    }
  }, [ensureMinimumQueue]);

  // Initialize with songs including current playing position
  useEffect(() => {
    if (Queue && Queue.length > 0) {
      // Ensure current playing song is visible by loading enough songs
      const currentPlayingIndex = currentIndex || 0;
      const minSongsToShow = Math.max(SONGS_PER_PAGE, currentPlayingIndex + 10); // Show at least current + 10 more
      const songsToShow = Math.min(Queue.length, minSongsToShow);
      
      const initial = Queue.slice(0, songsToShow);
      setDisplayedSongs(initial);
      setPage(Math.ceil(songsToShow / SONGS_PER_PAGE));
    }
  }, [Queue, currentIndex]);

  // Load next 50 songs when user scrolls near the end
  const loadMoreSongs = () => {
    if (isLoadingMore || displayedSongs.length >= Queue.length) {
      return
    }

    setIsLoadingMore(true)
    const startIndex = displayedSongs.length;
    const endIndex = Math.min(Queue.length, startIndex + SONGS_PER_PAGE);
    const newSongs = Queue.slice(startIndex, endIndex);

    if (newSongs.length > 0) {
      setDisplayedSongs(prev => [...prev, ...newSongs]);
      setPage(prev => prev + 1);
    }
    setIsLoadingMore(false);
  }

  const renderFooter = () => {
    if (!isLoadingMore) {return null;}
    return (
      <View style={{paddingVertical: 20, alignItems: 'center'}}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    )
  }

  return <BottomSheetFlatList
    contentContainerStyle={{paddingHorizontal:20, paddingBottom:100, paddingRight:60}}
    data={displayedSongs}
    keyExtractor={(item, index) => `${item?.id?.toString()}-${index}`}
    renderItem={(item)=>{
      return <EachSongQueue title={item.item.title} artist={item.item.artist} id={item.item.id} index={item.index} image={item.item.artwork}/>
    }}
    onEndReached={loadMoreSongs}
    onEndReachedThreshold={0.5}
    ListFooterComponent={renderFooter}
  />
})


