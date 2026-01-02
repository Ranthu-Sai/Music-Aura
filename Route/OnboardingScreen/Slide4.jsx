import React, { useEffect } from "react";
import {
  Dimensions,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  Extrapolate
} from "react-native-reanimated";
import FastImage from "react-native-fast-image";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width, height } = Dimensions.get("window");

export const Slide4 = ({ navigation }) => {
  const glowValue = useSharedValue(0);

  useEffect(() => {
    glowValue.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [glowValue]);

  const animatedBackAura = useAnimatedStyle(() => {
    const scale = interpolate(glowValue.value, [0, 1], [1, 1.2], Extrapolate.CLAMP);
    const opacity = interpolate(glowValue.value, [0, 1], [0.2, 0.4], Extrapolate.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const animatedTitleGlow = useAnimatedStyle(() => ({
    textShadowRadius: 10 + (glowValue.value * 20),
    opacity: 0.8 + (glowValue.value * 0.2),
  }));

  const animatedLogoGlow = useAnimatedStyle(() => ({
    shadowRadius: 20 + (glowValue.value * 20),
    borderColor: `rgba(29, 185, 84, ${0.1 + (glowValue.value * 0.3)})`,
  }));

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <View style={styles.contentContainer}>
        {/* Animated Background Aura */}
        <Animated.View style={[styles.backgroundAura, animatedBackAura]} />

        <View style={styles.centerSection}>
          <Animated.View entering={FadeIn.duration(1000)} style={styles.imageWrapper}>
            <Animated.View style={[styles.imageInnerGlow, animatedLogoGlow]}>
              <FastImage
                source={require("../../Images/letsgo.gif")}
                style={styles.image}
                resizeMode="cover"
              />
            </Animated.View>
            
            {/* Floating Decorative Elements */}
            <Animated.View entering={FadeIn.delay(1200)} style={[styles.floatingIcon, { top: -10, right: -20 }]}>
              <Icon name="music" size={20} color="#1DB954" />
            </Animated.View>
            <Animated.View entering={FadeIn.delay(1400)} style={[styles.floatingIcon, { bottom: 30, left: -40 }]}>
              <Icon name="check-decagram" size={24} color="#4776E6" />
            </Animated.View>
          </Animated.View>

          <View style={styles.textContent}>
            <Animated.Text entering={FadeIn.delay(200).duration(800)} style={styles.overTitle}>
              Configuration Complete
            </Animated.Text>
            <Animated.Text 
              entering={FadeIn.delay(400).duration(800)} 
              style={[styles.mainTitle, animatedTitleGlow]}
            >
              You're all set!
            </Animated.Text>
            <Animated.Text entering={FadeIn.delay(600).duration(800)} style={styles.description}>
              Dive into a personalized world of melodies.{"\n"}Your Music Aura is ready to shine.
            </Animated.Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Animated.View entering={FadeIn.delay(1000).duration(800)} style={styles.buttonWrapper}>
            <TouchableOpacity
              style={styles.getStartedButton}
              activeOpacity={0.8}
              onPress={() => navigation.replace("MainRoute")}
            >
              <LinearGradient
                colors={['#1DB954', '#1ed760']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              >
                <Text style={styles.buttonText}>Get Started</Text>
                <View style={styles.btnIconCircle}>
                  <Icon name="rocket-launch" size={22} color="black" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.replace("Slide3")}
            >
              <Text style={styles.backLinkText}>Edit profile details</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 25,
  },
  backgroundAura: {
    position: 'absolute',
    top: height * 0.1,
    alignSelf: 'center',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    backgroundColor: 'rgba(71, 118, 230, 0.1)',
    filter: 'blur(80px)',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 50,
  },
  imageInnerGlow: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 120,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.2)',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    elevation: 25,
  },
  image: {
    height: 200,
    width: 200,
    borderRadius: 100,
  },
  floatingIcon: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 5,
  },
  textContent: {
    alignItems: 'center',
  },
  overTitle: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.9,
  },
  mainTitle: {
    fontSize: 48,
    color: 'white',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    textShadowColor: '#1DB954',
    textShadowOffset: { width: 0, height: 0 },
  },
  description: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 25,
    lineHeight: 28,
    fontWeight: '500',
    paddingHorizontal: 10,
  },
  footer: {
    paddingBottom: 50,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  getStartedButton: {
    width: '100%',
    height: 75,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'black',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  btnIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
  },
  backLink: {
    marginTop: 25,
  },
  backLinkText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  }
});
