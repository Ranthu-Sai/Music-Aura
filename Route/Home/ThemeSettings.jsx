import React, {useState, useEffect, useContext, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {MainWrapper} from '../../Layout/MainWrapper';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {Heading} from '../../Component/Global/Heading';
import {PlainText} from '../../Component/Global/PlainText';
import {SmallText} from '../../Component/Global/SmallText';
import {ThemeContext} from '../../Context/Context';
import {GetTheme, SetTheme} from '../../LocalStorage/AppSettings';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {FadeInRight} from 'react-native-reanimated';

const ThemeOption = ({
  label,
  description,
  colorPreview,
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
          styles.themeCard,
          {
            backgroundColor:
              currentThemeColors.secondaryBackground || 'rgba(255,255,255,0.05)',
            borderColor: isSelected
              ? currentThemeColors.primary || '#1DB954'
              : 'transparent',
            borderWidth: isSelected ? 2 : 0,
          },
        ]}>
        <View style={styles.themeContent}>
          <View style={styles.colorPreview}>
            <View
              style={[
                styles.colorCircle,
                {backgroundColor: colorPreview},
              ]}
            />
          </View>
          <View style={styles.themeText}>
            <PlainText text={label} style={{fontWeight: '700', fontSize: 16}} />
            <SmallText
              text={description}
              style={{opacity: 0.6, marginTop: 2}}
            />
          </View>
          {isSelected && (
            <Icon
              name="check-circle"
              size={24}
              color={currentThemeColors.primary || '#1DB954'}
            />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ThemeSettings = ({navigation}) => {
  const {setTheme, currentThemeColors} = useContext(ThemeContext);
  const [selectedTheme, setSelectedTheme] = useState('Default');

  const themes = [
    {value: 'Dark', label: 'Dark', description: 'Pure dark theme', color: '#1a1a1a'},
    {value: 'Amoled', label: 'Amoled', description: 'True black for OLED', color: '#000000'},
    {value: 'White', label: 'White', description: 'Light mode', color: '#ffffff'},
    {value: 'Blue', label: 'Blue', description: 'Ocean vibes', color: '#1E88E5'},
    {value: 'Purple', label: 'Purple', description: 'Royal elegance', color: '#8E24AA'},
    {value: 'Pink', label: 'Pink', description: 'Vibrant pink', color: '#E91E63'},
    {value: 'Red', label: 'Red', description: 'Bold and passionate', color: '#F44336'},
    {value: 'Orange', label: 'Orange', description: 'Warm and energetic', color: '#FF9800'},
    {value: 'Green', label: 'Green', description: 'Nature inspired', color: '#4CAF50'},
    {value: 'Teal', label: 'Teal', description: 'Calm and fresh', color: '#009688'},
    {value: 'Sky', label: 'Sky', description: 'Light blue', color: '#03A9F4'},
    {value: 'Midnight', label: 'Midnight', description: 'Deep blue night', color: '#1a237e'},
  ];

  const loadTheme = useCallback(async () => {
    const theme = await GetTheme();
    setSelectedTheme(theme);
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const handleThemeSelect = async themeValue => {
    await SetTheme(themeValue);
    setTheme(themeValue);
    setSelectedTheme(themeValue);
  };

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text="App Theme" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 100}}>
          <View style={styles.infoCard}>
            <Icon
              name="palette-outline"
              size={24}
              color={currentThemeColors.primary || '#1DB954'}
            />
            <SmallText
              text="Choose a theme that matches your style"
              style={{opacity: 0.7, marginLeft: 12, flex: 1}}
            />
          </View>

          <View style={styles.section}>
            {themes.map((theme, index) => (
              <ThemeOption
                key={theme.value}
                label={theme.label}
                description={theme.description}
                colorPreview={theme.color}
                isSelected={selectedTheme === theme.value}
                onPress={() => handleThemeSelect(theme.value)}
                currentThemeColors={currentThemeColors}
                delay={40 * (index + 1)}
              />
            ))}
          </View>
        </ScrollView>
      </PaddingConatiner>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(29,185,84,0.08)',
    borderRadius: 14,
    marginTop: 10,
    marginBottom: 20,
  },
  section: {
    gap: 10,
  },
  themeCard: {
    padding: 16,
    borderRadius: 14,
    elevation: 2,
  },
  themeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  colorPreview: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  themeText: {
    flex: 1,
  },
});
