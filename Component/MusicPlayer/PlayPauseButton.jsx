import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useTheme } from "@react-navigation/native";
import { ActivityIndicator, Pressable } from "react-native";
import {  PauseSong, PlaySong } from "../../MusicPlayerFunctions";
import { usePlaybackState, State } from "react-native-track-player";

export const PlayPauseButton = ({isFullScreen, size, color}) => {
  const theme = useTheme()
  const playbackState = usePlaybackState();
  const playerState = playbackState.state;
  
  const iconSize = size || (isFullScreen ? 28 : 25);
  const iconColor = color || (isFullScreen ? "black" : theme.colors.text);

  const isPlaying = playerState === State.Playing;
  const isBuffering = playerState === State.Buffering || playerState === State.Loading;

  return (
    <>
      {!isFullScreen &&  <>
        {!isPlaying && !isBuffering && <Pressable style={{
          padding: 8,
        }}  onPress={()=>{
          PlaySong()
        }}><FontAwesome6 name={"play"} size={iconSize} color={iconColor}/></Pressable>}
        {isPlaying && <Pressable style={{
          padding: 8,
        }} onPress={()=>{
          PauseSong()
        }}><FontAwesome6 name={"pause"} size={iconSize} color={iconColor}/></Pressable>}
        {isBuffering && <ActivityIndicator size={"small"} color={iconColor}/>}
      </>}
      {isFullScreen && <>
        {!isPlaying && !isBuffering && <Pressable onPress={()=>{
          PlaySong()
        }} style={{
          backgroundColor:"white",
          padding: 15,
          height: 60,
          width: 60,
          borderRadius: 1000,
          alignItems: "center",
          justifyContent: "center",
        }}>
          <FontAwesome6 name={"play"} size={iconSize} color={iconColor}/>
        </Pressable>}
        {isPlaying &&  <Pressable onPress={()=>{
          PauseSong()
        }} style={{
          backgroundColor:"white",
          padding: 15,
          height: 60,
          width: 60,
          borderRadius: 1000,
          alignItems: "center",
          justifyContent: "center",
        }}><FontAwesome6 name={"pause"} size={iconSize} color={iconColor}/></Pressable>}
        {isBuffering && <ActivityIndicator size={"large"} color={"white"}/>}
      </>}
    </>
  );
};
