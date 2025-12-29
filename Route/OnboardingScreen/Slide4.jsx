import React from "react";
import {
  Dimensions,
  View,
  StyleSheet,
  TouchableOpacity,
  Text
} from "react-native";
import { MainWrapper } from "../../Layout/MainWrapper";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  RotateInUpRight,
  ZoomIn
} from "react-native-reanimated";
import FastImage from "react-native-fast-image";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");

export const Slide4 = ({ navigation }) => {
  return (
    <MainWrapper>
      <View style={styles.container}>
        {/* Background Decorative Elements */}
        <Animated.View entering={RotateInUpRight.delay(200).duration(2000)} style={styles.bgCircle1} />
        <Animated.View entering={ZoomIn.delay(400).duration(1500)} style={styles.bgCircle2} />

        <View style={styles.topSection}>
          <Animated.View entering={ZoomIn.duration(1000)} style={styles.imageWrapper}>
            <View style={styles.imageInnerGlow}>
              <FastImage
                source={require("../../Images/letsgo.gif")}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
            {/* Floating Icons */}
            <Animated.View entering={FadeIn.delay(1200)} style={[styles.floatingIcon, { top: -20, right: -10 }]}>
              <Icon name="music-node" size={24} color="#1DB954" />
            </Animated.View>
            <Animated.View entering={FadeIn.delay(1400)} style={[styles.floatingIcon, { bottom: 20, left: -30 }]}>
              <Icon name="headphones" size={28} color="#4776E6" />
            </Animated.View>
          </Animated.View>
        </View>

        <View style={styles.contentSection}>
          <Animated.View entering={FadeInUp.delay(500).duration(800)}>
            <Text style={styles.overTitle}>Configuration Complete</Text>
            <Text style={styles.mainTitle}>You're all set!</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(800).duration(800)}>
            <Text style={styles.description}>
              Dive into a personalized world of melodies. Your Music Aura is ready to shine.
            </Text>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Animated.View entering={FadeInUp.delay(1000).duration(800)} style={styles.buttonWrapper}>
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
                  <Icon name="play" size={20} color="black" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.replace("Slide3")}
            >
              <Text style={styles.backLinkText}>Change basic info</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50,
  },
  bgCircle1: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(29, 185, 84, 0.05)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 150,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(71, 118, 230, 0.05)',
  },
  topSection: {
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'relative',
  },
  imageInnerGlow: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 120,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  image: {
    height: 200,
    width: 200,
    borderRadius: 100,
  },
  floatingIcon: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contentSection: {
    alignItems: 'center',
    marginVertical: 40,
  },
  overTitle: {
    fontSize: 12,
    color: '#1DB954',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 40,
    color: 'white',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    width: '100%',
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  getStartedButton: {
    width: '100%',
    height: 70,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  btnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 15,
  },
  buttonText: {
    color: 'black',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  backLink: {
    marginTop: 25,
  },
  backLinkText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  }
});
