import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { Pressable } from "react-native";

export const GetLyricsButton = ({ onPress, loading = false }) => {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} disabled={loading}>
      <MaterialIcons name={loading ? "hourglass-empty" : "lyrics"} size={25} color={loading ? theme.colors.primary : theme.colors.text}/>
    </Pressable>
  );
};
