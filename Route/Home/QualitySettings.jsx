import React, {useState, useEffect, useContext, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {MainWrapper} from '../../Layout/MainWrapper';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {Heading} from '../../Component/Global/Heading';
import {PlainText} from '../../Component/Global/PlainText';
import {SmallText} from '../../Component/Global/SmallText';
import {ThemeContext} from '../../Context/Context';
import {GetPlaybackQuality, SetPlaybackQuality} from '../../LocalStorage/AppSettings';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {FadeInRight} from 'react-native-reanimated';

const QualityOption = ({
  label,
  description,
  bitrate,
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
                name={isSelected ? 'check-circle' : 'circle-outline'}
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
            </View>
          </View>
          {isSelected && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    currentThemeColors.primary || '#1DB954',
                },
              ]}>
              <SmallText
                text="ACTIVE"
                style={{
                  color: '#000',
                  fontWeight: '900',
                  fontSize: 10,
                  letterSpacing: 1,
                }}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const QualitySettings = ({navigation}) => {
  const {currentThemeColors} = useContext(ThemeContext);
  const [selectedQuality, setSelectedQuality] = useState('320kbps');

  const qualities = [
    {
      value: '96kbps',
      label: 'Low Quality',
      description: 'Saves data · 96 kbps',
      bitrate: '96kbps',
    },
    {
      value: '160kbps',
      label: 'Medium Quality',
      description: 'Balanced quality & data · 160 kbps',
      bitrate: '160kbps',
    },
    {
      value: '320kbps',
      label: 'High Quality',
      description: 'Best sound quality · 320 kbps',
      bitrate: '320kbps',
    },
  ];

  const loadQuality = useCallback(async () => {
    const quality = await GetPlaybackQuality();
    setSelectedQuality(quality);
  }, []);

  useEffect(() => {
    loadQuality();
  }, [loadQuality]);

  const handleQualitySelect = async quality => {
    await SetPlaybackQuality(quality);
    setSelectedQuality(quality);
  };

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text="Streaming Quality" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 100}}>
          <View style={styles.infoCard}>
            <View
              style={[
                styles.infoIcon,
                {backgroundColor: `${currentThemeColors.primary || '#1DB954'}22`},
              ]}>
              <Icon
                name="information-outline"
                size={24}
                color={currentThemeColors.primary || '#1DB954'}
              />
            </View>
            <SmallText
              text="Higher quality uses more data. Changes apply to new streams."
              style={{opacity: 0.7, lineHeight: 20, flex: 1}}
            />
          </View>

          <View style={styles.section}>
            {qualities.map((quality, index) => (
              <QualityOption
                key={quality.value}
                label={quality.label}
                description={quality.description}
                bitrate={quality.bitrate}
                isSelected={selectedQuality === quality.value}
                onPress={() => handleQualitySelect(quality.value)}
                currentThemeColors={currentThemeColors}
                delay={100 * (index + 1)}
              />
            ))}
          </View>

          <View style={styles.footer}>
            <SmallText
              text="Note: Downloaded songs maintain their original quality"
              style={{opacity: 0.4, textAlign: 'center', fontSize: 12}}
            />
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
    gap: 14,
    padding: 16,
    backgroundColor: 'rgba(29,185,84,0.08)',
    borderRadius: 14,
    marginTop: 10,
    marginBottom: 20,
  },
  infoIcon: {
    padding: 10,
    borderRadius: 10,
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
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconContainer: {
    padding: 10,
    borderRadius: 12,
  },
  optionText: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
});
