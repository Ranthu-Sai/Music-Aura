import { View, Pressable } from "react-native";
import { useTheme } from "@react-navigation/native";
import React, { memo } from "react";
import { PlainText } from "../Global/PlainText";
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
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";

export const MinimizedMusic = memo(({ setIndex, color }) => {
  const { position, duration } = useProgress()
  const theme = useTheme();
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

  function TotalCompletedInpercent() {
    return (position / duration) * 100
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) {
      return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentPlaying = useActiveTrack()
  if (!currentPlaying) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={{
        marginHorizontal: 10,
        marginBottom: 10,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.44,
        shadowRadius: 10.32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }}>
        <View style={{ height: 2.5, width: "100%", backgroundColor: "rgba(255,255,255,0.05)" }}>
          <View style={{ height: "100%", width: `${TotalCompletedInpercent()}%`, backgroundColor: theme.colors.primary || '#6CC04A' }} />
        </View>

        <Animated.View
          entering={FadeIn}
          style={{
            flexDirection: 'row',
            justifyContent: "space-between",
            height: 68,
            paddingHorizontal: 10,
            alignItems: "center",
          }}>
          <GestureDetector gesture={pan}>
            <Pressable onPress={() => setIndex(1)} style={{
              flexDirection: "row",
              flex: 1,
              alignItems: "center",
              height: '100%',
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
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                }}
              />
              <View style={{
                flex: 1,
                justifyContent: "center",
                paddingHorizontal: 12,
              }}>
                <PlainText
                  text={FormatTitleAndArtist(currentPlaying?.title ?? "").split(' (')[0].split(' [')[0].split(' - ')[0]}
                  numberOfLine={1}
                  style={{ fontSize: 14, fontWeight: '700' }}
                />
                <PlainText
                  text={`${formatTime(position)} / ${formatTime(duration)}`}
                  style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}
                />
              </View>
            </Pressable>
          </GestureDetector>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <LikeSongButton size={22} />
            <PreviousSongButton size={22} />
            <PlayPauseButton isFullScreen={false} size={28} />
            <NextSongButton size={22} />
          </View>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
});
