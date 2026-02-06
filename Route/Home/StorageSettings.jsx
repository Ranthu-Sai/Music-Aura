import React, {useState, useEffect, useContext, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, ScrollView, ToastAndroid} from 'react-native';
import {MainWrapper} from '../../Layout/MainWrapper';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {Heading} from '../../Component/Global/Heading';
import {PlainText} from '../../Component/Global/PlainText';
import {SmallText} from '../../Component/Global/SmallText';
import {ThemeContext} from '../../Context/Context';
import {GetDownloadPath, SetDownloadPath, GetFontSizeValue, SetFontSizeValue} from '../../LocalStorage/AppSettings';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {FadeInRight} from 'react-native-reanimated';

const StorageOption = ({
  label,
  description,
  path,
  isSelected,
  onPress,
  currentThemeColors,
  delay,
  iconName,
}) => {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)}>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.optionCard,
          {
            backgroundColor:
              currentThemeColors.secondaryBackground || 'rgba(255,255,255,0.05)',
            borderColor: isSelected
              ? currentThemeColors.primary || '#1DB954'
              : 'transparent',
            borderWidth: isSelected ? 2 : 0,
          },
        ]}>
        <View style={styles.optionContent}>
          <View style={styles.optionLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isSelected
                    ? `${currentThemeColors.primary || '#1DB954'}22`
                    : 'rgba(255,255,255,0.08)',
                },
              ]}>
              <Icon
                name={iconName}
                size={24}
                color={
                  isSelected
                    ? currentThemeColors.primary || '#1DB954'
                    : currentThemeColors.secondaryText || '#888'
                }
              />
            </View>
            <View style={styles.optionText}>
              <PlainText
                text={label}
                style={{fontWeight: '700', fontSize: 17}}
              />
              <SmallText
                text={description}
                style={{opacity: 0.6, marginTop: 4}}
              />
              <SmallText
                text={path}
                style={{
                  opacity: 0.4,
                  marginTop: 2,
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
              />
            </View>
          </View>
          {isSelected && (
            <Icon
              name="check-circle"
              size={26}
              color={currentThemeColors.primary || '#1DB954'}
            />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const FontSizeOption = ({
  label,
  example,
  isSelected,
  onPress,
  currentThemeColors,
  delay,
}) => {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)}>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.fontCard,
          {
            backgroundColor:
              currentThemeColors.secondaryBackground || 'rgba(255,255,255,0.05)',
            borderColor: isSelected
              ? currentThemeColors.primary || '#1DB954'
              : 'transparent',
            borderWidth: isSelected ? 2 : 0,
          },
        ]}>
        <View style={styles.fontContent}>
          <PlainText text={label} style={{fontWeight: '700', fontSize: 16}} />
          <PlainText
            text={example}
            style={{
              marginTop: 8,
              opacity: 0.6,
              fontSize: label === 'Small' ? 14 : label === 'Medium' ? 16 : 18,
            }}
          />
        </View>
        {isSelected && (
          <Icon
            name="check-circle"
            size={24}
            color={currentThemeColors.primary || '#1DB954'}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const StorageSettings = ({navigation}) => {
  const {currentThemeColors, setFontSize} = useContext(ThemeContext);
  const [selectedPath, setSelectedPath] = useState('Music');
  const [selectedFontSize, setSelectedFontSize] = useState('Medium');

  const storagePaths = [
    {
      value: 'Music',
      label: 'Music Folder',
      description: 'Organized in Music directory',
      path: '/storage/emulated/0/Music',
      icon: 'folder-music',
    },
    {
      value: 'Downloads',
      label: 'Downloads Folder',
      description: 'Save to Downloads directory',
      path: '/storage/emulated/0/Download',
      icon: 'folder-download',
    },
  ];

  const fontSizes = [
    {value: 'Small', label: 'Small', example: 'Compact text size'},
    {value: 'Medium', label: 'Medium', example: 'Standard text size'},
    {value: 'Large', label: 'Large', example: 'Easy to read'},
  ];

  const loadSettings = useCallback(async () => {
    const path = await GetDownloadPath();
    const font = await GetFontSizeValue();
    setSelectedPath(path);
    setSelectedFontSize(font);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handlePathSelect = async path => {
    await SetDownloadPath(path);
    setSelectedPath(path);
    ToastAndroid.show(`Storage location set to ${path}`, ToastAndroid.SHORT);
  };

  const handleFontSelect = async size => {
    await SetFontSizeValue(size);
    setFontSize(size);
    setSelectedFontSize(size);
    ToastAndroid.show(`Text size changed to ${size}`, ToastAndroid.SHORT);
  };

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text="Storage & Display" />
        <ScrollView
          showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 100}}>
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon
                name="folder-outline"
                size={20}
                color={currentThemeColors.primary || '#1DB954'}
              />
              <PlainText
                text="Download Location"
                style={{
                  fontWeight: '900',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginLeft: 8,
                  color: currentThemeColors.primary || '#1DB954',
                }}
              />
            </View>
            <SmallText
              text="Choose where downloaded songs are saved"
              style={{opacity: 0.5, marginBottom: 12, marginLeft: 4}}
            />
            <View style={styles.section}>
              {storagePaths.map((path, index) => (
                <StorageOption
                  key={path.value}
                  label={path.label}
                  description={path.description}
                  path={path.path}
                  iconName={path.icon}
                  isSelected={selectedPath === path.value}
                  onPress={() => handlePathSelect(path.value)}
                  currentThemeColors={currentThemeColors}
                  delay={100 * (index + 1)}
                />
              ))}
            </View>
          </View>

          {/* Font Size Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon
                name="format-size"
                size={20}
                color={currentThemeColors.primary || '#1DB954'}
              />
              <PlainText
                text="Text Size"
                style={{
                  fontWeight: '900',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginLeft: 8,
                  color: currentThemeColors.primary || '#1DB954',
                }}
              />
            </View>
            <SmallText
              text="Adjust text size throughout the app"
              style={{opacity: 0.5, marginBottom: 12, marginLeft: 4}}
            />
            <View style={styles.section}>
              {fontSizes.map((font, index) => (
                <FontSizeOption
                  key={font.value}
                  label={font.label}
                  example={font.example}
                  isSelected={selectedFontSize === font.value}
                  onPress={() => handleFontSelect(font.value)}
                  currentThemeColors={currentThemeColors}
                  delay={100 * (index + 3)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </PaddingConatiner>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 4,
  },
  section: {
    gap: 12,
  },
  optionCard: {
    padding: 18,
    borderRadius: 16,
    elevation: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
  },
  iconContainer: {
    padding: 10,
    borderRadius: 12,
  },
  optionText: {
    flex: 1,
  },
  fontCard: {
    padding: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },
  fontContent: {
    flex: 1,
  },
});
