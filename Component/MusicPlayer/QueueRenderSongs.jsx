import React, { memo, useContext, useEffect, useState } from "react";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { EachSongQueue } from "./EachSongQueue";
import { GetQueueSongs } from "../../LocalStorage/storeQueue";
import Context from "../../Context/Context";

export const QueueRenderSongs = memo(function QueueRenderSongs({Index}) {
  // const  Queue } = useContext(Context)
  const { Queue } = useContext(Context)
  return <BottomSheetFlatList
    contentContainerStyle={{paddingHorizontal:20, paddingBottom:100, paddingRight:60}}
    data={Queue}
    keyExtractor={(item, index) => `${item?.id?.toString()}-${index}`}
    renderItem={(item)=><EachSongQueue title={item.item.title}  artist={item.item.artist} id={item.item.id} index={item.index} image={item.item.artwork}/>}
  />
})
