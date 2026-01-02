import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions, Text, StatusBar } from "react-native";
import FastImage from "react-native-fast-image";
import Animated, { 
  FadeIn, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from "react-native-reanimated";
import { BottomNextAndPrevious } from "../../Component/RouteOnboarding/BottomNextAndPrevious";

const { width } = Dimensions.get("window");

export const Slide1 = ({ navigation }) => {
  const glowValue = useSharedValue(0.5);

  useEffect(() => {
    glowValue.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [glowValue]);

  const animatedTextGlow = useAnimatedStyle(() => ({
    textShadowRadius: 15 + (glowValue.value * 15),
    opacity: 0.8 + (glowValue.value * 0.2),
  }));

  const animatedImageGlow = useAnimatedStyle(() => ({
    shadowRadius: 20 + (glowValue.value * 20),
    borderColor: `rgba(29, 185, 84, ${0.1 + (glowValue.value * 0.2)})`,
  }));

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <View style={styles.centerSection}>
        <Animated.View entering={FadeIn.duration(800)} style={styles.imageContainer}>
          <Animated.View style={[styles.imageWrapper, animatedImageGlow]}>
            <FastImage
              source={require("../../Images/Logo.jpg")}
              style={styles.image}
              resizeMode="cover"
            />
          </Animated.View>
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={FadeIn.delay(300).duration(800)} style={{ alignItems: 'center' }}>
            <Text style={styles.topLabel}>Discover Music</Text>
            <Animated.Text style={[styles.subtitle, animatedTextGlow]}>
              Music Aura
            </Animated.Text>
          </Animated.View>
        </View>
      </View>

      <View style={styles.footer}>
        <BottomNextAndPrevious
          delay={700}
          onNextPress={() => {
            navigation.replace("Slide2");
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  centerSection: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    // We don't use absolute positioning for the footer here to keep the title exactly centered
    // but the content view itself is absolutely filled.
  },
  imageContainer: {
    marginBottom: 40,
  },
  imageWrapper: {
    padding: 8,
    borderRadius: 110,
    borderWidth: 1,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    elevation: 20,
    backgroundColor: '#000',
  },
  image: {
    height: 200,
    width: 200,
    borderRadius: 100,
  },
  content: {
    alignItems: 'center',
  },
  topLabel: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'white',
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: '#1DB954',
    textShadowOffset: { width: 0, height: 0 },
  },
  footer: {
    width: '100%',
    position: 'absolute',
    bottom: 50,
    left: 0,
    paddingHorizontal: 25,
  },
});
