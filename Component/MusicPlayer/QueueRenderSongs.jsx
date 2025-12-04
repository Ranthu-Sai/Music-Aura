import React, { memo, useContext, useEffect, useState } from "react";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { EachSongQueue } from "./EachSongQueue";
import { GetQueueSongs } from "../../LocalStorage/storeQueue";
import Context from "../../Context/Context";
import { ActivityIndicator, View } from "react-native";

export const QueueRenderSongs = memo(function QueueRenderSongs({Index}) {
  const { Queue, ensureMinimumQueue } = useContext(Context)
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

  // Initialize with first 50 songs
  useEffect(() => {
    if (Queue && Queue.length > 0) {
      const initial = Queue.slice(0, SONGS_PER_PAGE)
      setDisplayedSongs(initial)
      setPage(1)
    }
  }, [Queue])

  // Load next 50 songs when user scrolls near the end
  const loadMoreSongs = () => {
    if (isLoadingMore || displayedSongs.length >= Queue.length) {
      return
    }

    setIsLoadingMore(true)
    const nextPage = page + 1
    const startIndex = page * SONGS_PER_PAGE
    const endIndex = startIndex + SONGS_PER_PAGE
    const newSongs = Queue.slice(startIndex, endIndex)

    if (newSongs.length > 0) {
      setDisplayedSongs(prev => [...prev, ...newSongs])
      setPage(nextPage)
    }
    setIsLoadingMore(false)
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
    renderItem={(item)=><EachSongQueue title={item.item.title}  artist={item.item.artist} id={item.item.id} index={item.index} image={item.item.artwork}/>}
    onEndReached={loadMoreSongs}
    onEndReachedThreshold={0.5}
    ListFooterComponent={renderFooter}
  />
})


