import {MainWrapper} from '../../Layout/MainWrapper';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {Heading} from '../../Component/Global/Heading';
import {PlainText} from '../../Component/Global/PlainText';
import {SmallText} from '../../Component/Global/SmallText';
import {
  TouchableOpacity,
  Pressable,
  ScrollView,
  ToastAndroid,
  View,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useEffect, useState, useContext, useCallback} from 'react';
import Context, {ThemeContext} from '../../Context/Context';
import {GetCacheSizes, ClearSelectedCache} from '../../LocalStorage/ClearCache';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInRight,
  Layout,
} from 'react-native-reanimated';
import {Spacer} from '../../Component/Global/Spacer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {InteractionManager} from 'react-native';



function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }
  if (!bytes) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // For very small but non-zero values, ensure we don't show 0.0 B
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return (val === 0 && bytes > 0 ? '1' : val) + ' ' + sizes[i];
}

function CacheCard({
  item,
  isSelected,
  onToggle,
  size,
  currentThemeColors,
  delay,
}) {
  const percentage = Math.min(100, (size / (10 * 1024 * 1024)) * 100); // Normalize against 10MB for visual

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).duration(400)}
      layout={Layout.duration(300)}>
      <Pressable
        onPress={onToggle}
        style={({pressed}) => [
          styles.cacheCard,
          {
            backgroundColor: isSelected
              ? 'rgba(29, 185, 84, 0.1)'
              : 'rgba(255,255,255,0.03)',
            borderColor: isSelected ? '#1DB954' : 'rgba(255,255,255,0.05)',
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isSelected
                  ? '#1DB95422'
                  : 'rgba(255,255,255,0.05)',
              },
            ]}>
            <MaterialIcons
              name={item.icon}
              size={22}
              color={isSelected ? '#1DB954' : 'white'}
            />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <PlainText text={item.label} style={{fontWeight: '600'}} />
            <View style={styles.miniBarContainer}>
              <View
                style={[
                  styles.miniBarFill,
                  {
                    width: `${Math.max(2, percentage)}%`,
                    backgroundColor: isSelected
                      ? '#1DB954'
                      : 'rgba(255,255,255,0.2)',
                  },
                ]}
              />
            </View>
          </View>
        </View>
        <View style={styles.cardRight}>
          <SmallText
            text={formatBytes(size)}
            style={{marginRight: 10, opacity: 0.6}}
          />
          <MaterialIcons
            name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
            size={22}
            color={isSelected ? '#1DB954' : 'rgba(255,255,255,0.3)'}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const ClearCachePage = ({navigation}) => {
  const {currentThemeColors} = useContext(ThemeContext);
  const {activeTrack} = useContext(Context);
  const [cacheSizes, setCacheSizes] = useState({});
  const [storage, setStorage] = useState({total: 0, d: 0, c: 0});
  const [selectedCache, setSelectedCache] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheOptions = [
    {key: 'SEARCH_HISTORY', label: 'Search History', icon: 'history'},
    {key: 'RECENTLY_PLAYED', label: 'Recently Played', icon: 'update'},
    {key: 'SONG_CACHE', label: 'Song Cache', icon: 'cached'},
    {key: 'OFFLINE_DOWNLOADS', label: 'Offline Downloads', icon: 'get-app'},
    {key: 'LIKED_SONGS', label: 'Liked Songs', icon: 'favorite-outline'},
    {
      key: 'LIKED_PLAYLISTS',
      label: 'Liked Playlists',
      icon: 'playlist-add-check',
    },
    {key: 'USER_PLAYLISTS', label: 'User Playlists', icon: 'playlist-play'},
    {key: 'QUEUE', label: 'Playback Queue', icon: 'queue-music'},
    {key: 'LAST_SONG', label: 'Last Played Info', icon: 'play-circle-outline'},
    {key: 'IMAGE_CACHE', label: 'Image Cache', icon: 'image'},
  ];

  const loadData = useCallback(async () => {
    try {
      const sizes = await GetCacheSizes();
      setCacheSizes(sizes);

      const total = sizes.TOTAL || 0;
      const downloads = sizes.OFFLINE_DOWNLOADS || 0;
      const cache = total - downloads;

      setStorage({
        total: total,
        d: downloads,
        c: cache,
      });
    } catch (error) {
      console.error('Error loading clear cache data:', error);
      ToastAndroid.show('Failed to load cache data', ToastAndroid.SHORT);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      ToastAndroid.show('Storage refreshed', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error refreshing storage:', error);
      ToastAndroid.show('Refresh failed', ToastAndroid.SHORT);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    // Wait for screen transitions to finish before doing heavy I/O on initial load
    InteractionManager.runAfterInteractions(() => {
      loadData();
    });
  }, [loadData]);

  function toggleCacheSelection(key) {
    if (selectedCache.includes(key)) {
      setSelectedCache(selectedCache.filter(k => k !== key));
    } else {
      setSelectedCache([...selectedCache, key]);
    }
  }

  async function handleClearSelected() {
    if (selectedCache.length === 0) {
      ToastAndroid.show('Select categories to clear', ToastAndroid.SHORT);
      return;
    }

    Alert.alert(
      'Confirm Cleanup',
      `Clear cache for ${selectedCache.length} selected categories?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear Now',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const success = await ClearSelectedCache(selectedCache);
            if (success) {
              ToastAndroid.show('Cleanup successful', ToastAndroid.SHORT);
              setSelectedCache([]);
              await loadData();
            }
            setLoading(false);
          },
        },
      ],
    );
  }

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text={'Clear Cache'} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: activeTrack ? 140 : 100}}>
          {/* Dynamic Storage Dashboard */}
          <Animated.View
            entering={FadeInDown.duration(600)}
            style={styles.dashboard}>
            <LinearGradient
              colors={['#1DB95433', 'transparent']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.dashboardGradient}>
              <View style={styles.dashboardHeader}>
                <View>
                  <PlainText
                    text="Storage Dashboard"
                    style={styles.dashboardTitle}
                  />
                  <SmallText
                    text={`Total usage: ${formatBytes(storage.total)}`}
                    style={{opacity: 0.6}}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleRefresh}
                  disabled={refreshing}
                  style={[styles.refreshIcon, refreshing && {opacity: 0.5}]}>
                  {refreshing ? (
                    <ActivityIndicator size="small" color="#1DB954" />
                  ) : (
                    <Icon name="refresh" size={20} color="#1DB954" />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.storageBars}>
                <View style={styles.barContainer}>
                  <View style={styles.barLabelRow}>
                    <SmallText text="Offline Downloads" />
                    <SmallText text={formatBytes(storage.d)} />
                  </View>
                  <View style={styles.barBg}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: `${(storage.d / (storage.total || 1)) * 100}%`,
                          backgroundColor: '#1DB954',
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.barContainer}>
                  <View style={styles.barLabelRow}>
                    <SmallText text="Cached Memory" />
                    <SmallText text={formatBytes(storage.c)} />
                  </View>
                  <View style={styles.barBg}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: `${(storage.c / (storage.total || 1)) * 100}%`,
                          backgroundColor: '#4776E6',
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={() => setSelectedCache(cacheOptions.map(o => o.key))}
              style={styles.controlBtn}>
              <PlainText text="Select All" style={styles.controlText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedCache([])}
              style={styles.controlBtn}>
              <PlainText text="Deselect All" style={styles.controlText} />
            </TouchableOpacity>
          </View>

          <View style={{marginBottom: 20}}>
            {cacheOptions.map((item, index) => (
              <CacheCard
                key={item.key}
                item={item}
                delay={index * 50}
                isSelected={selectedCache.includes(item.key)}
                onToggle={() => toggleCacheSelection(item.key)}
                size={cacheSizes[item.key] || 0}
                currentThemeColors={currentThemeColors}
              />
            ))}
          </View>

          <Spacer height={10} />

          <TouchableOpacity
            onPress={handleClearSelected}
            disabled={loading || selectedCache.length === 0}
            style={[
              styles.mainActionBtn,
              {opacity: selectedCache.length > 0 ? 1 : 0.5},
            ]}>
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <>
                <MaterialIcons name="delete-sweep" size={24} color="black" />
                <PlainText
                  text={`Clean ${selectedCache.length} Categories`}
                  style={styles.actionBtnText}
                />
              </>
            )}
          </TouchableOpacity>

          <Animated.View
            entering={FadeInDown.delay(600)}
            style={styles.footerNote}>
            <MaterialIcons
              name="info-outline"
              size={14}
              color="rgba(255,255,255,0.4)"
            />
            <SmallText
              text="Settings and custom playlists are never deleted."
              style={{marginLeft: 5, opacity: 0.4}}
            />
          </Animated.View>
        </ScrollView>
      </PaddingConatiner>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  dashboard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 15,
    marginBottom: 20,
  },
  dashboardGradient: {
    padding: 20,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  refreshIcon: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  storageBars: {
    gap: 12,
  },
  barContainer: {},
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  controlBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlText: {
    fontSize: 12,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  cacheCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    padding: 10,
    borderRadius: 12,
  },
  miniBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    marginTop: 8,
    width: '100%',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  mainActionBtn: {
    backgroundColor: '#1DB954',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 12,
    elevation: 5,
  },
  actionBtnText: {
    color: 'black',
    fontWeight: '900',
    fontSize: 16,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingBottom: 20,
  },
});
