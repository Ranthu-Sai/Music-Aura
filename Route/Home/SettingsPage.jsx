import { Heading } from "../../Component/Global/Heading";
import { MainWrapper } from "../../Layout/MainWrapper";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { Pressable, ScrollView, View, StyleSheet, Dimensions, TouchableOpacity, ToastAndroid, ActivityIndicator, Alert, Linking } from "react-native";
import { PlainText } from "../../Component/Global/PlainText";
import { Dropdown } from "react-native-element-dropdown";
import {
  GetDownloadPath,
  GetFontSizeValue,
  GetPlaybackQuality,
  SetDownloadPath, SetFontSizeValue,
  SetPlaybackQuality,
  GetTheme, SetTheme,
} from "../../LocalStorage/AppSettings";
import { useEffect, useState, useContext, useCallback } from "react";
import { SmallText } from "../../Component/Global/SmallText";
import DeviceInfo from "react-native-device-info";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { GetCacheSizes } from "../../LocalStorage/ClearCache";
import { Spacer } from "../../Component/Global/Spacer";
import updateService from "../../Utils/UpdateService";

const { width } = Dimensions.get("window");

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const EachSettingsButton = ({ text, subtitle, OnPress, currentThemeColors, iconName, delay = 0 }) => {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)}>
      <Pressable onPress={OnPress} style={({ pressed }) => [
        {
          backgroundColor: currentThemeColors.secondaryBackground || "rgba(255,255,255,0.05)",
          padding: 16,
          borderRadius: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          elevation: pressed ? 0 : 2,
        }
      ]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flex: 1 }}>
          <View style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            padding: 12,
            borderRadius: 12
          }}>
            <Icon name={iconName} size={22} color={currentThemeColors.primary || "#1DB954"} />
          </View>
          <View style={{ flex: 1 }}>
            <PlainText text={text} style={{ fontWeight: '600', fontSize: 16 }} />
            {subtitle && <SmallText text={subtitle} style={{ opacity: 0.5, marginTop: 2 }} />}
          </View>
        </View>
        <Icon name="chevron-right" size={24} color="white" opacity={0.3} />
      </Pressable>
    </Animated.View>
  );
}

const EachDropDownSetting = ({ data, text, placeholder, OnChange, currentThemeColors, iconName, delay = 0 }) => {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)} style={{
      backgroundColor: currentThemeColors.secondaryBackground || "rgba(255,255,255,0.05)",
      padding: 16,
      borderRadius: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      elevation: 2,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flex: 1 }}>
        <View style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          padding: 12,
          borderRadius: 12
        }}>
          <Icon name={iconName} size={22} color={currentThemeColors.primary || "#1DB954"} />
        </View>
        <PlainText text={text} style={{ fontWeight: '600', fontSize: 16 }} />
      </View>
      <Dropdown
        placeholder={placeholder}
        placeholderStyle={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}
        itemTextStyle={{ color: 'white' }}
        selectedTextStyle={{ color: currentThemeColors.primary || '#1DB954', fontSize: 14, fontWeight: '900' }}
        containerStyle={{
          backgroundColor: '#1a1a1a',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
        activeColor="rgba(255,255,255,0.05)"
        style={{ width: 100 }}
        data={data}
        labelField="value"
        valueField="value"
        onChange={OnChange}
      />
    </Animated.View>
  );
}

import Context, { ThemeContext } from "../../Context/Context";

export const SettingsPage = ({ navigation }) => {
  const { setFontSize, setTheme, currentThemeColors } = useContext(ThemeContext);
  const { activeTrack } = useContext(Context);
  const [Font, setFont] = useState('Medium');
  const [Playback, setPlayback] = useState('320kbps');
  const [Download, setDownload] = useState('Music');
  const [Theme, setThemeState] = useState('Default');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const appVersion = DeviceInfo.getVersion();

  const FontSize = [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }];
  const PlaybackQuality = [{ value: '96kbps' }, { value: '160kbps' }, { value: '320kbps' }];
  const DownloadPath = [{ value: 'Music' }, { value: 'Downloads' }];
  const Themes = [
    { value: 'Default' }, { value: 'Dark' }, { value: 'Blue' },
    { value: 'Purple' }, { value: 'Green' }, { value: 'Red' },
    { value: 'Orange' }, { value: 'Pink' }, { value: 'Teal' },
    { value: 'Amoled' }, { value: 'Sky' }, { value: 'Midnight' }
  ];

  const loadData = useCallback(async () => {
    setFont(await GetFontSizeValue());
    setPlayback(await GetPlaybackQuality());
    setDownload(await GetDownloadPath());
    setThemeState(await GetTheme());
  }, []);

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await updateService.checkForUpdate(true); // Force check
      if (result.updateAvailable) {
        Alert.alert(
          'Update Available',
          `Version ${result.latestVersion} is available!\n\n${result.message}`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Download', onPress: () => updateService.openUpdateLink(result.url) }
          ]
        );
      } else {
        ToastAndroid.show('You have the latest version!', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('Update check failed:', error);
      ToastAndroid.show('Failed to check for updates', ToastAndroid.SHORT);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text={"Settings"} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: activeTrack ? 160 : 120 }}
        >


          <View style={styles.section}>
            <SmallText text="Playback & Storage" style={styles.sectionHeader} />
            <EachDropDownSetting
              delay={100}
              iconName="high-definition"
              text="Streaming Quality"
              placeholder={Playback}
              data={PlaybackQuality}
              currentThemeColors={currentThemeColors}
              OnChange={({ value }) => { SetPlaybackQuality(value); setPlayback(value); }}
            />
            <EachDropDownSetting
              delay={200}
              iconName="folder-music-outline"
              text="Storage Path"
              placeholder={Download}
              data={DownloadPath}
              currentThemeColors={currentThemeColors}
              OnChange={({ value }) => { SetDownloadPath(value); setDownload(value); }}
            />
            <EachSettingsButton
              delay={300}
              iconName="delete-sweep-outline"
              text="Clear Cached Data"
              subtitle="Clean search history & cache"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate("ClearCache")}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="Personalization" style={styles.sectionHeader} />
            <EachDropDownSetting
              delay={400}
              iconName="palette-outline"
              text="App Theme"
              placeholder={Theme}
              data={Themes}
              currentThemeColors={currentThemeColors}
              OnChange={({ value }) => { SetTheme(value); setTheme(value); setThemeState(value); }}
            />
            <EachDropDownSetting
              delay={500}
              iconName="format-size"
              text="Text Size"
              placeholder={Font}
              data={FontSize}
              currentThemeColors={currentThemeColors}
              OnChange={({ value }) => { SetFontSizeValue(value); setFontSize(value); setFont(value); }}
            />
            <EachSettingsButton
              delay={600}
              iconName="account-edit-outline"
              text="User Profile"
              subtitle="Change your app name"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate("ChangeName")}
            />
            <EachSettingsButton
              delay={700}
              iconName="translate"
              text="Languages"
              subtitle="Interface translations"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate("SelectLanguages")}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="Support" style={styles.sectionHeader} />
            <EachSettingsButton
              delay={800}
              iconName="information-outline"
              text="About Project"
              subtitle={`Music Aura v${appVersion}`}
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate("AboutProject")}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="App Updates" style={styles.sectionHeader} />
            <Animated.View entering={FadeInRight.delay(900).duration(400)}>
              <TouchableOpacity 
                onPress={isCheckingUpdate ? undefined : checkForUpdates}
                disabled={isCheckingUpdate}
                style={{
                  backgroundColor: currentThemeColors.secondaryBackground || "rgba(255,255,255,0.05)",
                  padding: 20,
                  borderRadius: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  elevation: 2,
                  opacity: isCheckingUpdate ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flex: 1 }}>
                  <View style={{
                    backgroundColor: "rgba(29,185,84,0.15)",
                    padding: 12,
                    borderRadius: 12
                  }}>
                    <Icon name="update" size={24} color="#1DB954" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PlainText text={`Version ${appVersion}`} style={{ fontWeight: '700', fontSize: 16 }} />
                    <SmallText text="Tap to check for updates" style={{ opacity: 0.5, marginTop: 4 }} />
                  </View>
                </View>
                {isCheckingUpdate ? (
                  <ActivityIndicator size="small" color="#1DB954" />
                ) : (
                  <View style={{
                    backgroundColor: "rgba(29,185,84,0.2)",
                    padding: 8,
                    borderRadius: 10
                  }}>
                    <Icon name="download" size={22} color="#1DB954" />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(1000)} style={styles.footer}>
            <PlainText text="Built with ❤️ for Music Lovers" style={{ opacity: 0.3, fontSize: 12 }} />
          </Animated.View>
        </ScrollView>
      </PaddingConatiner>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '900',
    color: '#1DB954',
    marginBottom: 12,
    marginLeft: 4,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
    paddingBottom: 20,
  }
});
