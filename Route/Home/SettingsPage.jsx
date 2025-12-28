import { Heading } from "../../Component/Global/Heading";
import { MainWrapper } from "../../Layout/MainWrapper";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { Pressable, ScrollView, ToastAndroid, View, StyleSheet } from "react-native";
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
import { useEffect, useState, useContext } from "react";
import { SmallText } from "../../Component/Global/SmallText";
import DeviceInfo from "react-native-device-info";
import Context from "../../Context/Context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import LinearGradient from "react-native-linear-gradient";

const EachSettingsButton = ({ text, OnPress, currentThemeColors, iconName }) => {
  return (
    <Pressable onPress={OnPress} style={({ pressed }) => [
      {
        backgroundColor: currentThemeColors.secondaryBackground,
        padding: 15,
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        elevation: 2,
      }
    ]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
        <View style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 10,
          borderRadius: 10
        }}>
          <Icon name={iconName} size={24} color={currentThemeColors.text} />
        </View>
        <PlainText text={text} style={{ fontWeight: '500' }} />
      </View>
      <Icon name="chevron-right" size={24} color={currentThemeColors.text} opacity={0.5} />
    </Pressable>
  );
}

const EachDropDownWithLabel = ({ data, text, placeholder, OnChange, currentThemeColors, iconName }) => {
  return (
    <View style={{
      backgroundColor: currentThemeColors.secondaryBackground,
      padding: 15,
      borderRadius: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      elevation: 2,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
        <View style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 10,
          borderRadius: 10
        }}>
          <Icon name={iconName} size={24} color={currentThemeColors.text} />
        </View>
        <PlainText text={text} style={{ fontWeight: '500' }} />
      </View>
      <Dropdown
        placeholder={placeholder}
        placeholderStyle={{ color: currentThemeColors.text, fontSize: 14 }}
        itemTextStyle={{ color: currentThemeColors.secondaryText }}
        containerStyle={{
          backgroundColor: currentThemeColors.secondaryBackground,
          borderRadius: 8,
          borderWidth: 0,
        }}
        selectedTextStyle={{ color: currentThemeColors.text, fontSize: 14, fontWeight: 'bold' }}
        style={{ width: 100 }}
        data={data}
        labelField="value"
        valueField="value"
        onChange={OnChange}
      />
    </View>
  );
}

export const SettingsPage = ({ navigation }) => {
  const { setFontSize, theme, setTheme, currentThemeColors } = useContext(Context);
  const [Font, setFont] = useState('Medium');
  const [Playback, setPlayback] = useState('320kbps');
  const [Download, setDownload] = useState('Music');
  const [Theme, setThemeState] = useState('Default');

  const FontSize = [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }];
  const PlaybackQuality = [
    { value: '12kbps' }, { value: '48kbps' }, { value: '96kbps' },
    { value: '160kbps' }, { value: '320kbps' }
  ];
  const DownloadPath = [{ value: 'Music' }, { value: 'Downloads' }];
  const Themes = [
    { value: 'Default' }, { value: 'Dark' }, { value: 'Blue' },
    { value: 'Purple' }, { value: 'Green' }, { value: 'Red' },
    { value: 'Orange' }, { value: 'Pink' }, { value: 'Teal' }
  ];

  useEffect(() => {
    const loadSettings = async () => {
      setFont(await GetFontSizeValue());
      setPlayback(await GetPlaybackQuality());
      setDownload(await GetDownloadPath());
      setThemeState(await GetTheme());
    };
    loadSettings();
  }, []);

  const showToast = (msg) => {
    ToastAndroid.showWithGravity(msg, ToastAndroid.SHORT, ToastAndroid.CENTER);
  };

  const updateSetting = async (setter, storageFunc, value, toastMsg) => {
    await storageFunc(value);
    setter(value);
    showToast(toastMsg);
  };

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text={"Settings"} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>

          <View style={styles.section}>
            <SmallText text="General" style={styles.sectionTitle} />
            <EachSettingsButton
              text={"Interface Languages"}
              iconName="translate"
              OnPress={() => navigation.navigate("SelectLanguages")}
              currentThemeColors={currentThemeColors}
            />
            <EachSettingsButton
              text={"Clean Cached Data"}
              iconName="trash-can-outline"
              OnPress={() => navigation.navigate("ClearCache")}
              currentThemeColors={currentThemeColors}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="Appearance & Quality" style={styles.sectionTitle} />
            <EachDropDownWithLabel
              data={Themes}
              text={"App Theme"}
              iconName="palette-outline"
              placeholder={Theme}
              OnChange={({ value }) => updateSetting(setTheme, SetTheme, value, `Theme changed to ${value}`)}
              currentThemeColors={currentThemeColors}
            />
            <EachDropDownWithLabel
              data={FontSize}
              text={"Text Size"}
              iconName="format-size"
              placeholder={Font}
              OnChange={({ value }) => {
                SetFontSizeValue(value);
                setFontSize(value);
                showToast(`Font size changed to ${value}`);
              }}
              currentThemeColors={currentThemeColors}
            />
            <EachDropDownWithLabel
              data={PlaybackQuality}
              text={"Audio Quality"}
              iconName="high-definition"
              placeholder={Playback}
              OnChange={({ value }) => updateSetting(setPlayback, SetPlaybackQuality, value, `Quality set to ${value}`)}
              currentThemeColors={currentThemeColors}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="Storage" style={styles.sectionTitle} />
            <EachDropDownWithLabel
              data={DownloadPath}
              text={"Storage Path"}
              iconName="folder-music-outline"
              placeholder={Download}
              OnChange={({ value }) => updateSetting(setDownload, SetDownloadPath, value, `Path updated to ${value}`)}
              currentThemeColors={currentThemeColors}
            />
          </View>

          <View style={{ marginTop: 20 }}>
            <LinearGradient
              colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.01)"]}
              style={styles.aboutContainer}
            >
              <Pressable
                onPress={() => navigation.navigate("AboutProject")}
                style={styles.aboutTop}
                android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
                  <Icon name="information-outline" size={24} color={currentThemeColors.text} />
                  <View>
                    <PlainText text="About Music Aura" style={{ fontWeight: 'bold' }} />
                    <SmallText text={`Finalized Release v${DeviceInfo.getVersion()}`} />
                  </View>
                </View>
                <Icon name="arrow-right" size={20} color={currentThemeColors.text} opacity={0.5} />
              </Pressable>

              <View style={styles.divider} />

              <View style={styles.aboutBottom}>
                <PlainText text="Built with ❤️ for music lovers" style={styles.credits} />
                <SmallText text="© 2025 Music Aura Project" />
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
      </PaddingConatiner>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    marginLeft: 5,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  aboutContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  aboutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
  },
  aboutBottom: {
    padding: 20,
    alignItems: 'center',
  },
  credits: {
    fontSize: 14,
    marginBottom: 5,
  }
});
