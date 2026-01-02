import React, { useState, useEffect } from "react";
import {
  Dimensions,
  TextInput,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from "react-native";
import Animated, { 
  FadeIn, 
  FadeOut, 
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
import { SetUserNameValue } from "../../LocalStorage/StoreUserName";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width, height } = Dimensions.get("window");

export const Slide3 = ({ navigation }) => {
  const [name, setName] = useState("");
  const glowValue = useSharedValue(0);

  useEffect(() => {
    glowValue.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [glowValue]);

  const handleNext = async () => {
    if (name.trim() === "") {
      alert("Please enter your name!");
    } else {
      await SetUserNameValue(name.trim());
      navigation.replace("Slide4");
    }
  };

  const animatedGlow = useAnimatedStyle(() => {
    const scale = interpolate(glowValue.value, [0, 1], [1, 1.05], Extrapolate.CLAMP);
    const opacity = interpolate(glowValue.value, [0, 1], [0.3, 0.6], Extrapolate.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const animatedTextGlow = useAnimatedStyle(() => ({
    textShadowRadius: 10 + (glowValue.value * 15),
    opacity: 0.8 + (glowValue.value * 0.2),
  }));

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.contentContainer}>
          {/* Animated Background Aura */}
          <Animated.View style={[styles.backgroundAura, animatedGlow]} />

          <View style={styles.centerSection}>
            <Animated.View entering={FadeIn.duration(1000)} style={styles.imageWrapper}>
              <View style={styles.imageGlow}>
                <FastImage
                  source={require("../../Images/GiveName.gif")}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>

            <View style={styles.textContent}>
              <Animated.Text entering={FadeIn.delay(200).duration(800)} style={styles.topLabel}>
                Personalize your experience
              </Animated.Text>
              <Animated.Text 
                entering={FadeIn.delay(400).duration(800)} 
                style={[styles.mainTitle, animatedTextGlow]}
              >
                What's your name?
              </Animated.Text>
            </View>

            <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.inputContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                style={styles.inputGradient}
              >
                <Icon name="account-circle-outline" size={24} color="#1DB954" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={name}
                  onChangeText={setName}
                  selectionColor="#1DB954"
                  style={styles.input}
                  autoFocus={false}
                />
              </LinearGradient>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            <Animated.View entering={FadeIn.delay(800).duration(800)} style={styles.footerRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.replace("Slide2")}
              >
                <Icon name="chevron-left" size={32} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextBtn}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1DB954', '#1ed760']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextGradient}
                >
                  <Text style={styles.nextText}>Continue</Text>
                  <View style={styles.arrowCircle}>
                    <Icon name="arrow-right" size={18} color="black" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    filter: 'blur(60px)',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    marginBottom: 40,
  },
  imageGlow: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  image: {
    height: 200,
    width: 200,
    borderRadius: 100,
  },
  textContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  topLabel: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
    opacity: 0.9,
  },
  mainTitle: {
    color: 'white',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: '#1DB954',
    textShadowOffset: { width: 0, height: 0 },
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
  },
  inputGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 70,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    paddingBottom: 40,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  backBtn: {
    width: 65,
    height: 65,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nextBtn: {
    flex: 1,
    height: 70,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  nextGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: 'black',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 15,
  }
});
