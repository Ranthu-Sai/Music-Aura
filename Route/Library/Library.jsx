import { MainWrapper } from "../../Layout/MainWrapper";
import { EachLibraryCard } from "../../Component/Library/EachLibraryCard";
import { Dimensions, ScrollView, View } from "react-native";
import { RouteHeading } from "../../Component/Home/RouteHeading";
import { useActiveTrack } from "react-native-track-player";

export const Library = () => {
  const width = Dimensions.get("window").width;
  const activeTrack = useActiveTrack();

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
        </View>
      </ScrollView>
    </MainWrapper>
  );
};
