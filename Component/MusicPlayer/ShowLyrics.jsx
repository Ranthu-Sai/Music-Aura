import { Dimensions, Modal, Pressable, ScrollView, Text, View, FlatList, Share } from "react-native";
import { Heading } from "../Global/Heading";
import { Spacer } from "../Global/Spacer";
import { LoadingComponent } from "../Global/Loading";
import React, { useEffect, useRef, useCallback } from "react";
import { useTheme } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Clipboard from '@react-native-clipboard/clipboard';
import TrackPlayer, { useProgress, usePlaybackState, State } from 'react-native-track-player';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';
import { ActionsContext } from "../../Context/Context";
import { SetLyricsSettings } from "../../LocalStorage/AppSettings";

// High-performance memoized lyric line component
const LyricsLine = React.memo(({ item, index, isCurrent, isPast, fontSize, textColor, animationStyle, onPress }) => {
  return (
    <Pressable onPress={onPress} style={{
      paddingVertical: 15,
      paddingHorizontal: 10,
      minHeight: 70,
      justifyContent: 'center',
      backgroundColor: 'transparent',
    }}>
      <Text style={{
        color: isCurrent ? '#00FF88' : (textColor || 'white'),
        fontSize: isCurrent ? fontSize * 1.3 : fontSize,
        fontWeight: isCurrent ? '700' : '300',
        textAlign: "center",
        lineHeight: isCurrent ? fontSize * 1.8 : fontSize * 1.4,
        opacity: isCurrent ? 1 : (isPast ? 0.4 : 0.6),
        textShadowColor: isCurrent ? 'rgba(0, 255, 136, 0.5)' : 'transparent',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: isCurrent ? 10 : 0,
      }}>{item.text}</Text>
    </Pressable>
  );
}, (prev, next) => {
  return prev.isCurrent === next.isCurrent &&
         prev.isPast === next.isPast &&
         prev.fontSize === next.fontSize &&
         prev.textColor === next.textColor;
});

// Helper function to clean song title - extract only the core song name
const cleanSongTitle = (title) => {
  if (!title) { return 'Unknown Song'; }

  let cleaned = FormatTitleAndArtist(title);

  // Remove everything after common separators
  cleaned = cleaned
    .split(' (')[0]           // Remove (From "Album")
    .split(' [')[0]           // Remove [Version]
    .split(' - ')[0]          // Remove - Language/Version
    .split(' | ')[0]          // Remove | Artist
    .split(' feat')[0]        // Remove feat. Artist
    .split(' ft')[0]          // Remove ft. Artist
    .split(' Feat')[0]        // Remove Feat. Artist
    .split(' Ft')[0]          // Remove Ft. Artist
    .split(' with ')[0]       // Remove with Artist
    .split(' With ')[0]       // Remove With Artist
    .trim();

  return cleaned || 'Unknown Song';
};

export const ShowLyrics = ({ ShowDailog, Loading, Lyric, setShowDailog, currentSong, setLyric, setLoading }) => {
  const height = Dimensions.get("window").height
  const width = Dimensions.get("window").width
  const theme = useTheme()
  const { position } = useProgress()
  const playbackState = usePlaybackState()
  const flatListRef = useRef(null)

  const [manualIndex, setManualIndex] = React.useState(-1)
  const [isManualScrolling, setIsManualScrolling] = React.useState(false)
  const [forceTimeSynced, setForceTimeSynced] = React.useState(false)
  const [lyricsMode, setLyricsMode] = React.useState('regular') // 'regular' or 'time-synced'
  const [flatListMounted, setFlatListMounted] = React.useState(false)
  const [lastManualScrollTime, setLastManualScrollTime] = React.useState(0)
  const MANUAL_SCROLL_DELAY = 3000 // 3 seconds delay before auto-scroll resumes

  const { lyricsSettings, setLyricsSettingsState, refreshLyrics } = React.useContext(ActionsContext);
  const [showSettings, setShowSettings] = React.useState(false);

  // Dynamic Styles based on settings
  const getFontSize = React.useCallback((base) => {
    switch (lyricsSettings.fontSize) {
      case 'Small': return base * 0.8;
      case 'Large': return base * 1.2;
      case 'Extra Large': return base * 1.5;
      default: return base;
    }
  }, [lyricsSettings.fontSize]);

  const getBackgroundColor = React.useMemo(() => {
    return lyricsSettings.background || 'rgba(0,0,0,1)';
  }, [lyricsSettings.background]);

  const getTextColor = React.useCallback((isCurrent) => {
    if (isCurrent) {return '#00FF88';}
    return lyricsSettings.textColor || '#FFFFFF';
  }, [lyricsSettings.textColor]);

  const handleUpdateSetting = async (key, value) => {
    const newSettings = { ...lyricsSettings, [key]: value };
    setLyricsSettingsState(newSettings);
    await SetLyricsSettings(newSettings);

    // If source changed, auto-refresh lyrics and update parent state
    if (key === 'source') {
      try {
        setLoading(true);
        const results = await refreshLyrics(currentSong.id, currentSong.artist, currentSong.title, currentSong.language, value);
        if (results) {
          setLyric(results);
        }
      } catch (err) {
        console.error('Refresh error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Reset lyrics mode when modal closes
  useEffect(() => {
    if (!ShowDailog) {
      setLyricsMode('regular');
    }
  }, [ShowDailog]);

  // Mode change handlers
  const handleRegularMode = useCallback(() => {
    setLyricsMode('regular');
  }, []);

  const handleTimeSyncedMode = useCallback(() => {
    setLyricsMode('time-synced');
    if (Lyric?.timed_lyrics && Lyric.timed_lyrics.length > 0) {
      switchToTimeSynced();
    }
  }, [Lyric?.timed_lyrics]);

  const handleShareLyrics = async () => {
    try {
      if (!Lyric?.lyrics) {return;}
      const lyricsText = Lyric.lyrics.replaceAll("<br>", "\n");
      const songTitle = cleanSongTitle(currentSong?.title);
      const songArtist = currentSong?.artist || 'Unknown Artist';

      await Share.share({
        message: `Lyrics for ${songTitle} by ${songArtist}:\n\n${lyricsText}\n\nShared from Music Aura`,
        title: `Lyrics: ${songTitle}`,
      });
    } catch (error) {
      console.error('Error sharing lyrics:', error);
    }
  };

  // Switch to time-synced lyrics mode
  const switchToTimeSynced = () => {
    // No automatic scrolling: pinned current line will remain fixed at top
    // Users can manually scroll the list; tapping a line seeks playback.
  }


  // Resolve timed lyrics from several possible field names returned by different APIs
  const _timedSource = Lyric?.timed_lyrics || Lyric?.timedLyrics || Lyric?.synchronized_lyrics || Lyric?.synced_lyrics || Lyric?.syncedLyrics || Lyric?.sync_lyrics || Lyric?.lines || null;
  let timedLyrics = [];
  if (Array.isArray(_timedSource)) {
    timedLyrics = _timedSource;
  } else if (_timedSource && Array.isArray(_timedSource.lines)) {
    timedLyrics = _timedSource.lines;
  }

  // Only provide displayLyrics when user selected time-synced mode
  const displayLyrics = lyricsMode === 'time-synced' ? timedLyrics : null;

  const currentIndex = manualIndex >= 0 ? manualIndex : (lyricsMode === 'time-synced' && displayLyrics && displayLyrics.length > 0 ? (() => {
    const pos = position * 1000;
    // Find the current line more accurately
    for (let i = 0; i < displayLyrics.length; i++) {
      if (pos >= displayLyrics[i].start_time && pos <= displayLyrics[i].end_time) {
        return i;
      }
    }
    // If no exact match, find the closest previous line
    for (let i = displayLyrics.length - 1; i >= 0; i--) {
      if (displayLyrics[i].start_time <= pos) {
        return i;
      }
    }
    return 0;
  })() : -1)

  useEffect(() => {
    if (manualIndex >= 0) {
      // Reset manual index faster after position updates
      const timer = setTimeout(() => setManualIndex(-1), 300) // Faster reset
      return () => clearTimeout(timer)
    }
  }, [position, manualIndex])

  // Auto-scroll to keep current line centered
  useEffect(() => {
    const timeSinceManualScroll = Date.now() - lastManualScrollTime;
    const shouldAutoScroll = !isManualScrolling && timeSinceManualScroll > MANUAL_SCROLL_DELAY;

    if (lyricsMode === 'time-synced' && displayLyrics?.length > 0 && currentIndex >= 0 && flatListMounted && flatListRef.current && shouldAutoScroll) {
      try {
        flatListRef.current.scrollToIndex({
          index: currentIndex,
          animated: lyricsSettings.animation !== 'Static',
          viewPosition: 0.5,
        });
      } catch (e) {
        // Fallback for safety
        try { flatListRef.current.scrollToOffset({ offset: currentIndex * 70, animated: true }); } catch (err) {}
      }
    }
  }, [currentIndex, displayLyrics, flatListMounted, isManualScrolling, lyricsMode, lastManualScrollTime, lyricsSettings.animation]);

  const renderItem = useCallback(({ item, index }) => {
    const isCurrent = index === currentIndex;
    const isPast = index < currentIndex;
    const baseFontSize = getFontSize(width * 0.05);

    return (
      <LyricsLine
        item={item}
        index={index}
        isCurrent={isCurrent}
        isPast={isPast}
        fontSize={baseFontSize}
        textColor={lyricsSettings.textColor}
        animationStyle={lyricsSettings.animation}
        onPress={() => {
          setManualIndex(index);
          TrackPlayer.seekTo(item.start_time / 1000);
        }}
      />
    );
  }, [currentIndex, lyricsSettings.textColor, lyricsSettings.animation, width, getFontSize]);

  return (
    <Modal transparent={true} visible={ShowDailog} statusBarTranslucent={true} onRequestClose={() => setShowDailog(false)}>
      <View style={{
        backgroundColor: getBackgroundColor,
        flex: 1,
      }}>
        {/* Fixed Header */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: 55,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: getBackgroundColor,
        }}>
          <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',height: 40,marginBottom: 10}}><Text style={{color: 'white',fontSize: width * 0.04,fontWeight: '600'}}>Lyrics</Text><View style={{position: 'absolute',left: 0,right: 0,alignItems: 'center'}}><Text numberOfLines={1} ellipsizeMode="middle" style={{color: 'white',fontSize: width * 0.045,fontWeight: '600',maxWidth: width * 0.6}}>{cleanSongTitle(currentSong?.title)}</Text></View><Pressable onPress={() => setShowDailog(false)} style={{padding: 5}}><Ionicons name="close" size={30} color="white" /></Pressable></View>
          <View style={{flexDirection: 'row',justifyContent: 'center',alignItems: 'center',marginBottom: 10}}><View style={{flex: 1}} /><View style={{flexDirection: 'row'}}><Pressable onPress={handleRegularMode} style={{paddingHorizontal: 20,paddingVertical: 8,borderRadius: 20,backgroundColor: lyricsMode === 'regular' ? '#00FF88' : 'rgba(255,255,255,0.1)',marginRight: 10}}><Text style={{color: lyricsMode === 'regular' ? 'black' : 'white',fontSize: width * 0.035,fontWeight: '500'}}>Regular</Text></Pressable><Pressable onPress={handleTimeSyncedMode} style={{paddingHorizontal: 20,paddingVertical: 8,borderRadius: 20,backgroundColor: lyricsMode === 'time-synced' ? '#00FF88' : 'rgba(255,255,255,0.1)'}}><Text style={{color: lyricsMode === 'time-synced' ? 'black' : 'white',fontSize: width * 0.035,fontWeight: '500'}}>Time Synced</Text></Pressable></View><View style={{flex: 1,alignItems: 'flex-end'}}><Pressable onPress={() => setShowSettings(true)} style={{padding: 8,backgroundColor: 'rgba(255,255,255,0.08)',borderRadius: 20}}><MaterialCommunityIcons name="dots-vertical" size={20} color="white" /></Pressable></View></View>
        </View>

        {/* Scrollable Content */}
        <View style={{
          flex: 1,
          marginTop: 170, // Adjusted for lower icons
          backgroundColor: getBackgroundColor, // Ensure list background also updates
        }}>
          {Loading && <LoadingComponent loading={true} height={height - 70} />}
          {!Loading && <>
            {lyricsMode === 'time-synced' ? (
              // User explicitly chose time-synced mode - show timed lyrics or not-found message
              (displayLyrics && displayLyrics.length > 0) ? (
                <FlatList
                  ref={(ref) => {
                    flatListRef.current = ref;
                    setFlatListMounted(!!ref);
                  }}
                  data={displayLyrics}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingBottom: 300,
                    paddingTop: 20, // Reduced since header is now fixed
                  }}
                  onScrollBeginDrag={() => setIsManualScrolling(true)}
                  onScrollEndDrag={() => {
                    setIsManualScrolling(false);
                    setLastManualScrollTime(Date.now());
                  }}
                  onMomentumScrollEnd={() => {
                    setIsManualScrolling(false);
                    setLastManualScrollTime(Date.now());
                  }}
                  getItemLayout={(data, index) => ({
                    length: 70, // Updated height to match new minHeight
                    offset: 70 * index,
                    index,
                  })}
                  initialScrollIndex={0}
                  maxToRenderPerBatch={15}
                  windowSize={10}
                  removeClippedSubviews={false} // Keep all items rendered for smooth scrolling
                  scrollEventThrottle={16} // 60fps scrolling
                />
              ) : (
                <View style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingTop: 100,
                }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: width * 0.05,
                    textAlign: 'center',
                    paddingHorizontal: 20,
                  }}>
                    Time-synced lyrics not found
                  </Text>
                </View>
              )
            ) : Lyric?.lyrics ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  minHeight: height,
                  paddingTop: 20, // Reduced since header is now fixed
                }}
                onScrollBeginDrag={() => setIsManualScrolling(true)}
                onScrollEndDrag={() => setIsManualScrolling(false)}
                onMomentumScrollEnd={() => setIsManualScrolling(false)}
              >
                {/* Regular lyrics indicator */}
                <Text selectable={true} style={{
                  color: lyricsSettings.textColor || "white",
                  fontSize: getFontSize(width * 0.055),
                  fontWeight: 300,
                  paddingHorizontal: 20,
                  textAlign: "center",
                  lineHeight: getFontSize(width * 0.08),
                }}>{Lyric?.lyrics?.replaceAll("<br>", "\n")}</Text>
                <Spacer height={300} />
              </ScrollView>
            ) : (
              <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingTop: 100,
              }}>
                <Text style={{
                  color: "white",
                  fontSize: width * 0.06,
                  textAlign: 'center',
                }}>
                  {Lyric?.lyrics === "No Lyrics Found" ? "No Lyrics Found" : "Loading lyrics..."}
                </Text>
              </View>
            )}
          </>}
        </View>
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} colors={['transparent', getBackgroundColor, getBackgroundColor]} style={{ flexDirection: "row", gap: 4, position: "absolute", alignItems: "center", justifyContent: "center", height: 120, paddingTop: 70, bottom: 0, width: width + 20 }}>
          <Pressable onPress={handleShareLyrics} style={{
            flex: 1,
            backgroundColor: "rgb(255,255,255)",
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
          }}>
            <Text style={{
              color: "black",
              fontWeight: "500",
            }}>Share</Text>
          </Pressable>
          <Pressable onPress={() => Clipboard.setString(Lyric?.lyrics?.replaceAll("<br>", "\n") ?? "")} style={{
            flex: 1,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
            borderBottomRightRadius: 10,
            borderTopRightRadius: 10,
          }}>
            <Text style={{
              color: "black",
              fontWeight: "500",
            }}>Copy</Text>
          </Pressable>
        </LinearGradient>
      </View>

      {/* Lyrics Settings Bottom Sheet / Modal */}
      <Modal
        transparent
        visible={showSettings}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowSettings(false)}
        />
        <View style={{
          backgroundColor: '#0D0D0D', // Darker, cleaner box
          borderTopLeftRadius: 35,
          borderTopRightRadius: 35,
          padding: 25,
          height: height * 0.6, // Fixed relative height for 'Orbit' feel
          borderTopWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Lyrics Settings</Text>
            <Pressable onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={25} color="white" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Font Size */}
            <Text style={styles.settingLabel}>Font Size</Text>
            <View style={styles.optionsRow}>
              {['Small', 'Medium', 'Large', 'Extra'].map(size => (
                <Pressable
                  key={size}
                  onPress={() => handleUpdateSetting('fontSize', size)}
                  style={[styles.optionButton, lyricsSettings.fontSize === size && styles.activeOption]}
                >
                  <Text style={[styles.optionText, lyricsSettings.fontSize === size && styles.activeOptionText]}>{size}</Text>
                </Pressable>
              ))}
            </View>

            {/* Source */}
            <Text style={styles.settingLabel}>Lyrics Source</Text>
            <View style={[styles.optionsRow, { flexWrap: 'wrap' }]}>
              {['All', 'LRCLib', 'BetterLyrics', 'RenderAPI', 'AutoEngine', 'OVH', 'Musixmatch', 'JioSaavn'].map(src => (
                <Pressable
                  key={src}
                  onPress={() => handleUpdateSetting('source', src)}
                  style={[styles.optionButton, lyricsSettings.source === src && styles.activeOption, { marginBottom: 10 }]}
                >
                  <Text style={[styles.optionText, lyricsSettings.source === src && styles.activeOptionText]}>{src}</Text>
                </Pressable>
              ))}
            </View>

            {/* Background Theme */}
            <Text style={styles.settingLabel}>Background Theme</Text>
            <View style={styles.optionsRow}>
              {[
                { name: 'Dark', val: 'rgba(0,0,0,1)' },
                { name: 'Amoled', val: '#000000' },
                { name: 'Blue', val: '#001A33' },
                { name: 'Purple', val: '#1A0033' },
              ].map(theme => (
                <Pressable
                  key={theme.name}
                  onPress={() => handleUpdateSetting('background', theme.val)}
                  style={[styles.optionButton, lyricsSettings.background === theme.val && styles.activeOption]}
                >
                  <Text style={[styles.optionText, lyricsSettings.background === theme.val && styles.activeOptionText]}>{theme.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Text Color */}
            <Text style={styles.settingLabel}>Text Color</Text>
            <View style={styles.optionsRow}>
              {[
                { name: 'White', val: '#FFFFFF' },
                { name: 'Dim', val: '#AAAAAA' },
                { name: 'Green', val: '#00FF88' },
                { name: 'Blue', val: '#33D1FF' },
              ].map(color => (
                <Pressable
                  key={color.name}
                  onPress={() => handleUpdateSetting('textColor', color.val)}
                  style={[styles.optionButton, lyricsSettings.textColor === color.val && styles.activeOption]}
                >
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.val, marginRight: 5 }} />
                  <Text style={[styles.optionText, lyricsSettings.textColor === color.val && styles.activeOptionText]}>{color.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Animation Style */}
            <Text style={styles.settingLabel}>Animation Style</Text>
            <View style={styles.optionsRow}>
              {['Smooth', 'Standard', 'Static'].map(anim => (
                <Pressable
                  key={anim}
                  onPress={() => handleUpdateSetting('animation', anim)}
                  style={[styles.optionButton, lyricsSettings.animation === anim && styles.activeOption]}
                >
                  <Text style={[styles.optionText, lyricsSettings.animation === anim && styles.activeOptionText]}>{anim}</Text>
                </Pressable>
              ))}
            </View>

            <Spacer height={40} />

            <Pressable
              onPress={() => setShowSettings(false)}
              style={{
                backgroundColor: theme.colors.primary,
                padding: 15,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 16 }}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = {
  settingLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 15,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeOption: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderColor: '#00FF88',
  },
  optionText: {
    color: 'white',
    fontSize: 13,
  },
  activeOptionText: {
    color: '#00FF88',
    fontWeight: 'bold',
  },
};
