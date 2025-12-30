import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { View } from "react-native";
import { MainWrapper } from "../Layout/MainWrapper";
import { useTheme } from "@react-navigation/native";
import { useEffect, useCallback } from "react";
import { GetLanguageValue } from "../LocalStorage/Languages";

export const InitialScreen = ({ navigation }) => {
  const theme = useTheme()
  const InitialCall = useCallback(async () => {
    const lang = await GetLanguageValue()
    if (lang !== '') {
      navigation.replace("MainRoute")
    } else {
      navigation.replace("Onboarding")
    }
  }, [navigation]);
  useEffect(() => {
    const timer = setTimeout(() => { InitialCall() }, 720)
    return () => clearTimeout(timer)
  }, [InitialCall]);
  return (
    <MainWrapper>
      <Animated.View exiting={FadeOut.duration(300)} style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Animated.Text entering={FadeIn.delay(100).duration(300)} style={{
          fontSize: 40,
          color: theme.colors.text,
          fontWeight: 500,
        }}>Music Aura</Animated.Text>
        <Animated.Text entering={FadeIn.delay(300)} style={{
          fontSize: 15,
          color: theme.colors.primary,
        }}>Music for free</Animated.Text>
      </Animated.View>
    </MainWrapper>
  );
};
