import React, { useEffect, useState } from "react";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { LikedPagesTopHeader } from "../../Component/Library/TopHeaderLikedPages";
import { LikedDetails } from "../../Component/Library/LikedDetails";
import { EachSongCard } from "../../Component/Global/EachSongCard";
import { Dimensions, View } from "react-native";
import { useTheme, useIsFocused } from "@react-navigation/native";
import historyManager from "../../Utils/HistoryManager";
import { useActiveTrack } from "react-native-track-player";

export const RecentlyPlayedPage = () => {
  const AnimatedRef = useAnimatedRef();
  const [history, setHistory] = useState([]);
  const width = Dimensions.get("window").width;
  const theme = useTheme();
  const activeTrack = useActiveTrack();
  const isFocused = useIsFocused();

  async function getHistory() {
    const data = await historyManager.getHistory();
    // Normalize data for EachSongCard
    const normalized = data.map((e) => ({
      url: e.url,
      title: e.title,
      artist: e.artist,
      artwork: e.artwork,
      duration: e.duration,
      id: e.id,
      language: e.language || 'en',
    }));
    setHistory(normalized);
  }

  useEffect(() => {
    if (isFocused) {
      getHistory();
    }
  }, [isFocused]);

  return (
    <Animated.ScrollView
      scrollEventThrottle={16}
      ref={AnimatedRef}
      style={{ backgroundColor: "black" }}
      contentContainerStyle={{
        paddingBottom: activeTrack ? 150 : 70,
        backgroundColor: "rgba(0,0,0)",
      }}
    >
      <LikedPagesTopHeader
        AnimatedRef={AnimatedRef}
        url={require("../../Images/RecentlyPlayed.jpg")}
      />
      <LikedDetails name={"Recently Played"} Data={history} />
      <View style={{ paddingHorizontal: 10, backgroundColor: theme.colors.background }}>
        {history.map((e, i) => (
          <EachSongCard
            width={width * 0.95}
            Data={history}
            index={i}
            url={e.url}
            id={e.id}
            title={e.title}
            artist={e.artist}
            image={e.artwork}
            language={e.language}
            duration={e.duration}
            key={i}
          />
        ))}
      </View>
    </Animated.ScrollView>
  );
};
