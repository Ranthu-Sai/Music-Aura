/* eslint-disable keyword-spacing */
import React, { useState } from 'react'
import { Dimensions, FlatList, View } from 'react-native'
import { LoadingComponent } from '../Global/Loading'
import { EachPlaylistCard } from '../Global/EachPlaylistCard'
import { PlainText } from '../Global/PlainText'
import { SmallText } from '../Global/SmallText'
import { getSearchPlaylistData } from '../../Api/Playlist'

export default function PlaylistDisplay({data, limit, Searchtext}) {
  const Data = data

  const width = Dimensions.get("window").width
  return (
     <>
      {Data?.data?.results?.length !== 0 && <FlatList showsVerticalScrollIndicator={false} numColumns={2} scrollEnabled={false} keyExtractor={(item, index) => `${item?.id}_${index}`} contentContainerStyle={{
         paddingBottom:220,
        alignItems:"flex-start",
      }} data={Data?.data?.results ?? []} renderItem={(item)=>{
            const playlist = item.item;
            const isSaavn = playlist?.songCount; // Saavn has songCount
            const name = isSaavn ? playlist.name : playlist.title;
            const follower = isSaavn ? "Total " + playlist.songCount + " Songs" : playlist.artist || "Playlist";
            const image = Array.isArray(playlist?.image) ? (playlist?.image[2]?.link || playlist?.image[1]?.link || playlist?.image[0]?.link || "") : (typeof playlist?.image === 'string' ? playlist?.image : "");
            return <EachPlaylistCard
            name={name}
            follower={follower}
            image={image}
            id={playlist.id}
            MainContainerStyle = {{
                width:width * 0.45,
                marginHorizontal:10,
            }}
            ImageStyle={{
                height:"70%",
            }}
            />
      }}/>}
      {Data?.data?.results?.length === 0 && <View style={{
        height:400,
        alignItems:"center",
        justifyContent:"center",
      }}>
        <PlainText text={"No Playlist found!"}/>
        <SmallText text={"Opps!  T_T"}/>
        </View> }
     </>
  )
}
