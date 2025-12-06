import React, { useRef, useEffect } from 'react'
import { Dimensions, FlatList, View, Animated, ActivityIndicator } from 'react-native'
import { EachPlaylistCard } from '../Global/EachPlaylistCard'
import { PlainText } from '../Global/PlainText'
import { SmallText } from '../Global/SmallText'

export default function PlaylistDisplay({ data, limit, Searchtext, loadMore, hasMore, loadingMore }) {
  const Data = data
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [Data, fadeAnim]);

  const width = Dimensions.get("window").width
  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {Data?.data?.results?.length !== 0 && <FlatList
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        scrollEnabled={true}
        keyExtractor={(item, index) => `${item?.id}_${index}`}
        contentContainerStyle={{
          paddingBottom: 220,
          alignItems: "flex-start",
        }}
        data={Data?.data?.results ?? []}
        renderItem={(item) => {
          const playlist = item.item;
          const isSaavn = playlist?.songCount;
          const name = isSaavn ? playlist.name : playlist.title;
          const follower = isSaavn ? "Total " + playlist.songCount + " Songs" : playlist.artist || "Playlist";
          const image = Array.isArray(playlist?.image) ? (playlist?.image[2]?.link || playlist?.image[1]?.link || playlist?.image[0]?.link || "") : (typeof playlist?.image === 'string' ? playlist?.image : "");
          return <EachPlaylistCard
            name={name}
            follower={follower}
            image={image}
            id={playlist.id}
            MainContainerStyle={{
              width: width * 0.45,
              marginHorizontal: 10,
            }}
            ImageStyle={{
              height: "70%",
            }}
          />
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
        <PlainText text={"No Playlist found!"} />
        <SmallText text={"Opps!  T_T"} />
      </View>}
    </Animated.View>
  )
}
