import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import React from "react";
import { useTheme } from "@react-navigation/native";
import { Pressable, ActivityIndicator } from "react-native";

export const GetLyricsButton = ({ onPress, loading = false }) => {
  const theme = useTheme()
  
  if (loading) {
    return (
      <ActivityIndicator size={25} color={theme.colors.primary} />
    );
  }
  
  return (
    <Pressable onPress={onPress}>
      <MaterialIcons name="lyrics" size={25} color={theme.colors.text} />
    </Pressable>
  );
};
