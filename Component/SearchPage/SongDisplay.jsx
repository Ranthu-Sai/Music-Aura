/* eslint-disable keyword-spacing */
import React, { useState, useRef, useEffect } from 'react'
import { Dimensions, FlatList, View, TouchableOpacity, Text, Animated, ActivityIndicator } from 'react-native'
import { EachSongCard } from '../Global/EachSongCard'
import { getSearchSongData } from '../../Api/Songs'
import { LoadingComponent } from '../Global/Loading'
import { PlainText } from '../Global/PlainText'
import { SmallText } from '../Global/SmallText'

export default function SongDisplay({ data, limit, Searchtext, loadMore, hasMore, loadingMore }) {
  const Data = data
  const width = Dimensions.get("window").width
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [Data, fadeAnim]);

  function FormatArtist(data) {
    let artist = ""
    data?.map((e, i) => {
      if (i === data.length - 1) {
        artist += e.name
      } else {
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

    // Debug logging for YouTube Music songs
    if (song?.source === 'ytmusic') {
    }

    return <EachSongCard artistID={artistID} language={song?.language} duration={song?.duration} image={image} id={song?.id} width={width * 0.95} title={title} artist={artist} url={url} style={{
      marginBottom: 13,
    }} />
  }

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {Data?.data?.results?.length !== 0 && <FlatList
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        keyExtractor={(item, index) => `${item?.id}_${index}`}
        contentContainerStyle={{
          paddingBottom: 300,
        }}
        data={Data?.data?.results ?? []}
        renderItem={renderSongItem}
        onEndReached={hasMore ? loadMore : null}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : null}
      />}
      {Data?.data?.results?.length === 0 && <View style={{
        height: 400,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <PlainText text={"No Song found!"} />
        <SmallText text={"Opps!  T_T"} />
      </View>}
    </Animated.View>
  )
}

