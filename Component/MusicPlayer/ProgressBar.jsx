import Slider from "@react-native-community/slider";
import React from "react";
import { Dimensions, View } from "react-native";
import { useProgress } from "react-native-track-player";
import { SetProgressSong } from "../../MusicPlayerFunctions";
import { SmallText } from "../Global/SmallText";

export const ProgressBar = () => {
  const width = Dimensions.get("window").width;

  // Align update cadence with mini player for consistent timing UI
  const { position: rawPosition, duration: rawDuration } = useProgress(1000);

  // Guard against NaN/undefined and clamp values
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
  const position = Number.isFinite(rawPosition) && rawPosition > 0 ? Math.min(rawPosition, duration || rawPosition) : 0;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  const sliderValue = Math.max(0, Math.min(position, duration || 0));
  const sliderMax = duration || 0;

  return (
    <>
      <Slider
        onSlidingComplete={(progress) => {
          // Ensure valid seek target
          const target = Math.max(0, Math.min(progress ?? 0, sliderMax));
          SetProgressSong(target);
        }}
        style={{ width: width, height: 40 }}
        minimumValue={0}
        maximumValue={sliderMax}
        value={sliderValue}
        minimumTrackTintColor={"white"}
        maximumTrackTintColor="rgba(44,44,44,1)"
        thumbTintColor={"white"}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "90%" }}>
        <SmallText text={formatTime(position)} />
        <SmallText text={formatTime(duration)} />
      </View>
    </>
  );
};
