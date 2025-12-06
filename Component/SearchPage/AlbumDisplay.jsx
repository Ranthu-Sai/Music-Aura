/* eslint-disable keyword-spacing */
import React, { useState, useRef, useEffect } from 'react'
import { Dimensions, FlatList, ScrollView, View, Animated, ActivityIndicator } from 'react-native'
import { LoadingComponent } from '../Global/Loading'
import { PlainText } from '../Global/PlainText'
import { SmallText } from '../Global/SmallText'
import { EachAlbumCard } from '../Global/EachAlbumCard'
import { getSearchAlbumData } from '../../Api/Album'

export default function AlbumsDisplay({ data, limit, Searchtext, loadMore, hasMore, loadingMore }) {
  const Data = data
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
  const width = Dimensions.get("window").width
  const itemWidth = (width - 40) / 2; // 20 padding on sides, 20 gap between
  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {Data?.data?.results?.length !== 0 && <FlatList
        showsVerticalScrollIndicator={false}
        numColumns={2}
        contentContainerStyle={{
          paddingBottom: 300,
        }}
        keyExtractor={(item, index) => `${item?.id}_${index}`}
        data={Data?.data?.results ?? []}
        renderItem={({ item: album, index }) => {
          const isSaavn = album?.artists?.primary;
          const name = isSaavn ? album?.name : album?.title;
          const artists = isSaavn ? FormatArtist(album?.artists?.primary) : album?.artist;
          const image = Array.isArray(album?.image) ? (album?.image[2]?.url || album?.image[1]?.url || album?.image[0]?.url || "") : (typeof album?.image === 'string' ? album?.image : "");
          return <EachAlbumCard key={`${album?.id}_${index}`} Search={true} mainContainerStyle={{ width: itemWidth, marginBottom: 15, marginHorizontal: 5 }} image={image} artists={artists} name={name ?? ""} id={album?.id ?? ""} />
        }}
        onEndReached={hasMore ? loadMore : null}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={{ padding: 20, alignItems: 'center', width: '100%' }}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : null}
      />}
      {Data?.data?.results?.length === 0 && <View style={{
        height: 400,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <PlainText text={"No Album found!"} />
        <SmallText text={"Opps!  T_T"} />
      </View>}
    </Animated.View>
  )
}
