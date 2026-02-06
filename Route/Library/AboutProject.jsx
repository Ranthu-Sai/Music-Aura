import React, {useContext} from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {MainWrapper} from '../../Layout/MainWrapper';
import {PlainText} from '../../Component/Global/PlainText';
import {Heading} from '../../Component/Global/Heading';
import {SmallText} from '../../Component/Global/SmallText';
import {Spacer} from '../../Component/Global/Spacer';
import Context, {ThemeContext} from '../../Context/Context';



export const AboutProject = ({navigation}) => {
  const {currentThemeColors} = useContext(ThemeContext);
  const {activeTrack} = useContext(Context);

  const openURL = url => {
    if (url) {
      Linking.openURL(url).catch(err =>
        console.error("Couldn't load page", err),
      );
    }
  };

  return (
    <MainWrapper>
      {/* Custom Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="chevron-left" size={32} color={currentThemeColors.text} />
        </Pressable>
        <Heading text="About Project" nospace />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: activeTrack ? 150 : 50},
        ]}>
        {/* Developer Card */}
        <LinearGradient colors={['#1e1e1e', '#0a0a0a']} style={styles.devCard}>
          <View style={styles.profileContainer}>
            <FastImage
              source={{
                uri: 'https://res.cloudinary.com/dkpi8hona/image/upload/v1766855084/Style_eyhl64.jpg',
              }}
              style={styles.profileImage}
            />
            <View style={styles.devInfo}>
              <PlainText text="Developed By" style={styles.subLabel} />
              <Heading text="Ranthu Sai" nospace style={styles.devName} />
            </View>
          </View>

          <View style={styles.socialRow}>
            <SocialIcon
              icon="github"
              color="#333"
              onPress={() => openURL('https://github.com/Ranthu-Sai')}
            />
            <SocialIcon
              icon="linkedin"
              color="#0077b5"
              onPress={() =>
                openURL('https://www.linkedin.com/in/sai-ranthu-73b352295/')
              }
            />
            <SocialIcon
              icon="instagram"
              color="#e4405f"
              onPress={() =>
                openURL('https://www.instagram.com/s.a.i_r.a.n.t.u/')
              }
            />
          </View>
        </LinearGradient>

        <Spacer />

        {/* Community & Updates */}
        <View style={styles.sectionHeader}>
          <PlainText text="GitHub Repository" style={styles.sectionLabel} />
        </View>

        <View style={styles.communityRow}>
          <CommunityCard
            title="Music Aura"
            subTitle="Explore the codebase."
            icon="github"
            gradient={['#2c3e50', '#000000']}
            onPress={() =>
              openURL('https://github.com/Ranthu-Sai/Music-Aura.git')
            }
          />
        </View>

        <Spacer />

        {/* Feature & Bug */}
        <View style={styles.sectionHeader}>
          <PlainText text="Help make it better" style={styles.sectionLabel} />
        </View>

        <Pressable
          onPress={() => openURL('mailto:saiyadav4719@gmail.com')}
          style={({pressed}) => [
            styles.bugCard,
            {
              opacity: pressed ? 0.9 : 1,
              transform: [{scale: pressed ? 0.98 : 1}],
            },
          ]}>
          <LinearGradient
            colors={['#4b1212', '#1a0505']}
            style={styles.bugGradient}>
            <View style={styles.bugLeft}>
              <Icon name="bug" size={40} color="#ff5252" />
            </View>
            <View style={styles.bugRight}>
              <Heading text="Report a bug" nospace style={{fontSize: 18}} />
              <SmallText
                text="Found something wrong? Or have a feature request? Let me know via Email or Socials."
                maxLine={3}
              />
            </View>
            <Icon name="chevron-right" size={24} color="white" opacity={0.5} />
          </LinearGradient>
        </Pressable>

        <Spacer />

        <View style={styles.footer}>
          <PlainText text="Music Aura" style={styles.footerAppLogo} />
          <SmallText text="Designed for the ultimate music experience" />
          <SmallText text="© 2026 Music Aura. All rights reserved." />
        </View>

        <Spacer />
        <Spacer />
      </ScrollView>
    </MainWrapper>
  );
};

const SocialIcon = ({icon, color, onPress}) => (
  <Pressable
    onPress={onPress}
    style={({pressed}) => [
      styles.socialIconBtn,
      {
        backgroundColor: color,
        opacity: pressed ? 0.8 : 1,
        transform: [{scale: pressed ? 0.9 : 1}],
      },
    ]}>
    <Icon name={icon} size={24} color="white" />
  </Pressable>
);

const CommunityCard = ({title, subTitle, icon, gradient, onPress}) => (
  <Pressable
    onPress={onPress}
    style={({pressed}) => [
      styles.communityCard,
      {opacity: pressed ? 0.9 : 1, transform: [{scale: pressed ? 0.98 : 1}]},
    ]}>
    <LinearGradient colors={gradient} style={styles.communityGradient}>
      <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
        <Icon name={icon} size={30} color="white" />
        <View style={{marginLeft: 15}}>
          <PlainText text={title} style={styles.cardTitle} />
          <SmallText text={subTitle} />
        </View>
      </View>
      <Icon name="chevron-right" size={24} color="white" opacity={0.5} />
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 10,
  },
  backButton: {
    padding: 5,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  devCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  profileImage: {
    height: 90,
    width: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  devInfo: {
    flex: 1,
  },
  subLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
  devName: {
    fontSize: 24,
    marginVertical: 2,
  },
  devTitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  socialIconBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  sectionHeader: {
    marginBottom: 15,
    paddingLeft: 5,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    opacity: 0.9,
  },
  communityCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  communityGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bugCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  bugGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bugLeft: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,82,82,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bugRight: {
    flex: 1,
    marginLeft: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    gap: 5,
  },
  footerAppLogo: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#888',
  },
});
