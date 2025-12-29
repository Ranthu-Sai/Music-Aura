import React, { useEffect, useState, useCallback } from "react";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { LikedPagesTopHeader } from "../../Component/Library/TopHeaderLikedPages";
import { LikedDetails } from "../../Component/Library/LikedDetails";
import { EachSongCard } from "../../Component/Global/EachSongCard";
import { Dimensions, View, Pressable, ToastAndroid, Alert } from "react-native";
import { useTheme, useIsFocused } from "@react-navigation/native";
import historyManager from "../../Utils/HistoryManager";
import { useActiveTrack } from "react-native-track-player";
import { PlainText } from "../../Component/Global/PlainText";

export const RecentlyPlayedPage = () => {
  const AnimatedRef = useAnimatedRef();
  const [history, setHistory] = useState([]);
  const width = Dimensions.get("window").width;
  const theme = useTheme();
  const activeTrack = useActiveTrack();
  const isFocused = useIsFocused();

  const getHistory = useCallback(async () => {
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
  }, []);

  const clearAllHistory = async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all recently played songs?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            const success = await historyManager.clearHistory();
            if (success) {
              setHistory([]);
              ToastAndroid.show("History cleared", ToastAndroid.SHORT);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (isFocused) {
      getHistory();
    }
  }, [isFocused, getHistory]);

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
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 15,
        backgroundColor: theme.colors.background
      }}>
        <LikedDetails name={"Recently Played"} Data={history} />
        {history.length > 0 && (
          <Pressable
            onPress={clearAllHistory}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              padding: 10,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            })}
          >
            <PlainText text="Clear All" style={{ fontSize: 12, color: '#ff5252' }} />
          </Pressable>
        )}
      </View>
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
            isHistory={true}
            onRemove={() => getHistory()}
            key={e.id + i}
          />
        ))}
      </View>
    </Animated.ScrollView>
  );
};
