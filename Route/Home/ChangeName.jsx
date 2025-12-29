import React, { useState } from "react";
import {
  Dimensions,
  TextInput,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid
} from "react-native";
import { MainWrapper } from "../../Layout/MainWrapper";
import Animated, { FadeInDown, FadeInUp, FadeIn } from "react-native-reanimated";
import FastImage from "react-native-fast-image";
import LinearGradient from "react-native-linear-gradient";
import { SetUserNameValue } from "../../LocalStorage/StoreUserName";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");

export const ChangeName = ({ navigation }) => {
  const [name, setName] = useState("");

  const handleConfirm = async () => {
    if (name.trim() === "") {
      // eslint-disable-next-line no-alert
      alert("Please enter your name!");
    } else {
      await SetUserNameValue(name.trim());
      navigation.pop();
      ToastAndroid.showWithGravity(
        `Please restart the app`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    }
  };

  return (
    <MainWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {/* Top Decorative Element */}
          <Animated.View entering={FadeIn.duration(1000)} style={styles.topBlob} />

          <Animated.View entering={FadeInUp.delay(100).duration(800)} style={styles.imageContainer}>
            <View style={styles.imageGlow}>
              <FastImage
                source={require("../../Images/GiveName.gif")}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          </Animated.View>

          <View style={styles.content}>
            <Animated.View entering={FadeInDown.delay(300).duration(800)}>
              <Text style={styles.title}>Personalize your experience</Text>
              <Text style={styles.subtitle}>What should I call you?</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Icon name="account-outline" size={24} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={name}
                  onChangeText={setName}
                  selectionColor="#1DB954"
                  style={styles.input}
                />
              </View>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            <Animated.View entering={FadeInDown.delay(700).duration(800)} style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.pop()}
                activeOpacity={0.6}
              >
                <Icon name="chevron-left" size={28} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleConfirm}
              >
                <LinearGradient
                  colors={['#1DB954', '#1ed760']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.buttonText}>Change Name</Text>
                  <Icon name="check" size={20} color="black" style={{ marginLeft: 8 }} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 30,
    letterSpacing: -0.5,
  },
  inputWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: width * 0.85,
    paddingHorizontal: 15,
    height: 65,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  backButton: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextButton: {
    flex: 1,
    height: 65,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  }
});
