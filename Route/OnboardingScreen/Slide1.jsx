import React, {useEffect} from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const {width, height} = Dimensions.get('window');

export const Slide1 = ({navigation}) => {
  const glow = useSharedValue(0.6);

  useEffect(() => {
    // Hardware-accelerated breathing animation
    glow.value = withRepeat(
      withTiming(1, {duration: 2200, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [glow]);

  // Pure RenderThread GPU transforms and opacity
  const animatedBackAura = useAnimatedStyle(() => ({
    transform: [{scale: 1 + (glow.value - 0.6) * 0.25}],
    opacity: 0.16 + (glow.value - 0.6) * 0.2,
  }));

  const animatedLogoGlow = useAnimatedStyle(() => ({
    transform: [{scale: 1 + (glow.value - 0.6) * 0.15}],
    opacity: 0.35 + (glow.value - 0.6) * 0.45,
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* GPU-Accelerated Background Green Aura */}
      <Animated.View style={[styles.backgroundAura, animatedBackAura]} />
      <View style={styles.topRightBlob} />
      <View style={styles.bottomLeftBlob} />

      <View style={styles.mainWrapper}>
        {/* Center Content Section */}
        <View style={styles.centerSection}>
          <Animated.View
            entering={FadeIn.duration(280)}
            style={styles.imageContainer}>
            {/* Glowing aura ring behind logo */}
            <Animated.View style={[styles.logoGlowRing, animatedLogoGlow]} />

            <View style={styles.imageWrapper}>
              <Image
                source={require('../../Images/Logo.jpg')}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          </Animated.View>

          <View style={styles.content}>
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={styles.badgeContainer}>
              <Text style={styles.topLabel}>DISCOVER MUSIC</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(60).duration(300)}>
              <Text style={styles.title}>Chinni</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(300)}>
              <Text style={styles.description}>
                Listen to millions of songs with lossless quality, punchy original
                bass, and zero ads.
              </Text>
            </Animated.View>

            {/* Feature Pills */}
            <Animated.View
              entering={FadeInDown.delay(180).duration(300)}
              style={styles.featuresRow}>
              <View style={styles.featurePill}>
                <Icon name="music-note" size={14} color="#1DB954" />
                <Text style={styles.featureText}>320kbps Audio</Text>
              </View>
              <View style={styles.featurePill}>
                <Icon name="waveform" size={14} color="#1DB954" />
                <Text style={styles.featureText}>Punchy Bass</Text>
              </View>
              <View style={styles.featurePill}>
                <Icon name="shield-check" size={14} color="#1DB954" />
                <Text style={styles.featureText}>Ad-Free</Text>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Footer Section */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(300)}
          style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            activeOpacity={0.8}
            onPress={() => {
              navigation.replace('Slide2');
            }}>
            <LinearGradient
              colors={['#1DB954', '#1ed760']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.gradientButton}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Icon name="arrow-right" size={22} color="black" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: height * 0.08,
    paddingBottom: Platform.OS === 'android' ? 36 : 48,
  },
  backgroundAura: {
    position: 'absolute',
    top: height * 0.08,
    alignSelf: 'center',
    width: width * 1.15,
    height: width * 1.15,
    borderRadius: (width * 1.15) / 2,
    backgroundColor: 'rgba(29, 185, 84, 0.22)',
  },
  topRightBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
  },
  bottomLeftBlob: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(29, 185, 84, 0.06)',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlowRing: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(29, 185, 84, 0.45)',
  },
  imageWrapper: {
    padding: 6,
    borderRadius: 105,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.4)',
    backgroundColor: '#000000',
    elevation: 12,
  },
  image: {
    height: 190,
    width: 190,
    borderRadius: 95,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  badgeContainer: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.25)',
    marginBottom: 12,
  },
  topLabel: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(29, 185, 84, 0.65)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 22,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 320,
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  nextButton: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
