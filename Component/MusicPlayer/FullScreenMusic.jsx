import {
  Dimensions,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  BackHandler,
  Share,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  memo,
  useCallback,
} from 'react';
import LinearGradient from 'react-native-linear-gradient';
import {Heading} from '../Global/Heading';
import {SmallText} from '../Global/SmallText';
import {PlainText} from '../Global/PlainText';
import {PlayPauseButton} from './PlayPauseButton';
import {Spacer} from '../Global/Spacer';
import {NextSongButton} from './NextSongButton';
import {PreviousSongButton} from './PreviousSongButton';
import {RepeatMode} from 'react-native-track-player';
import {SetRepeatMode} from '../../MusicPlayerFunctions';
import {LikeSongButton} from './LikeSongButton';
import {ProgressBar} from './ProgressBar';
import {GetLyricsButton} from './GetLyricsButton';
import QueueBottomSheet from './QueueBottomSheet';
import {getYTLyricsSongData, getSongData} from '../../Api/Songs';
import {GetLanguageValue} from '../../LocalStorage/Languages';
import {ShowLyrics} from './ShowLyrics';
import Context, {ActionsContext} from '../../Context/Context';
import {Repeats} from '../../Utils/Repeats';
import TrackPlayer, {useActiveTrack} from 'react-native-track-player';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {
  PlayNextSong,
  PlayPreviousSong,
  AddOneSongToPlaylist,
} from '../../MusicPlayerFunctions';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation, useTheme} from '@react-navigation/native';
import {DeviceEventEmitter, ToastAndroid} from 'react-native';
import YTArtworkUtils from '../../Utils/YTMusicArtworkUtils';
import {MarqueeText} from '../Global/MarqueeText';
import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';
import {DownloadSong} from '../../Utils/DownloadHelper';
import SongInfoModal from './SongInfoModal';
// No-blur mode: we avoid blurred image backgrounds for performance

// Isolated Sleep Timer Display that avoids parent per-second re-renders
const SleepTimerBadge = memo(({sleepTime, sleepTimerRef, onTimerEnd}) => {
  const [remaining, setRemaining] = useState(sleepTime || 0);
  const endAtRef = useRef(0);

  useEffect(() => {
    if (sleepTime > 0) {
      const now = Date.now();
      endAtRef.current = now + sleepTime * 1000;
      setRemaining(Math.max(0, Math.round((endAtRef.current - now) / 1000)));

      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      sleepTimerRef.current = setInterval(async () => {
        const nowTs = Date.now();
        const secsLeft = Math.max(
          0,
          Math.round((endAtRef.current - nowTs) / 1000),
        );
        setRemaining(secsLeft);
        if (secsLeft <= 0) {
          if (sleepTimerRef.current) {
            clearInterval(sleepTimerRef.current);
            sleepTimerRef.current = null;
          }
          try {
            await TrackPlayer.pause();
          } catch (_) {}
          if (onTimerEnd) {
            onTimerEnd();
          }
        }
      }, 1000);
    } else {
      setRemaining(0);
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    }

    return () => {
      // Keep timer running unless canceled/ended explicitly to avoid flicker when navigating
    };
  }, [sleepTime, sleepTimerRef, onTimerEnd]);

  if (!remaining || remaining <= 0) {
    return null;
  }

  return (
    <SmallText
      text={`Ends in ${Math.floor(remaining / 60)}:${(remaining % 60)
        .toString()
        .padStart(2, '0')}`}
      style={{color: '#1DB954', marginTop: -5, fontWeight: 'bold'}}
    />
  );
});

// Isolated Playback Rate Button to prevent FullScreenMusic re-renders on rate change
const PlaybackRateButton = memo(({rate, setRate}) => {
  const theme = useTheme();
  const handlePlaybackRate = async () => {
    const nextRates = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const currentIndex = nextRates.indexOf(rate);
    const nextRate = nextRates[(currentIndex + 1) % nextRates.length];
    setRate(nextRate);
    await TrackPlayer.setRate(nextRate);
    ToastAndroid.show(`Playback speed: ${nextRate}x`, ToastAndroid.SHORT);
  };

  return (
    <TouchableOpacity
      onPress={handlePlaybackRate}
      style={{alignItems: 'center', width: 40}}>
      <PlainText
        text={`${rate}x`}
        style={{
          fontSize: 13,
          fontWeight: 'bold',
          color: rate !== 1 ? '#1DB954' : theme.colors.text,
        }}
      />
    </TouchableOpacity>
  );
});

const ArtworkSection = memo(({artwork, width, pan}) => {
  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          width: width * 0.85,
          height: width * 0.85,
          borderRadius: 30,
          elevation: 6,
          overflow: 'hidden',
        }}>
        <FastImage
          source={{
            uri: artwork,
            priority: FastImage.priority.high,
            cache: FastImage.cacheControl.immutable,
          }}
          style={{
            width: '100%',
            height: '100%',
            renderToHardwareTextureAndroid: true,
          }}
          resizeMode={FastImage.resizeMode.cover}
        />
      </View>
    </GestureDetector>
  );
});

const InfoSection = memo(({title, artist}) => {
  return (
    <View
      style={{
        width: '85%',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}>
      <MarqueeText
        text={FormatTitleAndArtist(title, artist) || 'Unknown'}
        style={{textAlign: 'left', fontSize: 22}}
        nospace={true}
      />
      <SmallText
        text={FormatTitleAndArtist(artist) || 'Unknown Artist'}
        style={{textAlign: 'left', opacity: 0.6}}
        maxLine={1}
      />
    </View>
  );
});

const ControlsSection = memo(({onOpenRepeatOptions}) => {
  const theme = useTheme();
  const {Repeat} = useContext(Context);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '85%',
      }}>
      <TouchableOpacity onPress={onOpenRepeatOptions}>
        <MaterialCommunityIcons
          name={Repeat}
          size={28}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 30}}>
        <PreviousSongButton size={38} />
        <PlayPauseButton isFullScreen={true} />
        <NextSongButton size={38} />
      </View>
      <LikeSongButton size={28} />
    </View>
  );
});

export const FullScreenMusic = memo(({color, Index, setIndex}) => {
  const pan = React.useMemo(() => {
    const g = Gesture.Pan();
    g.onFinalize(e => {
      if (e.translationX > 50) {
        PlayPreviousSong();
      } else if (e.translationX < -50) {
        PlayNextSong();
      } else if (e.translationY > 80) {
        setIndex(0);
      }
    });
    return g;
  }, [setIndex]);

  const {width} = Dimensions.get('window');
  const currentPlaying = useActiveTrack();
  const {lyricsCacheRef, lyricsSettings, refreshLyrics} = useContext(ActionsContext);
  const navigation = useNavigation();
  const theme = useTheme();

  const [ShowDailog, setShowDailog] = useState(false);
  const [Lyric, setLyric] = useState({});
  const [Loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [lyricsFetchInProgress, setLyricsFetchInProgress] = useState(false);
  const queueBottomSheetRef = useRef(null);
  // Repeat modal removed: repeat toggles on icon press now

  const {Repeat} = useContext(Context);
  const {setRepeat} = useContext(ActionsContext);

  const onToggleRepeat = useCallback(async () => {
    try {
      if (Repeat === Repeats.NoRepeat) {
        setRepeat(Repeats.RepeatAll);
        await SetRepeatMode(RepeatMode.Queue);
      } else if (Repeat === Repeats.RepeatAll) {
        setRepeat(Repeats.RepeatOne);
        await SetRepeatMode(RepeatMode.Track);
      } else {
        setRepeat(Repeats.NoRepeat);
        await SetRepeatMode(RepeatMode.Off);
      }
    } catch (e) {
      // ignore
    }
  }, [Repeat, setRepeat]);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepTime, setSleepTime] = useState(0);
  const sleepTimerRef = useRef(null);
  const [, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [endOfTrack, setEndOfTrack] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

  const handleInfoModalOpen = useCallback(() => {
    if (currentPlaying?.id) {
      setIsInfoModalVisible(true);
    }
  }, [currentPlaying?.id]);

  const handleDownload = async () => {
    setShowMenu(false);
    if (!currentPlaying) {
      return;
    }

    const isLocal =
      currentPlaying.url &&
      (currentPlaying.url.startsWith('/') ||
        currentPlaying.url.startsWith('file://'));
    if (isLocal || currentPlaying.source === 'downloaded') {
      ToastAndroid.show('Song is already offline', ToastAndroid.SHORT);
      return;
    }

    await DownloadSong(currentPlaying);
  };

  const startSleepTimer = minutes => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTime(minutes * 60);
    setShowSleepModal(false);
    setShowCustomInput(false);
    ToastAndroid.show(
      `Sleep timer set for ${minutes} minutes`,
      ToastAndroid.SHORT,
    );
  };

  const startCustomSleepTimer = () => {
    const mins = parseInt(String(customMinutes), 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      ToastAndroid.show('Enter a valid number of minutes', ToastAndroid.SHORT);
      return;
    }
    startSleepTimer(mins);
  };

  const startEndOfTrackTimer = async () => {
    try {
      const progress = await TrackPlayer.getProgress();
      const remaining = Math.max(
        0,
        Math.floor((progress?.duration || 0) - (progress?.position || 0)),
      );
      if (remaining <= 0) {
        ToastAndroid.show('Track is ending. Pausing soon.', ToastAndroid.SHORT);
        setShowSleepModal(false);
        setShowCustomInput(false);
        // Pause shortly if already at end
        setTimeout(() => {
          TrackPlayer.pause();
        }, 500);
        return;
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      setSleepTime(remaining);
      setShowSleepModal(false);
      setShowCustomInput(false);
      ToastAndroid.show('Sleep timer set for end of track', ToastAndroid.SHORT);
    } catch (e) {
      ToastAndroid.show('Unable to set end-of-track timer', ToastAndroid.SHORT);
    }
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTime(0);
    setShowSleepModal(false);
    ToastAndroid.show('Sleep timer cancelled', ToastAndroid.SHORT);
  };

  // Handle Android hardware back to close modal or exit full screen
  useEffect(() => {
    const onBackPress = () => {
      if (showSleepModal) {
        setShowSleepModal(false);
        return true; // consumed
      }
      // If lyrics modal is open, close it
      if (ShowDailog) {
        setShowDailog(false);
        return true;
      }
      // Otherwise minimize full screen
      setIndex(0);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showSleepModal, ShowDailog, setIndex]);

  // Lyrics cleanup logic on song change
  useEffect(() => {
    if (currentPlaying?.id) {
      const sourceSuffix = lyricsSettings?.source || 'All';
      const cacheKey = currentPlaying?.id
        ? `${currentPlaying.id}-${sourceSuffix}`
        : `${currentPlaying?.artist}-${currentPlaying?.title}-${sourceSuffix}`;
      const hasLyrics = lyricsCacheRef?.current?.[cacheKey];
      if (!hasLyrics) {
        // If the lyrics modal is currently open, try fetching the new source instead of closing it.
        if (ShowDailog) {
          (async () => {
            try {
              setLoading(true);
              setLyricsFetchInProgress(true);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Lyrics fetch timeout')), 30000)
              );
              const refreshPromise = refreshLyrics(
                currentPlaying.id,
                currentPlaying.artist,
                currentPlaying.title,
                currentPlaying.language,
                sourceSuffix,
              );
              const results = await Promise.race([refreshPromise, timeoutPromise]);
              if (results) {
                setLyric(results);
              } else {
                setLyric({lyrics: 'No Lyrics Found'});
              }
            } catch (e) {
              console.error('Error refreshing lyrics on source change:', e);
              setLyric({lyrics: 'No Lyrics Found'});
            } finally {
              setLoading(false);
              setLyricsFetchInProgress(false);
            }
          })();
        } else {
          setLyric({});
          setLoading(false);
          setShowDailog(false);
        }
      } else {
        setLyric(hasLyrics);
      }
    }
  }, [
    currentPlaying?.id,
    currentPlaying?.artist,
    currentPlaying?.title,
    currentPlaying?.language,
    lyricsCacheRef,
    lyricsSettings?.source,
    refreshLyrics,
    ShowDailog,
  ]);

  // Reset loading state when lyrics dialog is closed
  useEffect(() => {
    if (!ShowDailog) {
      setLoading(false);
      setLyricsFetchInProgress(false);
    }
  }, [ShowDailog]);

  // Queue event listener
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('songPlayed', data => {
      setTimeout(() => {
        if (queueBottomSheetRef.current) {
          queueBottomSheetRef.current.open();
        }
      }, 200);
    });
    return () => subscription.remove();
  }, [queueBottomSheetRef]);

  async function handleGoToAlbum() {
    try {
      setShowMenu(false);
      if (!currentPlaying?.id) {
        return;
      }
      const isYouTube = /^[a-zA-Z0-9_-]{11}$/.test(currentPlaying.id);
      if (isYouTube) {
        try {
          const response = await fetch(
            'https://music.youtube.com/youtubei/v1/next?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                Origin: 'https://music.youtube.com',
              },
              body: JSON.stringify({
                context: {
                  client: {
                    clientName: 'WEB_REMIX',
                    clientVersion: '1.20241204.01.00',
                    hl: 'en',
                    gl: 'US',
                  },
                },
                videoId: currentPlaying.id,
              }),
            },
          );
          if (response.ok) {
            const data = await response.json();
            let albumId = null;
            const tabs =
              data?.contents?.singleColumnMusicWatchNextResultsRenderer
                ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
            if (tabs) {
              for (const tab of tabs) {
                const content =
                  tab?.tabRenderer?.content?.musicQueueRenderer?.content
                    ?.playlistPanelRenderer?.contents;
                if (content && content[0]) {
                  const runs =
                    content[0]?.playlistPanelVideoRenderer?.longBylineText
                      ?.runs;
                  if (runs) {
                    for (const run of runs) {
                      if (
                        run?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith(
                          'MPREb_',
                        )
                      ) {
                        albumId =
                          run.navigationEndpoint.browseEndpoint.browseId;
                        break;
                      }
                    }
                  }
                  if (albumId) {
                    break;
                  }
                }
              }
            }
            if (albumId) {
              setIndex(0);
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('Album', {
                  id: albumId,
                  image: currentPlaying.artwork,
                });
              }
              return;
            }
          }
        } catch (ytError) {}
        return;
      }
      const songData = await getSongData(currentPlaying.id);
      const song = songData?.data?.[0];
      if (song?.album_id || song?.albumid || song?.album?.id) {
        setIndex(0);
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('Album', {
            id: song.album_id || song.albumid || song.album?.id,
            image: song?.album?.image?.[2]?.url || currentPlaying.artwork,
          });
        }
      }
    } catch (error) {}
  }

  async function GetLyrics() {
    if (!currentPlaying?.id) {
      return;
    }
    const sourceSuffix = lyricsSettings?.source || 'All';
    const cacheKey = currentPlaying?.id
      ? `${currentPlaying.id}-${sourceSuffix}`
      : `${currentPlaying?.artist}-${currentPlaying?.title}-${sourceSuffix}`;
    const cached = lyricsCacheRef?.current?.[cacheKey];

    if (cached) {
      setLyric(cached);
      setShowDailog(true);
      return;
    }

    setShowDailog(true);
    setLoading(true);
    setLyricsFetchInProgress(true);
    try {
      const preferredLanguage = await GetLanguageValue();
      const languageToUse =
        preferredLanguage || currentPlaying?.language || 'en';
      const isYouTubeMusic = /^[a-zA-Z0-9_-]{11}$/.test(currentPlaying.id);

      const Lyrics = await getYTLyricsSongData(
        currentPlaying.artist,
        currentPlaying.title,
        languageToUse,
        isYouTubeMusic,
        lyricsSettings.source,
      );

      if (Lyrics.success) {
        if (lyricsCacheRef?.current) {
          lyricsCacheRef.current[cacheKey] = Lyrics.data;
        }
        setLyric(Lyrics.data);
      } else {
        const fallback = {lyrics: 'No Lyrics Found'};
        if (lyricsCacheRef?.current) {
          lyricsCacheRef.current[cacheKey] = fallback;
        }
        setLyric(fallback);
      }
    } catch (e) {
      setLyric({lyrics: 'No Lyrics Found'});
    } finally {
      setLoading(false);
      setLyricsFetchInProgress(false);
    }
  }

  const fallbackArtwork =
    'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png';

  const resolvedArtwork = React.useMemo(() => {
    if (!currentPlaying?.artwork) {
      return fallbackArtwork;
    }
    const raw = currentPlaying.artwork;
    if (typeof raw === 'string' && raw.trim() === '') {
      return fallbackArtwork;
    }
    return YTArtworkUtils.upgradeArtworkQuality(raw);
  }, [currentPlaying?.artwork]);

  // No-blur background: removed background artwork processing

  const gradientColors = theme.dark
    ? ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.95)']
    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.96)'];

  return (
    <View style={{backgroundColor: theme.colors.background, flex: 1}}>
      <ShowLyrics
        Loading={Loading}
        Lyric={Lyric}
        setShowDailog={setShowDailog}
        ShowDailog={ShowDailog}
        currentSong={currentPlaying}
        setLyric={setLyric}
        setLoading={setLoading}
      />

      {/* No-blur: simple solid background; gradient overlay below handles styling */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: theme.colors.background,
        }}
      />

      <View
        style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}>
        <View style={{flex: 1}}>
          <LinearGradient
            colors={gradientColors}
            style={{flex: 1, alignItems: 'center'}}>
            {/* Header */}
            <View
              style={{
                width: '90%',
                marginTop: 35,
                height: 60,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexDirection: 'row',
              }}>
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={{padding: 10}}>
                <MaterialCommunityIcons
                  name="dots-vertical"
                  size={26}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <GetLyricsButton
                onPress={GetLyrics}
                loading={Loading || lyricsFetchInProgress}
              />
              <TouchableOpacity
                onPress={() => setIndex(0)}
                style={{padding: 10}}>
                <AntDesign name="close" size={26} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Modals */}
            <Modal
              visible={showSleepModal}
              transparent
              animationType="slide"
              onRequestClose={() => setShowSleepModal(false)}>
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  justifyContent: 'flex-end',
                }}
                onPress={() => setShowSleepModal(false)}>
                <View
                  style={{
                    backgroundColor: theme.dark ? '#101010' : '#FFFFFF',
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    padding: 22,
                    paddingBottom: 26,
                    borderTopWidth: 1,
                    borderColor: theme.dark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.06)',
                  }}>
                  {/* Centered title with larger close icon at top-right */}
                  <View
                    style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 6,
                      marginTop: 6,
                    }}>
                    <Heading
                      text="Sleep Timer"
                      style={{color: theme.colors.text}}
                    />
                    <TouchableOpacity
                      onPress={() => setShowSleepModal(false)}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                      style={{position: 'absolute', right: 0}}>
                      <MaterialCommunityIcons
                        name="close"
                        size={28}
                        color={theme.colors.text}
                      />
                    </TouchableOpacity>
                  </View>
                  <SmallText
                    text="Pause playback automatically after a set time"
                    style={{
                      opacity: 0.6,
                      marginBottom: 14,
                      textAlign: 'center',
                    }}
                  />

                  {/* Remaining badge if running (self-updating) */}
                  {sleepTime > 0 && (
                    <View
                      style={{
                        backgroundColor: 'rgba(29,185,84,0.12)',
                        borderWidth: 1,
                        borderColor: 'rgba(29,185,84,0.3)',
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        alignSelf: 'flex-start',
                        marginBottom: 14,
                      }}>
                      <SleepTimerBadge
                        sleepTime={sleepTime}
                        sleepTimerRef={sleepTimerRef}
                        onTimerEnd={() => setSleepTime(0)}
                      />
                    </View>
                  )}

                  {/* Presets Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 12,
                    }}>
                    {[15, 30, 45, 60, 90].map(min => (
                      <TouchableOpacity
                        key={min}
                        onPress={() => {
                          setEndOfTrack(false);
                          startSleepTimer(min);
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          backgroundColor: theme.dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.dark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.08)',
                        }}>
                        <PlainText text={`${min} min`} />
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setEndOfTrack(v => !v)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        backgroundColor: endOfTrack
                          ? 'rgba(29,185,84,0.15)'
                          : theme.dark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.06)',
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: endOfTrack
                          ? 'rgba(29,185,84,0.35)'
                          : theme.dark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.08)',
                      }}>
                      <PlainText
                        text="End of Track"
                        style={{
                          color: endOfTrack ? '#1DB954' : theme.colors.text,
                        }}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Custom minutes controller (restyled) */}
                  <View
                    style={{
                      backgroundColor: theme.dark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.03)',
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: theme.dark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.06)',
                      marginBottom: 12,
                    }}>
                    <PlainText
                      text="Custom minutes"
                      style={{opacity: 0.7, marginBottom: 10}}
                    />
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <TouchableOpacity
                        onPress={() =>
                          setCustomMinutes(m =>
                            Math.max(1, parseInt(String(m || 0), 10) - 5),
                          )
                        }
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          backgroundColor: theme.dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                          borderRadius: 10,
                        }}>
                        <PlainText text="-5" />
                      </TouchableOpacity>
                      <View
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginHorizontal: 10,
                          backgroundColor: theme.dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.dark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.08)',
                        }}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={18}
                          color="#bbb"
                          style={{marginLeft: 10}}
                        />
                        <TextInput
                          value={String(customMinutes)}
                          onChangeText={t =>
                            setCustomMinutes((t || '').replace(/[^0-9]/g, ''))
                          }
                          keyboardType="numeric"
                          placeholder="Minutes"
                          placeholderTextColor="#888"
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            color: theme.colors.text,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                          }}
                        />
                        <PlainText
                          text="min"
                          style={{opacity: 0.6, marginRight: 12}}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setCustomMinutes(m =>
                            Math.min(999, parseInt(String(m || 0), 10) + 5),
                          )
                        }
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          backgroundColor: theme.dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                          borderRadius: 10,
                        }}>
                        <PlainText text="+5" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Footer Buttons (Close text removed) */}
                  <View style={{flexDirection: 'row', gap: 12, marginTop: 6}}>
                    <TouchableOpacity
                      onPress={() => {
                        if (endOfTrack) {
                          startEndOfTrackTimer();
                        } else {
                          startCustomSleepTimer();
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        alignItems: 'center',
                        backgroundColor: '#1DB954',
                        borderRadius: 12,
                      }}>
                      <PlainText
                        text={
                          endOfTrack ? 'Start (End of Track)' : 'Start Timer'
                        }
                        style={{color: 'black', fontWeight: 'bold'}}
                      />
                    </TouchableOpacity>
                    {sleepTime > 0 && (
                      <TouchableOpacity
                        onPress={cancelSleepTimer}
                        style={{
                          paddingVertical: 14,
                          paddingHorizontal: 18,
                          alignItems: 'center',
                          backgroundColor: theme.dark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                          borderRadius: 12,
                        }}>
                        <PlainText text="Cancel" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Pressable>
            </Modal>



            <Modal
              visible={showMenu}
              transparent
              animationType="fade"
              onRequestClose={() => setShowMenu(false)}>
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => setShowMenu(false)}>
                <View
                  style={{
                    backgroundColor: theme.dark ? '#1a1a1a' : '#FFFFFF',
                    borderRadius: 20,
                    width: '80%',
                    padding: 10,
                    borderWidth: 1,
                    borderColor: theme.dark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.08)',
                  }}>
                  <TouchableOpacity
                    onPress={handleGoToAlbum}
                    style={[
                      styles.menuItem,
                      {
                        borderBottomColor: theme.dark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.06)',
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name="album"
                      size={24}
                      color={theme.colors.text}
                    />
                    <PlainText text="Go to Album" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShowMenu(false);
                      AddOneSongToPlaylist(currentPlaying);
                    }}
                    style={[
                      styles.menuItem,
                      {
                        borderBottomColor: theme.dark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.06)',
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name="playlist-plus"
                      size={24}
                      color={theme.colors.text}
                    />
                    <PlainText text="Add to Playlist" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDownload}
                    style={[
                      styles.menuItem,
                      {
                        borderBottomColor: theme.dark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.06)',
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name="download"
                      size={24}
                      color={theme.colors.text}
                    />
                    <PlainText text="Download Song" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      setShowMenu(false);
                      try {
                        await Share.share({
                          message: `Check out this song: ${currentPlaying?.title || 'Unknown'} by ${currentPlaying?.artist || 'Unknown Artist'}\nShared from Music Aura`,
                        });
                      } catch (e) {
                        // ignore
                      }
                    }}
                    style={[
                      styles.menuItem,
                      {borderBottomColor: 'transparent'},
                    ]}>
                    <MaterialCommunityIcons
                      name="share-variant"
                      size={24}
                      color={theme.colors.text}
                    />
                    <PlainText text="Share Song" />
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>

            <Spacer height={20} />
            <ArtworkSection artwork={resolvedArtwork} width={width} pan={pan} />

            <Spacer height={30} />
            <InfoSection
              title={currentPlaying?.title}
              artist={currentPlaying?.artist}
            />

            <Spacer height={10} />
            <ProgressBar />
            <SleepTimerBadge
              sleepTime={sleepTime}
              sleepTimerRef={sleepTimerRef}
              onTimerEnd={() => setSleepTime(0)}
            />

            <Spacer height={25} />
            <ControlsSection
              onOpenRepeatOptions={onToggleRepeat}
            />

            {/* Bottom Action Pill Bar */}
            <Spacer height={10} />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '90%',
                paddingHorizontal: 20,
                paddingVertical: 14,
                backgroundColor: theme.dark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                borderRadius: 25,
                borderWidth: 1,
                borderColor: theme.dark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.08)',
              }}>
              <TouchableOpacity onPress={() => setShowSleepModal(true)}>
                <MaterialCommunityIcons
                  name="timer-outline"
                  size={24}
                  color={sleepTime > 0 ? '#1DB954' : theme.colors.text}
                />
              </TouchableOpacity>

              <PlaybackRateButton
                rate={playbackRate}
                setRate={setPlaybackRate}
              />

              <TouchableOpacity onPress={handleInfoModalOpen}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={24}
                  color={theme.colors.text}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => queueBottomSheetRef.current?.open()}>
                <MaterialCommunityIcons
                  name="playlist-music-outline"
                  size={26}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>

      <QueueBottomSheet ref={queueBottomSheetRef} />
      <SongInfoModal
        visible={isInfoModalVisible}
        onDismiss={() => setIsInfoModalVisible(false)}
        track={currentPlaying}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
});
