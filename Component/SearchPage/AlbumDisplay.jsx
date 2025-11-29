/* eslint-disable keyword-spacing */
import React, { useState } from 'react'
import { Dimensions, FlatList, ScrollView, View } from 'react-native'
import { LoadingComponent } from '../Global/Loading'
import { PlainText } from '../Global/PlainText'
import { SmallText } from '../Global/SmallText'
import { EachAlbumCard } from '../Global/EachAlbumCard'
import { getSearchAlbumData } from '../../Api/Album'

export default function AlbumsDisplay({data, limit, Searchtext}) {
  const Data = data
  function FormatArtist(data){
    let artist = ""
    data?.map((e,i)=>{
      if (i === data.length - 1){
        artist += e.name
      } else {
        artist += e.name + ", "
      }
    })
    return artist
  }
  const width = Dimensions.get("window").width
  const itemWidth = (width - 40) / 2; // 20 padding on sides, 20 gap between
  return (
     <>
      {Data?.data?.results?.length !== 0 && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{
        paddingBottom: 300,
      }}>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}>
          {(Data?.data?.results ?? []).map((album, index) => {
            const isSaavn = album?.artists?.primary; // Saavn has artists.primary array
            const name = isSaavn ? album?.name : album?.title;
            const artists = isSaavn ? FormatArtist(album?.artists?.primary) : album?.artist;
            const image = Array.isArray(album?.image) ? (album?.image[2]?.url || album?.image[1]?.url || album?.image[0]?.url || "") : (typeof album?.image === 'string' ? album?.image : "");
            return <EachAlbumCard key={`${album?.id}_${index}`} Search={true} mainContainerStyle={{width: itemWidth, marginBottom: 15}} image={image} artists={artists} name={name ?? ""} id={album?.id ?? ""}/>
          })}
        </View>
      </ScrollView>}
      {Data?.data?.results?.length === 0 && <View style={{
        height:400,
        alignItems:"center",
        justifyContent:"center",
      }}>
        <PlainText text={"No Album found!"}/>
        <SmallText text={"Opps!  T_T"}/>
        </View> }
     </>
  )
}
