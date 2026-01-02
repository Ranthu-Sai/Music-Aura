import { Dimensions, ImageBackground, View, TouchableOpacity, Modal, Pressable, StyleSheet } from "react-native";
import FastImage from "react-native-fast-image";
import React, { useContext, useState, useEffect, useRef, memo, useCallback } from "react";
import LinearGradient from "react-native-linear-gradient";
import { Heading } from "../Global/Heading";
import { SmallText } from "../Global/SmallText";
import { PlainText } from "../Global/PlainText";
import Animated, { FadeInDown } from "react-native-reanimated";
import { PlayPauseButton } from "./PlayPauseButton";
import { Spacer } from "../Global/Spacer";
import { NextSongButton } from "./NextSongButton";
import { PreviousSongButton } from "./PreviousSongButton";
import { RepeatSongButton } from "./RepeatSongButton";
import { LikeSongButton } from "./LikeSongButton";
import { ProgressBar } from "./ProgressBar";
import { GetLyricsButton } from "./GetLyricsButton";
import QueueBottomSheet from "./QueueBottomSheet";
import { getYTLyricsSongData, getSongData } from "../../Api/Songs";
import YTArtworkUtils from "../../Utils/YTMusicArtworkUtils";
import { GetLanguageValue } from "../../LocalStorage/Languages";
import { ShowLyrics } from "./ShowLyrics";
import Context, { ActionsContext } from "../../Context/Context";
import TrackPlayer, { useActiveTrack } from "react-native-track-player";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PlayNextSong, PlayPreviousSong, AddOneSongToPlaylist } from "../../MusicPlayerFunctions";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { DeviceEventEmitter, Share, ToastAndroid } from "react-native";
import { MarqueeText } from "../Global/MarqueeText";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import { DownloadSong } from "../../Utils/DownloadHelper";
import { StorageManager } from "../../Utils/StorageManager";

// Isolated Sleep Timer Display component to prevent FullScreenMusic re-renders every second
const SleepTimerBadge = memo(({ sleepTime, setSleepTime, sleepTimerRef }) => {
  const isTimerActive = sleepTime > 0;

  useEffect(() => {
    if (isTimerActive && !sleepTimerRef.current) {
      sleepTimerRef.current = setInterval(async () => {
        setSleepTime((prev) => {
          if (prev <= 1) {
            if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
            sleepTimerRef.current = null;
            TrackPlayer.pause();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      // Don't clear here, let it run until finished or cancelled
    };
  }, [isTimerActive, setSleepTime, sleepTimerRef]);

  if (sleepTime <= 0) return null;

  return (
    <SmallText
      text={`Ends in ${Math.floor(sleepTime / 60)}:${(sleepTime % 60).toString().padStart(2, '0')}`}
      style={{ color: '#1DB954', marginTop: -5, fontWeight: 'bold' }}
    />
  );
});

// Isolated Playback Rate Button to prevent FullScreenMusic re-renders on rate change
const PlaybackRateButton = memo(({ rate, setRate }) => {
  const handlePlaybackRate = async () => {
    const nextRates = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const currentIndex = nextRates.indexOf(rate);
    const nextRate = nextRates[(currentIndex + 1) % nextRates.length];
    setRate(nextRate);
    await TrackPlayer.setRate(nextRate);
    ToastAndroid.show(`Playback speed: ${nextRate}x`, ToastAndroid.SHORT);
  };

  return (
    <TouchableOpacity onPress={handlePlaybackRate} style={{ alignItems: 'center', width: 40 }}>
      <PlainText text={`${rate}x`} style={{ fontSize: 13, fontWeight: 'bold', color: rate !== 1 ? '#1DB954' : 'white' }} />
    </TouchableOpacity>
  );
});

const ArtworkSection = memo(({ artwork, width, pan }) => {
  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: width * 0.85, height: width * 0.85, borderRadius: 30, elevation: 20, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.5, shadowRadius: 15, overflow: "hidden" }}>
        <FastImage source={{ uri: artwork }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      </View>
    </GestureDetector>
  );
});

const InfoSection = memo(({ title, artist }) => {
  return (
    <View style={{ width: '85%', alignItems: 'flex-start', justifyContent: 'center' }}>
      <MarqueeText text={FormatTitleAndArtist(title, artist) || "Unknown"} style={{ textAlign: "left", fontSize: 22 }} nospace={true} />
      <SmallText text={FormatTitleAndArtist(artist) || "Unknown Artist"} style={{ textAlign: "left", opacity: 0.6 }} maxLine={1} />
    </View>
  );
});

const ControlsSection = memo(() => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "85%" }}>
      <RepeatSongButton size={28} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 30 }}>
        <PreviousSongButton size={38} />
        <PlayPauseButton isFullScreen={true} />
        <NextSongButton size={38} />
      </View>
      <LikeSongButton size={28} />
    </View>
  );
});

export const FullScreenMusic = ({ color, Index, setIndex }) => {
  const pan = Gesture.Pan();
  pan.onFinalize((e) => {
    if (e.translationX > 50) {
      PlayPreviousSong();
    } else if (e.translationX < -50) {
      PlayNextSong();
    } else if (e.translationY > 80) {
      setIndex(0);
    }
  });

  const { width, height } = Dimensions.get("window");
  const currentPlaying = useActiveTrack();
  const { lyricsCacheRef } = useContext(ActionsContext);
  const navigation = useNavigation();

  const [ShowDailog, setShowDailog] = useState(false);
  const [Lyric, setLyric] = useState({});
  const [Loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [lyricsFetchInProgress, setLyricsFetchInProgress] = useState(false);
  const queueBottomSheetRef = useRef(null);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepTime, setSleepTime] = useState(0);
  const sleepTimerRef = useRef(null);

  const handleShare = async () => {
    try {
      if (!currentPlaying) return;
      const shareUrl = `https://music.youtube.com/watch?v=${currentPlaying.id}`;
      await Share.share({
        message: `Listen to "${currentPlaying.title}" by ${currentPlaying.artist} on Music Aura!\n${shareUrl}`,
        url: shareUrl,
        title: currentPlaying.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDownload = async () => {
    setShowMenu(false);
    if (!currentPlaying) return;

    const isLocal = currentPlaying.url && (currentPlaying.url.startsWith('/') || currentPlaying.url.startsWith('file://'));
    if (isLocal || currentPlaying.source === 'downloaded') {
      ToastAndroid.show("Song is already offline", ToastAndroid.SHORT);
      return;
    }

    await DownloadSong(currentPlaying);
  };

  const startSleepTimer = (minutes) => {
    if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
    }
    setSleepTime(minutes * 60);
    setShowSleepModal(false);
    ToastAndroid.show(`Sleep timer set for ${minutes} minutes`, ToastAndroid.SHORT);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
    }
    setSleepTime(0);
    setShowSleepModal(false);
    ToastAndroid.show("Sleep timer cancelled", ToastAndroid.SHORT);
  };

  // Lyrics cleanup logic on song change
  useEffect(() => {
    if (currentPlaying?.id) {
      const cacheKey = currentPlaying?.id || `${currentPlaying?.artist}-${currentPlaying?.title}`;
      const hasLyrics = lyricsCacheRef?.current?.[cacheKey];
      if (!hasLyrics) {
        setLyric({});
        setLoading(false);
        setShowDailog(false);
      } else {
        setLyric(hasLyrics);
      }
    }
  }, [currentPlaying?.id, currentPlaying?.artist, currentPlaying?.title, lyricsCacheRef]);

  // Queue event listener
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('songPlayed', (data) => {
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
      if (!currentPlaying?.id) return;
      const isYouTube = /^[a-zA-Z0-9_-]{11}$/.test(currentPlaying.id);
      if (isYouTube) {
        try {
          const response = await fetch('https://music.youtube.com/youtubei/v1/next?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Origin': 'https://music.youtube.com',
            },
            body: JSON.stringify({
              context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241204.01.00', hl: 'en', gl: 'US' } },
              videoId: currentPlaying.id,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            let albumId = null;
            const tabs = data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
            if (tabs) {
              for (const tab of tabs) {
                const content = tab?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents;
                if (content && content[0]) {
                  const runs = content[0]?.playlistPanelVideoRenderer?.longBylineText?.runs;
                  if (runs) {
                    for (const run of runs) {
                      if (run?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb_')) {
                        albumId = run.navigationEndpoint.browseEndpoint.browseId;
                        break;
                      }
                    }
                  }
                  if (albumId) break;
                }
              }
            }
            if (albumId) {
              setIndex(0);
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('Album', { id: albumId, image: currentPlaying.artwork });
              }
              return;
            }
          }
        } catch (ytError) { }
        return;
      }
      const songData = await getSongData(currentPlaying.id);
      const song = songData?.data?.[0];
      if (song?.album_id || song?.albumid || song?.album?.id) {
        setIndex(0);
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('Album', { id: song.album_id || song.albumid || song.album?.id, image: song?.album?.image?.[2]?.url || currentPlaying.artwork });
        }
      }
    } catch (error) { }
  }

  async function GetLyrics() {
    if (!currentPlaying?.id) return;
    const cacheKey = currentPlaying?.id || `${currentPlaying?.artist}-${currentPlaying?.title}`;
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
      const languageToUse = preferredLanguage || currentPlaying?.language || 'en';
      const isYouTubeMusic = /^[a-zA-Z0-9_-]{11}$/.test(currentPlaying.id);
      
      const Lyrics = await getYTLyricsSongData(currentPlaying.artist, currentPlaying.title, languageToUse, isYouTubeMusic);
      
      if (Lyrics.success) {
        if (lyricsCacheRef?.current) lyricsCacheRef.current[cacheKey] = Lyrics.data;
        setLyric(Lyrics.data);
      } else {
        const fallback = { lyrics: "No Lyrics Found" };
        if (lyricsCacheRef?.current) lyricsCacheRef.current[cacheKey] = fallback;
        setLyric(fallback);
      }
    } catch (e) {
      setLyric({ lyrics: "No Lyrics Found" });
    } finally {
      setLoading(false);
      setLyricsFetchInProgress(false);
    }
  }

  const fallbackArtwork = "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png";

  const resolveArtwork = useCallback(() => {
    if (!currentPlaying?.artwork) return fallbackArtwork;
    const raw = currentPlaying.artwork;
    if (typeof raw === 'string' && raw.trim() === "") return fallbackArtwork;
    return YTArtworkUtils.upgradeArtworkQuality(raw);
  }, [currentPlaying?.artwork]);

  return (
    <View style={{ backgroundColor: "black", flex: 1 }}>
      <ShowLyrics Loading={Loading} Lyric={Lyric} setShowDailog={setShowDailog} ShowDailog={ShowDailog} currentSong={currentPlaying} />

      <ImageBackground blurRadius={30} source={{ uri: resolveArtwork() }} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.95)']} style={{ flex: 1, alignItems: "center" }}>

            {/* Header */}
            <View style={{ width: "90%", marginTop: 35, height: 60, alignItems: "center", justifyContent: "space-between", flexDirection: "row" }}>
              <TouchableOpacity onPress={() => setShowMenu(true)} style={{ padding: 10 }}>
                <MaterialCommunityIcons name="dots-vertical" size={26} color="white" />
              </TouchableOpacity>
              <GetLyricsButton onPress={GetLyrics} loading={Loading || lyricsFetchInProgress} />
              <TouchableOpacity onPress={() => setIndex(0)} style={{ padding: 10 }}>
                <AntDesign name="close" size={26} color="white" />
              </TouchableOpacity>
            </View>

            {/* Modals */}
            <Modal visible={showSleepModal} transparent animationType="slide" onRequestClose={() => setShowSleepModal(false)}>
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowSleepModal(false)}>
                <View style={{ backgroundColor: '#121212', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24, paddingBottom: 40 }}>
                  <Heading text="Sleep Timer" style={{ color: 'white', marginBottom: 20 }} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {[15, 30, 45, 60, 90].map((min) => (
                      <TouchableOpacity key={min} onPress={() => startSleepTimer(min)} style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, minWidth: 80, alignItems: 'center' }}>
                        <PlainText text={`${min}m`} />
                      </TouchableOpacity>
                    ))}
                    {sleepTime > 0 && (
                      <TouchableOpacity onPress={cancelSleepTimer} style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'rgba(255,50,50,0.2)', borderRadius: 12, minWidth: '100%', alignItems: 'center', marginTop: 10 }}>
                        <PlainText text="Cancel Timer" style={{ color: '#ff4444' }} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Pressable>
            </Modal>

            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowMenu(false)}>
                <View style={{ backgroundColor: '#1a1a1a', borderRadius: 20, width: '80%', padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <TouchableOpacity onPress={handleGoToAlbum} style={styles.menuItem}>
                    <MaterialCommunityIcons name="album" size={24} color="white" />
                    <PlainText text="Go to Album" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowMenu(false); AddOneSongToPlaylist(currentPlaying); }} style={styles.menuItem}>
                    <MaterialCommunityIcons name="playlist-plus" size={24} color="white" />
                    <PlainText text="Add to Playlist" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowMenu(false); setShowSleepModal(true); }} style={styles.menuItem}>
                    <MaterialCommunityIcons name="timer-outline" size={24} color="white" />
                    <PlainText text="Sleep Timer" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDownload} style={styles.menuItem}>
                    <MaterialCommunityIcons name="download" size={24} color="white" />
                    <PlainText text="Download Song" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowMenu(false); handleShare(); }} style={styles.menuItem}>
                    <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                    <PlainText text="Share Song" />
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>

            <Spacer height={20} />
            <ArtworkSection artwork={resolveArtwork()} width={width} pan={pan} />

            <Spacer height={30} />
            <InfoSection title={currentPlaying?.title} artist={currentPlaying?.artist} />

            <Spacer height={10} />
            <ProgressBar />
            <SleepTimerBadge sleepTime={sleepTime} setSleepTime={setSleepTime} sleepTimerRef={sleepTimerRef} />

            <Spacer height={25} />
            <ControlsSection />

            {/* Bottom Action Pill Bar */}
            <Spacer height={10} />
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              width: '90%', 
              paddingHorizontal: 20,
              paddingVertical: 14, 
              backgroundColor: 'rgba(255,255,255,0.08)', 
              borderRadius: 25,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)'
            }}>
              <TouchableOpacity onPress={() => setShowSleepModal(true)}>
                <MaterialCommunityIcons name="timer-outline" size={24} color={sleepTime > 0 ? '#1DB954' : 'white'} />
              </TouchableOpacity>

              <PlaybackRateButton rate={playbackRate} setRate={setPlaybackRate} />

              <TouchableOpacity onPress={handleShare}>
                <MaterialCommunityIcons name="share-variant-outline" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => queueBottomSheetRef.current?.open()}>
                <MaterialCommunityIcons name="playlist-music-outline" size={26} color="white" />
              </TouchableOpacity>
            </View>

          </LinearGradient>
        </View>
      </ImageBackground>

      <QueueBottomSheet ref={queueBottomSheetRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  }
});

