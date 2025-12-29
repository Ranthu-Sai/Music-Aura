import { MainWrapper } from "../../Layout/MainWrapper";
import { EachLibraryCard } from "../../Component/Library/EachLibraryCard";
import { Dimensions, ScrollView, View, Text } from "react-native";
import { RouteHeading } from "../../Component/Home/RouteHeading";
import { useActiveTrack } from "react-native-track-player";
import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { GetUserPlaylists } from "../../LocalStorage/StoreUserPlaylists";
import { EachPlaylistCard } from "../../Component/Global/EachPlaylistCard";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { Spacer } from "../../Component/Global/Spacer";

export const Library = () => {
  const width = Dimensions.get("window").width;
  const activeTrack = useActiveTrack();
  const [userPlaylists, setUserPlaylists] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const fetchPlaylists = async () => {
        const playlists = await GetUserPlaylists();
        setUserPlaylists(playlists);
      };
      fetchPlaylists();
    }, [])
  );

  return (
    <MainWrapper>
      <RouteHeading bottomText={"Your Library"} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: activeTrack ? 140 : 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexWrap: 'wrap', flexDirection: "row", width: width, justifyContent: "space-evenly", paddingTop: 10 }}>
          <EachLibraryCard
            text={"Liked Songs"}
            iconName={"heart"}
            colors={["#FF416C", "#FF4B2B"]}
            navigate={"LikedSongs"}
          />
          <EachLibraryCard
            text={"Liked Playlists"}
            iconName={"playlist-music"}
            colors={["#4776E6", "#8E54E9"]}
            navigate={"LikedPlaylists"}
          />
          <EachLibraryCard
            text={"Recently Played"}
            iconName={"history"}
            colors={["#00b09b", "#96c93d"]}
            navigate={"RecentlyPlayed"}
          />
          <EachLibraryCard
            text={"Downloaded Songs"}
            iconName={"download"}
            colors={["#11998e", "#38ef7d"]}
            navigate={"DownloadedSongs"}
          />
        </View>

        {userPlaylists.length > 0 && (
          <PaddingConatiner>
            <View style={{ marginTop: 25, marginBottom: 10 }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 }}>My Playlists</Text>
              <View style={{ height: 3, width: 40, backgroundColor: '#1DB954', marginTop: 4, borderRadius: 2 }} />
              <Spacer height={15} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {userPlaylists.map((item) => (
                  <EachPlaylistCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    image={item.image}
                    follower={`${item.songs.length} songs`}
                    MainContainerStyle={{ width: '48%', marginBottom: 15 }}
                  />
                ))}
              </View>
            </View>
          </PaddingConatiner>
        )}
      </ScrollView>
    </MainWrapper>
  );
};
