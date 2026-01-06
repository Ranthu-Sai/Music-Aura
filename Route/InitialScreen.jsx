import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { View, StatusBar, StyleSheet, Text } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useEffect, useCallback } from "react";
import { GetLanguageValue } from "../LocalStorage/Languages";

export const InitialScreen = ({ navigation }) => {
  const theme = useTheme();
  const glowOpacity = useSharedValue(0.6);

  const InitialCall = useCallback(async () => {
    const lang = await GetLanguageValue();
    if (lang !== '') {
      navigation.replace("MainRoute");
    } else {
      navigation.replace("Onboarding");
    }
  }, [navigation]);

  useEffect(() => {
    // Pulsing glow animation
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    const timer = setTimeout(() => { InitialCall() }, 2000);
    return () => clearTimeout(timer);
  }, [InitialCall, glowOpacity]);

  const animatedGlow = useAnimatedStyle(() => ({
    textShadowRadius: 20 + (glowOpacity.value * 15),
    opacity: 0.8 + (glowOpacity.value * 0.2),
  }));

  return (
    <View style={styles.container}>
      {/* Set StatusBar to translucent and same color as Slide1 to avoid layout shifts */}
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.centerContainer}>
        <Animated.Text
          entering={FadeIn.duration(800)}
          exiting={FadeOut.duration(300)}
          style={[
            styles.title,
            {
              color: theme.colors.text,
              textShadowColor: theme.colors.primary || '#1DB954',
            },
            animatedGlow,
          ]}
        >
          Music Aura
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: "center",
    textShadowOffset: { width: 0, height: 0 },
  },
});
