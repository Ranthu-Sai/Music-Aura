import React, {useState, useEffect} from 'react';
import {
  Dimensions,
  TextInput,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  ToastAndroid,
  Alert,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import {SetUserNameValue} from '../../LocalStorage/StoreUserName';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {MainWrapper} from '../../Layout/MainWrapper';

const {width, height} = Dimensions.get('window');

export const ChangeName = ({navigation}) => {
  const [name, setName] = useState('');
  const glowValue = useSharedValue(0);

  useEffect(() => {
    glowValue.value = withRepeat(
      withTiming(1, {duration: 3000, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [glowValue]);

  const animatedSymbol = useAnimatedStyle(() => ({
    transform: [{scale: 1 + glowValue.value * 0.05}],
    opacity: 0.8 + glowValue.value * 0.2,
  }));

  const handleConfirm = async () => {
    if (name.trim() === '') {
      Alert.alert('Please enter your name!');
    } else {
      await SetUserNameValue(name.trim());
      navigation.pop();
      ToastAndroid.showWithGravity(
        'Please restart the app',
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    }
  };

  const animatedGlow = useAnimatedStyle(() => {
    const scale = interpolate(
      glowValue.value,
      [0, 1],
      [1, 1.2],
      Extrapolate.CLAMP,
    );
    const opacity = interpolate(
      glowValue.value,
      [0, 1],
      [0.1, 0.3],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{scale}],
      opacity,
    };
  });

  return (
    <MainWrapper>
      <View style={styles.container}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />

        {/* Background Decorative Elements */}
        <Animated.View style={[styles.backgroundAura, animatedGlow]} />
        <View style={styles.topRightBlob} />
        <View style={styles.bottomLeftBlob} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={{flex: 1}}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {paddingBottom: 100},
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.mainContent}>
              <Animated.View
                entering={FadeInDown.duration(1000).springify()}
                style={styles.imageWrapper}>
                <View style={styles.imageContainer}>
                  <FastImage
                    source={require('../../Images/GiveName.gif')}
                    style={styles.image}
                    resizeMode="cover"
                  />
                </View>
              </Animated.View>

              <View style={styles.textSection}>
                <View style={styles.titleRow}>
                  <Animated.View style={animatedSymbol}>
                    <Icon
                      name="star-four-points-outline"
                      size={22}
                      color="#1DB954"
                    />
                  </Animated.View>
                  <Animated.Text
                    entering={FadeInDown.delay(400).duration(800)}
                    style={styles.titleText}>
                    Enter your name
                  </Animated.Text>
                </View>
              </View>

              <Animated.View
                entering={FadeInDown.delay(600).duration(800)}
                style={styles.inputWrapper}>
                <View style={styles.inputContainerStyle}>
                  <TextInput
                    placeholder="Type your name here..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={name}
                    onChangeText={setName}
                    selectionColor="#1DB954"
                    style={styles.input}
                    autoFocus={false}
                  />
                </View>
              </Animated.View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Animated.View
              entering={FadeInDown.delay(800).duration(800)}
              style={styles.footerRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.pop()}
                activeOpacity={0.7}>
                <Icon name="arrow-left" size={28} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}>
                <LinearGradient
                  colors={['#1DB954', '#1ed760']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.nextGradient}>
                  <Text style={styles.nextText}>Save Changes</Text>
                  <Icon name="check-circle-outline" size={24} color="black" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  mainContent: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  backgroundAura: {
    position: 'absolute',
    top: height * 0.1,
    alignSelf: 'center',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: (width * 1.4) / 2,
    backgroundColor: 'rgba(29, 185, 84, 0.25)',
  },
  topRightBlob: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  bottomLeftBlob: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
  },
  imageWrapper: {
    marginBottom: 30,
    marginTop: -80,
  },
  imageContainer: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.5)',
    backgroundColor: '#121212',
    elevation: 25,
    shadowColor: '#1DB954',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textSection: {
    alignItems: 'flex-start',
    marginBottom: 30,
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'left',
    letterSpacing: 1,
    textShadowColor: 'rgba(29, 185, 84, 0.5)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
  },
  inputWrapper: {
    width: '100%',
    paddingHorizontal: 10,
  },
  inputContainerStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 22,
    height: 84,
    borderWidth: 1.5,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    shadowColor: '#1DB954',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'left',
    paddingVertical: 4,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
    paddingTop: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 70,
    height: 70,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextBtn: {
    flex: 1,
    height: 70,
    borderRadius: 25,
    overflow: 'hidden',
  },
  nextGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  nextText: {
    color: 'black',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
  },
});
