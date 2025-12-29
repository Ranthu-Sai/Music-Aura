import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { MainWrapper } from "../../Layout/MainWrapper";
import FastImage from "react-native-fast-image";
import { Text } from "react-native";
import Animated, { FadeInDown, FadeInUp, FadeIn } from "react-native-reanimated";
import { BottomNextAndPrevious } from "../../Component/RouteOnboarding/BottomNextAndPrevious";

const { width } = Dimensions.get("window");

export const Slide1 = ({ navigation }) => {
  return (
    <MainWrapper>
      <View style={styles.container}>
        {/* Top Decorative Element */}
        <Animated.View entering={FadeIn.duration(1000)} style={styles.topBlob} />

        <Animated.View entering={FadeInUp.delay(100).duration(800)} style={styles.imageContainer}>
          <View style={styles.imageGlow}>
            <FastImage
              source={require("../../Images/Logo.jpg")}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(300).duration(800)}>
            <Text style={styles.title}>Discover Music</Text>
            <Text style={styles.subtitle}>Welcome to Music Aura</Text>
            <Text style={styles.description}>Listen to music for free</Text>
          </Animated.View>
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
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 25,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  topBlob: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  imageGlow: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  image: {
    height: 200,
    width: 200,
    borderRadius: 100,
  },
  content: {
    alignItems: 'center',
    marginTop: 10,
  },
  title: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 30,
  },
  footer: {
    width: '100%',
  },
});
