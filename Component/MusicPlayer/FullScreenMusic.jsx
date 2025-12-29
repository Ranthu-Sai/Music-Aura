import { Dimensions, ImageBackground, View, TouchableOpacity, Modal, Pressable } from "react-native";
import FastImage from "react-native-fast-image";
import React, { useContext, useState, useEffect, useRef } from "react";
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
import Context from "../../Context/Context";
import TrackPlayer, { useActiveTrack } from "react-native-track-player";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PlayNextSong, PlayPreviousSong, AddOneSongToPlaylist } from "../../MusicPlayerFunctions";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { DeviceEventEmitter, Share, ToastAndroid } from "react-native";
import { MarqueeText } from "../Global/MarqueeText";

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
  const { lyricsCacheRef } = useContext(Context);
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

  const handlePlaybackRate = async () => {
    const nextRates = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const currentIndex = nextRates.indexOf(playbackRate);
    const nextRate = nextRates[(currentIndex + 1) % nextRates.length];
    setPlaybackRate(nextRate);
    await TrackPlayer.setRate(nextRate);
    ToastAndroid.show(`Playback speed: ${nextRate}x`, ToastAndroid.SHORT);
  };

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

  const startSleepTimer = (minutes) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleepTime(minutes * 60);
    setShowSleepModal(false);
    ToastAndroid.show(`Sleep timer set for ${minutes} minutes`, ToastAndroid.SHORT);

    sleepTimerRef.current = setInterval(async () => {
      setSleepTime((prev) => {
        if (prev <= 1) {
          clearInterval(sleepTimerRef.current);
          TrackPlayer.pause();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleepTime(0);
    setShowSleepModal(false);
    ToastAndroid.show("Sleep timer cancelled", ToastAndroid.SHORT);
  };

  // Lyrics logic
  useEffect(() => {
    if (currentPlaying?.id && !lyricsFetchInProgress) {
      const cacheKey = currentPlaying?.id || `${currentPlaying?.artist}-${currentPlaying?.title}`;
      const hasLyrics = lyricsCacheRef?.current?.[cacheKey] || Lyric?.lyrics || Lyric?.timed_lyrics;
      if (!hasLyrics) {
        setLyric({});
        setLoading(false);
        setShowDailog(false);
      }
    }
  }, [currentPlaying?.id, currentPlaying?.artist, currentPlaying?.title, lyricsFetchInProgress, Lyric?.lyrics, Lyric?.timed_lyrics, lyricsCacheRef]);

  useEffect(() => {
    if (!currentPlaying?.id) return;
    const cacheKey = currentPlaying?.id || `${currentPlaying?.artist}-${currentPlaying?.title}`;
    if (lyricsCacheRef?.current?.[cacheKey]) return;

    const preloadLyrics = async () => {
      try {
        const preferredLanguage = await GetLanguageValue();
        const languageToUse = preferredLanguage || currentPlaying?.language || 'en';
        let artistForLookup = currentPlaying.artist;
        let titleForLookup = currentPlaying.title;
        const isYouTubeMusic = /^[a-zA-Z0-9_-]{11}$/.test(currentPlaying.id);
        const Lyrics = await getYTLyricsSongData(artistForLookup, titleForLookup, languageToUse, isYouTubeMusic);
        if (Lyrics.success && lyricsCacheRef?.current) {
          lyricsCacheRef.current[cacheKey] = Lyrics.data;
        } else if (lyricsCacheRef?.current) {
          lyricsCacheRef.current[cacheKey] = { lyrics: "No Lyrics Found" };
        }
      } catch (e) { }
    };
    const timeoutId = setTimeout(preloadLyrics, 500);
    return () => clearTimeout(timeoutId);
  }, [currentPlaying?.id, currentPlaying?.artist, currentPlaying?.title, currentPlaying?.language, lyricsCacheRef]);

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
    setShowDailog(true);
    setLoading(true);
    setLyricsFetchInProgress(true);
    const cacheKey = currentPlaying?.id || `${currentPlaying?.artist}-${currentPlaying?.title}`;
    const cached = lyricsCacheRef?.current?.[cacheKey];
    if (cached) {
      setTimeout(() => {
        setLyric(cached);
        setLoading(false);
        setLyricsFetchInProgress(false);
      }, 200);
      return;
    }
    try {
      const preferredLanguage = await GetLanguageValue();
      const languageToUse = preferredLanguage || currentPlaying?.language || 'en';
      const Lyrics = await getYTLyricsSongData(currentPlaying.artist, currentPlaying.title, languageToUse, true);
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

  const decodeHtml = (text) => {
    if (!text) return "";
    return text.toString()
      .replace(/&quot;/g, "\"")
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&trade;/g, "™")
      .replace(/&copy;/g, "©")
      .replace(/&reg;/g, "®")
      .replace(/&ndash;/g, "–")
      .replace(/&mdash;/g, "—");
  };

  const fallbackArtwork = "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png";

  const resolveArtwork = () => {
    if (!currentPlaying?.artwork) return fallbackArtwork;
    const raw = currentPlaying.artwork;
    if (typeof raw === 'string' && raw.trim() === "") return fallbackArtwork;
    return YTArtworkUtils.upgradeArtworkQuality(raw);
  };

  return (
    <View style={{ backgroundColor: "black", flex: 1 }}>
      <ShowLyrics Loading={Loading} Lyric={Lyric} setShowDailog={setShowDailog} ShowDailog={ShowDailog} currentSong={currentPlaying} />

      <ImageBackground blurRadius={30} source={{ uri: resolveArtwork() }} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.95)']} style={{ flex: 1, alignItems: "center" }}>

            {/* Header */}
            <View style={{ width: "90%", marginTop: 15, height: 60, alignItems: "center", justifyContent: "space-between", flexDirection: "row" }}>
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
                  <TouchableOpacity onPress={() => { setShowMenu(false); handleShare(); }} style={styles.menuItem}>
                    <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                    <PlainText text="Share Song" />
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>

            {/* Artwork */}
            <Spacer height={20} />
            <GestureDetector gesture={pan}>
              <View style={{ width: width * 0.85, height: width * 0.85, borderRadius: 30, elevation: 20, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.5, shadowRadius: 15, overflow: "hidden" }}>
                <FastImage source={{ uri: resolveArtwork() }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>
            </GestureDetector>

            {/* Info Row */}
            <Spacer height={30} />
            <View style={{ width: '85%', alignItems: 'flex-start', justifyContent: 'center' }}>
              <MarqueeText text={decodeHtml(currentPlaying?.title) || "Unknown"} style={{ textAlign: "left", fontSize: 22 }} nospace={true} />
              <SmallText text={decodeHtml(currentPlaying?.artist) || "Unknown Artist"} style={{ textAlign: "left", opacity: 0.6 }} maxLine={1} />
            </View>

            {/* Progress */}
            <Spacer height={10} />
            <ProgressBar />
            {sleepTime > 0 && (
              <SmallText
                text={`Ends in ${Math.floor(sleepTime / 60)}:${(sleepTime % 60).toString().padStart(2, '0')}`}
                style={{ color: '#1DB954', marginTop: -5, fontWeight: 'bold' }}
              />
            )}

            {/* Controls */}
            <Spacer height={20} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "85%" }}>
              <LikeSongButton size={30} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 30 }}>
                <PreviousSongButton size={36} />
                <PlayPauseButton isFullScreen={true} />
                <NextSongButton size={36} />
              </View>
              <TouchableOpacity onPress={() => queueBottomSheetRef.current?.open()} style={{ padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15 }}>
                <MaterialCommunityIcons name="playlist-music-outline" size={30} color="white" />
              </TouchableOpacity>
            </View>

            {/* Bottom Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '85%', marginTop: 25, padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20 }}>
              <RepeatSongButton size={22} />
              <TouchableOpacity onPress={handlePlaybackRate}>
                <PlainText text={`${playbackRate}x`} style={{ fontWeight: 'bold', color: playbackRate !== 1 ? '#1DB954' : 'white' }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSleepModal(true)}>
                <MaterialCommunityIcons name="timer-outline" size={24} color={sleepTime > 0 ? '#1DB954' : 'white'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare}>
                <MaterialCommunityIcons name="share-variant-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>

          </LinearGradient>
        </View>
      </ImageBackground>

      <QueueBottomSheet ref={queueBottomSheetRef} />
    </View>
  );
};

const styles = {
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  }
};
