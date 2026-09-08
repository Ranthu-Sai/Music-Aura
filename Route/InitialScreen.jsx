import React, {useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GetLanguageValue} from '../LocalStorage/Languages';
import {GetUserNameValue} from '../LocalStorage/StoreUserName';

export const InitialScreen = ({navigation}) => {
  const {width} = useWindowDimensions();
  const hasStartedInitRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const glowValue = useSharedValue(0.5);

  useEffect(() => {
    glowValue.value = withRepeat(
      withTiming(1, {duration: 1400, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [glowValue]);

  const animatedGlowRing = useAnimatedStyle(() => {
    const scale = interpolate(glowValue.value, [0, 1], [0.95, 1.25]);
    const opacity = interpolate(glowValue.value, [0, 1], [0.35, 0.75]);
    return {
      transform: [{scale}],
      opacity,
    };
  });

  const animatedTitlePulse = useAnimatedStyle(() => {
    const scale = interpolate(glowValue.value, [0, 1], [0.98, 1.03]);
    const opacity = interpolate(glowValue.value, [0, 1], [0.92, 1]);
    return {
      transform: [{scale}],
      opacity,
    };
  });

  const requestStoragePermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      const permission =
        Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      const granted = await PermissionsAndroid.check(permission);
      if (!granted) {
        await PermissionsAndroid.request(permission);
      }
    } catch (_) {}
  }, []);

  const InitialCall = useCallback(async () => {
    if (hasNavigatedRef.current) {
      return;
    }

    try {
      // Parallelize local storage check and entrance display timer
      const [lang, userName, hasCompleted] = await Promise.all([
        GetLanguageValue(),
        GetUserNameValue(),
        AsyncStorage.getItem('has_completed_onboarding'),
        new Promise(resolve => setTimeout(resolve, 1200)),
      ]);

      if (hasNavigatedRef.current) {
        return;
      }

      hasNavigatedRef.current = true;
      if (
        hasCompleted === 'true' ||
        (lang && lang !== '') ||
        (userName && userName !== '')
      ) {
        navigation.replace('MainRoute');
      } else {
        navigation.replace('Onboarding');
      }

      requestStoragePermission();
    } catch (err) {
      console.warn('InitialCall error, navigating to MainRoute fallback:', err);
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigation.replace('MainRoute');
      }
    }
  }, [navigation, requestStoragePermission]);

  useEffect(() => {
    if (hasStartedInitRef.current) {
      return;
    }
    hasStartedInitRef.current = true;
    InitialCall();
  }, [InitialCall]);

  const auraSize = Math.min(width * 0.75, 280);
  const ringSize = Math.min(width * 0.65, 240);
  const titleFontSize = Math.min(width * 0.11, 46);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View style={styles.contentCenter}>
        {/* Ambient Glowing Aura */}
        <Animated.View
          style={[
            styles.auraBackdrop,
            {
              width: auraSize,
              height: auraSize,
              borderRadius: auraSize / 2,
            },
            animatedGlowRing,
          ]}
        />
        <Animated.View
          style={[
            styles.auraRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
            },
            animatedGlowRing,
          ]}
        />

        {/* Entrance Title - rendered immediately with native glowing text shadow */}
        <Animated.View style={[styles.titleWrapper, animatedTitlePulse]}>
          <Text
            style={[
              styles.title,
              {fontSize: titleFontSize},
            ]}>
            Chinni <Text style={styles.titleHighlight}>Music</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCenter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraBackdrop: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.22)',
  },
  auraRing: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.45)',
    shadowColor: '#1DB954',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
  titleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(29, 185, 84, 0.95)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 28,
  },
  titleHighlight: {
    color: '#1DB954',
    fontWeight: '900',
    textShadowColor: 'rgba(29, 185, 84, 1)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 30,
  },
});
