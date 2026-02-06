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
import {PlainText} from '../../Component/Global/PlainText';
import {
  GetDownloadPath,
  GetFontSizeValue,
  GetPlaybackQuality,
  GetTheme,
} from '../../LocalStorage/AppSettings';
import {useEffect, useState, useContext, useCallback} from 'react';
import {SmallText} from '../../Component/Global/SmallText';
import DeviceInfo from 'react-native-device-info';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import Animated, {FadeInDown, FadeInRight} from 'react-native-reanimated';


import updateService from '../../Utils/UpdateService';





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

import {ThemeContext} from '../../Context/Context';

export const SettingsPage = ({navigation}) => {
  const {currentThemeColors} = useContext(ThemeContext);
  const [Font, setFont] = useState('Medium');
  const [Playback, setPlayback] = useState('320kbps');
  const [Download, setDownload] = useState('Music');
  const [Theme, setThemeState] = useState('Default');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const appVersion = DeviceInfo.getVersion();

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

  useEffect(() => {
    loadData();
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
