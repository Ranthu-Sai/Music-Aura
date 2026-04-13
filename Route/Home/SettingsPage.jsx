import {Heading} from '../../Component/Global/Heading';
import {MainWrapper} from '../../Layout/MainWrapper';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {
  Pressable,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {List, Modal, Portal, Text, TouchableRipple} from 'react-native-paper';
import {PlainText} from '../../Component/Global/PlainText';
import {
  GetDownloadPath,
  GetFontSizeValue,
  GetHomeFeedSource,
  GetPlaybackQuality,
  SetHomeFeedSource,
  GetTheme,
  GetYtMusicLanguage,
  GetYtMusicCountry,
  SetYtMusicLanguage,
  SetYtMusicCountry,
} from '../../LocalStorage/AppSettings';
import {useEffect, useState, useContext, useCallback} from 'react';
import {SmallText} from '../../Component/Global/SmallText';
import DeviceInfo from 'react-native-device-info';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import Animated, {FadeInDown, FadeInRight} from 'react-native-reanimated';


import updateService from '../../Utils/UpdateService';
import ytAuthService from '../../Utils/YouTubeAuthService';
import YouTubeAccountModal from '../../Component/Modals/YouTubeAccountModal';
import {useTheme} from '@react-navigation/native';

const EachSettingsButton = ({
  text,
  subtitle,
  OnPress,
  currentThemeColors,
  iconName,
  delay = 0,
}) => {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)}>
      <Pressable
        onPress={OnPress}
        style={({pressed}) => [
          {
            backgroundColor:
              currentThemeColors.secondaryBackground ||
              'rgba(255,255,255,0.05)',
            padding: 16,
            borderRadius: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            opacity: pressed ? 0.8 : 1,
            transform: [{scale: pressed ? 0.98 : 1}],
            elevation: pressed ? 0 : 2,
          },
        ]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            flex: 1,
          }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              padding: 12,
              borderRadius: 12,
            }}>
            <Icon
              name={iconName}
              size={22}
              color={currentThemeColors.primary || '#1DB954'}
            />
          </View>
          <View style={{flex: 1}}>
            <PlainText text={text} style={{fontWeight: '600', fontSize: 16}} />
            {subtitle && (
              <SmallText text={subtitle} style={{opacity: 0.5, marginTop: 2}} />
            )}
          </View>
        </View>
        <Icon
          name="chevron-right"
          size={24}
          color={currentThemeColors?.secondaryText || 'rgba(0,0,0,0.3)'}
          opacity={0.6}
        />
      </Pressable>
    </Animated.View>
  );
};

const DropDownMenu = ({title, icon, data, selectedValue, onSelect}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const theme = useTheme();
  const {colors} = useTheme();

  const selectedOption = data.find(item => item.value === selectedValue) || {};
  const displayValue = selectedOption.label || selectedValue;

  const handleSelect = value => {
    onSelect(value);
    setShowDropdown(false);
  };

  return (
    <View>
      <TouchableRipple
        onPress={() => setShowDropdown(!showDropdown)}
        rippleColor={
          theme.dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)'
        }
        style={{paddingHorizontal: 16, paddingVertical: 12}}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <List.Icon
              icon={icon}
              color={colors.primary}
              style={{margin: 0, marginRight: 16}}
            />
            <Text style={{color: colors.text, fontSize: 16, fontWeight: 'bold'}}>
              {title}
            </Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{color: colors.text, marginRight: 8, opacity: 0.7}}>
              {displayValue}
            </Text>
            <List.Icon
              icon={showDropdown ? 'menu-up' : 'menu-down'}
              color={colors.text}
              style={{opacity: 0.7}}
            />
          </View>
        </View>
      </TouchableRipple>

      <Portal>
        <Modal
          visible={showDropdown}
          onDismiss={() => setShowDropdown(false)}
          contentContainerStyle={{
            backgroundColor: colors.card,
            margin: 20,
            padding: 20,
            borderRadius: 8,
            elevation: 4,
            maxHeight: '80%',
          }}>
          <ScrollView showsVerticalScrollIndicator={true}>
            {data.map(item => (
              <View
                key={item.value}
                style={{
                  padding: 12,
                  backgroundColor:
                    item.value === selectedValue
                      ? colors.primary + '20'
                      : 'transparent',
                  borderRadius: 4,
                  marginVertical: 2,
                }}>
                <TouchableRipple
                  onPress={() => handleSelect(item.value)}
                  rippleColor="rgba(0, 0, 0, 0.1)"
                  style={{padding: 8, borderRadius: 4}}>
                  <Text
                    style={{
                      color:
                        item.value === selectedValue
                          ? colors.primary
                          : colors.text,
                      fontSize: 16,
                      fontWeight: item.value === selectedValue ? '600' : '400',
                    }}>
                    {item.label || item.value}
                  </Text>
                </TouchableRipple>
              </View>
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

import {ThemeContext} from '../../Context/Context';

export const SettingsPage = ({navigation}) => {
  const {currentThemeColors} = useContext(ThemeContext);
  const [Font, setFont] = useState('Medium');
  const [Playback, setPlayback] = useState('320kbps');
  const [Download, setDownload] = useState('Music');
  const [Theme, setThemeState] = useState('Default');
  const [homeFeedSource, setHomeFeedSource] = useState('Saavn');
  const [ytMusicLanguage, setYtMusicLanguage] = useState('en-IN');
  const [ytMusicCountry, setYtMusicCountry] = useState('IN');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const appVersion = DeviceInfo.getVersion();

  // YouTube auth state
  const [ytUser, setYtUser] = useState(null);
  const [isYtAuth, setIsYtAuth] = useState(false);
  const [showYtAccountModal, setShowYtAccountModal] = useState(false);

  const loadData = useCallback(async () => {
    setFont(await GetFontSizeValue());
    setPlayback(await GetPlaybackQuality());
    setDownload(await GetDownloadPath());
    setThemeState(await GetTheme());
    setHomeFeedSource(await GetHomeFeedSource());
    setYtMusicLanguage(await GetYtMusicLanguage());
    setYtMusicCountry(await GetYtMusicCountry());
  }, []);

  const handleHomeFeedSourceChange = async nextSource => {
    const saved = await SetHomeFeedSource(nextSource);
    if (saved) {
      setHomeFeedSource(nextSource);
      ToastAndroid.show(
        `Home feed source set to ${nextSource}`,
        ToastAndroid.SHORT,
      );
    } else {
      ToastAndroid.show('Failed to update home feed source', ToastAndroid.SHORT);
    }
  };

  const handleYtMusicLanguageChange = async nextLanguage => {
    const saved = await SetYtMusicLanguage(nextLanguage);
    if (saved) {
      setYtMusicLanguage(nextLanguage);
      ToastAndroid.show(
        `YTMusic language set to ${nextLanguage}`,
        ToastAndroid.SHORT,
      );
    } else {
      ToastAndroid.show('Failed to update YTMusic language', ToastAndroid.SHORT);
    }
  };

  const handleYtMusicCountryChange = async nextCountry => {
    const saved = await SetYtMusicCountry(nextCountry);
    if (saved) {
      setYtMusicCountry(nextCountry);
      ToastAndroid.show(
        `YTMusic region set to ${nextCountry}`,
        ToastAndroid.SHORT,
      );
    } else {
      ToastAndroid.show('Failed to update YTMusic region', ToastAndroid.SHORT);
    }
  };

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await updateService.checkForUpdate(true); // Force check
      if (result && result.updateAvailable) {
        Alert.alert(
          'Update Available',
          `Version ${result.latestVersion} is available!\n\n${result.message || 'New features and improvements'}`,
          [
            {text: 'Later', style: 'cancel'},
            {
              text: 'Download',
              onPress: () => {
                if (result.url) {
                  updateService.openUpdateLink(result.url);
                } else {
                  ToastAndroid.show('Update link not available', ToastAndroid.SHORT);
                }
              },
            },
          ],
        );
      } else {
        ToastAndroid.show('You have the latest version!', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('Update check failed:', error);
      ToastAndroid.show(
        'Could not check for updates. Please check your internet connection.',
        ToastAndroid.LONG,
      );
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleYtLogout = async () => {
    try {
      const result = await ytAuthService.logout();
      if (result.success) {
        ToastAndroid.show('Logged out from YouTube Music', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('YouTube Logout error:', error);
    }
  };

  useEffect(() => {
    loadData();
    // Initialize YouTube auth service
    ytAuthService.init().then(() => {
      setYtUser(ytAuthService.getUser());
      setIsYtAuth(ytAuthService.isAuth());
    });

    // Listen for YouTube Auth changes
    const ytAuthListener = (state) => {
      setYtUser(state.user);
      setIsYtAuth(state.isAuthenticated);
    };

    ytAuthService.addListener(ytAuthListener);

    return () => {
      ytAuthService.removeListener(ytAuthListener);
    };
  }, [loadData]);

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text={'Settings'} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 120}}>
          <View style={styles.section}>
            <SmallText text="Playback & Storage" style={styles.sectionHeader} />
            <EachSettingsButton
              delay={100}
              iconName="high-definition"
              text="Streaming Quality"
              subtitle={`Current: ${Playback}`}
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('QualitySettings')}
            />
            <EachSettingsButton
              delay={200}
              iconName="folder-music-outline"
              text="Storage & Display"
              subtitle={`Downloads: ${Download} · Text: ${Font}`}
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('StorageSettings')}
            />
            <EachSettingsButton
              delay={300}
              iconName="delete-sweep-outline"
              text="Clear Cached Data"
              subtitle="Clean search history & cache"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('ClearCache')}
            />
            <DropDownMenu
              title="Home Feed Source"
              icon="home-variant"
              data={[
                {label: 'Saavn', value: 'Saavn'},
                {label: 'YTMusic', value: 'YTMusic'},
              ]}
              selectedValue={homeFeedSource}
              onSelect={handleHomeFeedSourceChange}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="Personalization" style={styles.sectionHeader} />
            <EachSettingsButton
              delay={400}
              iconName="palette-outline"
              text="App Theme"
              subtitle={`Current: ${Theme}`}
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('ThemeSettings')}
            />
            <EachSettingsButton
              delay={500}
              iconName="account-edit-outline"
              text="User Profile"
              subtitle="Change your app name"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('ChangeName')}
            />
            <EachSettingsButton
              delay={600}
              iconName="translate"
              text="Languages"
              subtitle="Interface translations"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('SelectLanguages')}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="YouTube Music" style={styles.sectionHeader} />
            <DropDownMenu
              title="YTMusic Language"
              icon="translate"
              data={[
                {label: 'English (India)', value: 'en-IN'},
                {label: 'Hindi', value: 'hi'},
                {label: 'Tamil', value: 'ta'},
                {label: 'Telugu', value: 'te'},
                {label: 'Kannada', value: 'kn'},
                {label: 'Malayalam', value: 'ml'},
                {label: 'Bengali', value: 'bn'},
              ]}
              selectedValue={ytMusicLanguage}
              onSelect={handleYtMusicLanguageChange}
            />
            <DropDownMenu
              title="YTMusic Region"
              icon="earth"
              data={[
                {label: 'India', value: 'IN'},
                {label: 'United States', value: 'US'},
                {label: 'United Kingdom', value: 'GB'},
                {label: 'Canada', value: 'CA'},
                {label: 'Australia', value: 'AU'},
                {label: 'Germany', value: 'DE'},
                {label: 'France', value: 'FR'},
                {label: 'Japan', value: 'JP'},
                {label: 'South Korea', value: 'KR'},
                {label: 'Brazil', value: 'BR'},
                {label: 'Mexico', value: 'MX'},
                {label: 'Italy', value: 'IT'},
                {label: 'Spain', value: 'ES'},
                {label: 'Russia', value: 'RU'},
                {label: 'Netherlands', value: 'NL'},
                {label: 'Poland', value: 'PL'},
              ]}
              selectedValue={ytMusicCountry}
              onSelect={handleYtMusicCountryChange}
            />
            <Animated.View entering={FadeInRight.delay(700).duration(400)}>
              <Pressable
                onPress={() => setShowYtAccountModal(true)}
                style={({pressed}) => [
                  {
                    backgroundColor:
                      currentThemeColors.secondaryBackground ||
                      'rgba(255,255,255,0.05)',
                    padding: 16,
                    borderRadius: 16,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{scale: pressed ? 0.98 : 1}],
                    elevation: pressed ? 0 : 2,
                  },
                ]}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    flex: 1,
                  }}>
                  <View
                    style={{
                      backgroundColor: 'rgba(255,0,0,0.15)',
                      padding: 12,
                      borderRadius: 12,
                    }}>
                    <Icon
                      name={isYtAuth ? 'account-circle' : 'youtube'}
                      size={22}
                      color="#FF0000"
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <PlainText
                      text={
                        isYtAuth
                          ? ytUser?.name || 'YouTube User'
                          : 'Login to YouTube Music'
                      }
                      style={{fontWeight: '600', fontSize: 16}}
                    />
                    <SmallText
                      text={
                        isYtAuth
                          ? ytUser?.handle
                            ? ytUser.handle + ' • Signed in'
                            : 'Signed in • Tap to manage account'
                          : 'Login to access personalized content and bypass restrictions'
                      }
                      style={{opacity: 0.5, marginTop: 2}}
                    />
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={24}
                  color={currentThemeColors?.secondaryText || 'rgba(0,0,0,0.3)'}
                  opacity={0.6}
                />
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.section}>
            <SmallText text="Support" style={styles.sectionHeader} />
            <EachSettingsButton
              delay={700}
              iconName="information-outline"
              text="About Project"
              subtitle="App information and credits"
              currentThemeColors={currentThemeColors}
              OnPress={() => navigation.navigate('AboutProject')}
            />
          </View>

          <View style={styles.section}>
            <SmallText text="App Updates" style={styles.sectionHeader} />
            <Animated.View entering={FadeInRight.delay(800).duration(400)}>
              <TouchableOpacity
                onPress={isCheckingUpdate ? undefined : checkForUpdates}
                disabled={isCheckingUpdate}
                style={{
                  backgroundColor:
                    currentThemeColors.secondaryBackground ||
                    'rgba(255,255,255,0.05)',
                  padding: 20,
                  borderRadius: 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  elevation: 2,
                  opacity: isCheckingUpdate ? 0.7 : 1,
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    flex: 1,
                  }}>
                  <View
                    style={{
                      backgroundColor: 'rgba(29,185,84,0.15)',
                      padding: 12,
                      borderRadius: 12,
                    }}>
                    <Icon name="update" size={24} color="#1DB954" />
                  </View>
                  <View style={{flex: 1}}>
                    <PlainText
                      text={`Version ${appVersion}`}
                      style={{fontWeight: '700', fontSize: 16}}
                    />
                    <SmallText
                      text="Tap to check for updates"
                      style={{opacity: 0.5, marginTop: 4}}
                    />
                  </View>
                </View>
                {isCheckingUpdate ? (
                  <ActivityIndicator size="small" color="#1DB954" />
                ) : (
                  <View
                    style={{
                      backgroundColor: 'rgba(29,185,84,0.2)',
                      padding: 8,
                      borderRadius: 10,
                    }}>
                    <Icon name="download" size={22} color="#1DB954" />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View
            entering={FadeInDown.delay(900)}
            style={styles.footer}>
            <PlainText
              text="Built with ❤️ for Music Lovers"
              style={{opacity: 0.3, fontSize: 12}}
            />
          </Animated.View>
        </ScrollView>
      </PaddingConatiner>

      {/* YouTube Account Modal */}
      <YouTubeAccountModal
        visible={showYtAccountModal}
        onDismiss={() => setShowYtAccountModal(false)}
        user={ytUser}
        onLogout={handleYtLogout}
        onLogin={() => navigation.navigate('LoginScreen')}
        onRefresh={() => navigation.navigate('LoginScreen')}
      />
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
    marginBottom: 20,
    alignItems: 'center',
    paddingBottom: 30,
  },
});
