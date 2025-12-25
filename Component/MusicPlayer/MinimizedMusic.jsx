import { Dimensions, View, Pressable } from "react-native";
import React, { memo } from "react";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import Animated, { FadeIn } from "react-native-reanimated";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import { PlayPauseButton } from "./PlayPauseButton";
import { NextSongButton } from "./NextSongButton";
import { PreviousSongButton } from "./PreviousSongButton";
import { LikeSongButton } from "./LikeSongButton";
import FastImage from "react-native-fast-image";
import YTArtworkUtils from "../../Utils/YTMusicArtworkUtils";
import { useActiveTrack, useProgress } from "react-native-track-player";
import { PlayNextSong, PlayPreviousSong } from "../../MusicPlayerFunctions";
import LinearGradient from "react-native-linear-gradient";

export const MinimizedMusic = memo(({ setIndex, color }) => {
  const { position, duration } = useProgress()
  // const fling = Gesture.Fling()
  const pan = Gesture.Pan();
  pan.onFinalize((e) => {
    if (e.translationX > 100) {
      PlayPreviousSong()
    } else if (e.translationX < -100) {
      PlayNextSong()
    } else {
      setIndex(1)
    }
  })
  function formatTime(val) {
    const time = parseFloat(val)
    const minutes = Math.floor(time / 60);
    const seconds = time - minutes * 60;
    if (seconds < 10) {
      return minutes.toString() + ":" + "0" + seconds.toFixed(0).toString()
    }
    return minutes.toString() + ":" + seconds.toFixed(0).toString()
  }
  function TotalCompletedInpercent() {
    return (position / duration) * 100
  }
  const size = Dimensions.get("window").height
  const currentPlaying = useActiveTrack()
  if (!currentPlaying) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={["rgba(21,21,21,0.95)", "rgba(21,21,21,1)"]}
        style={{
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.08)",
        }}
      >
        <View style={{ height: 2, width: "100%", backgroundColor: "rgba(255,255,255,0.05)" }}>
          <View style={{ height: "100%", width: `${TotalCompletedInpercent()}%`, backgroundColor: "white" }} />
        </View>
        <Animated.View
          entering={FadeIn}
          style={{
            flexDirection: 'row',
            justifyContent: "space-between",
            height: 85,
            paddingHorizontal: 12,
            alignItems: "center",
            gap: 10,
          }}>
          <GestureDetector gesture={pan}>
            <Pressable onPress={() => setIndex(1)} activeOpacity={0.9} style={{
              flexDirection: "row",
              flex: 1,
              alignItems: "center",
            }}>
              <FastImage
                source={{
                  uri: (() => {
                    const art = currentPlaying?.artwork || currentPlaying?.thumbnail || "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png";
                    return YTArtworkUtils.upgradeArtworkQuality(art);
                  })(),
                }}
                resizeMode={FastImage.resizeMode.cover}
                style={{
                  height: 48,
                  width: 48,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                }}
              />
              <View style={{
                flex: 1,
                justifyContent: "center",
                paddingHorizontal: 12,
              }}>
                <PlainText text={currentPlaying?.title ?? ""} style={{ fontSize: 15 }} />
                <SmallText text={currentPlaying?.artist ?? ""} maxLine={1} style={{ fontSize: 13, opacity: 0.7 }} />
              </View>
            </Pressable>
          </GestureDetector>
          <View style={{ gap: 15, flexDirection: "row", alignItems: "center", paddingRight: 5 }}>
            <PreviousSongButton size={22} />
            <PlayPauseButton isplaying={false} size={28} />
            <NextSongButton size={22} />
            <LikeSongButton size={22} />
          </View>
        </Animated.View>
      </LinearGradient>
    </GestureHandlerRootView>
  );
});
