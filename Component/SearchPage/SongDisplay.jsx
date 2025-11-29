/* eslint-disable keyword-spacing */
import React, { useState } from 'react'
import { Dimensions, FlatList, View, TouchableOpacity, Text } from 'react-native'
import { EachSongCard } from '../Global/EachSongCard'
import { getSearchSongData } from '../../Api/Songs'
import { LoadingComponent } from '../Global/Loading'
import { PlainText } from '../Global/PlainText'
import { SmallText } from '../Global/SmallText'

export default function SongDisplay({data, limit, Searchtext, loadMore, hasMore}) {
  const Data = data
  const width = Dimensions.get("window").width

  function FormatArtist(data){
    let artist = ""
    data?.map((e,i)=>{
      if(i === data.length - 1){
        artist += e.name
      }else{
        artist += e.name + ", "
      }
    })
    return artist
  }

  const renderSongItem = (item) => {
    const song = item.item;
    const isSaavn = song?.artists?.primary; // Saavn has artists.primary array
    const title = isSaavn ? song?.name : song?.title;
    const artist = isSaavn ? FormatArtist(song?.artists?.primary) : song?.artist;
    const image = Array.isArray(song?.image) ? (song?.image[2]?.url || song?.image[1]?.url || song?.image[0]?.url || "") : (typeof song?.image === 'string' ? song?.image : "");
    const artistID = isSaavn ? song?.primaryArtistsId : song?.artistID;
    const url = isSaavn ? song?.downloadUrl : song?.url;
    return <EachSongCard  artistID={artistID} language={song?.language} duration={song?.duration} image={image} id={song?.id} width={width * 0.95} title={title} artist={artist} url={url} style={{
        marginBottom:13,
    }}/>
  }

  return (
     <View>
      {Data?.data?.results?.length !== 0 && <FlatList showsVerticalScrollIndicator={false} scrollEnabled={true} keyExtractor={(item, index) => `${item?.id}_${index}`} contentContainerStyle={{
        paddingBottom:300,
      }} data={Data?.data?.results ?? []} renderItem={renderSongItem}/>}
      {hasMore && (
        <TouchableOpacity onPress={loadMore} style={{
          alignSelf: 'center',
          padding: 10,
          backgroundColor: '#007bff',
          borderRadius: 5,
          marginTop: 10,
        }}>
          <Text style={{color: 'white', fontSize: 16}}>Load More</Text>
        </TouchableOpacity>
      )}
      {Data?.data?.results?.length === 0 && <View style={{
        height:400,
        alignItems:"center",
        justifyContent:"center",
      }}>
        <PlainText text={"No Song found!"}/>
        <SmallText text={"Opps!  T_T"}/>
        </View> }
     </View>
  )
}
