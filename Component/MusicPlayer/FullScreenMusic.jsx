import { Dimensions, ImageBackground, View, TouchableOpacity, Modal, Pressable } from "react-native";
import FastImage from "react-native-fast-image";
import React, { useContext, useRef, useState } from "react";
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
import { GetLanguageValue } from "../../LocalStorage/Languages";
import { ShowLyrics } from "./ShowLyrics";
import { useActiveTrack } from "react-native-track-player";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PlayNextSong, PlayPreviousSong } from "../../MusicPlayerFunctions";
import Context from "../../Context/Context";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";

export const FullScreenMusic = ({color, Index, setIndex}) => {
  const pan = Gesture.Pan();
  pan.onFinalize((e)=>{
    if (e.translationX > 100){
      PlayPreviousSong()
    } else if(e.translationX < -100){
      PlayNextSong()
    } else {
      setIndex(0)
    }
  })
  const width = Dimensions.get("window").width
  const currentPlaying = useActiveTrack()
  const { lyricsCacheRef } = useContext(Context)
  const navigation = useNavigation()
  const [ShowDailog, setShowDailog] = useState(false);
  const [Lyric, setLyric] = useState({});
  const [Loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function handleGoToAlbum() {
    try {
      setShowMenu(false);
      if (!currentPlaying?.id) {
        return;
      }
      
      // Check if it's a YouTube video (11 char ID)
      const isYouTube = /^[a-zA-Z0-9_-]{11}$/.test(currentPlaying.id);
      
      if (isYouTube) {
        try {
          // Use YouTube Music InnerTube API to get song details
          const response = await fetch('https://music.youtube.com/youtubei/v1/next?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Origin': 'https://music.youtube.com',
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
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Try to find album browse ID in the response
            let albumId = null;
            let albumTitle = null;
            
            // Check in tabs -> tab renderer -> content
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
                        albumTitle = run.text;
                        break;
                      }
                    }
                  }
                  if (albumId) break;
                }
              }
            }
            
            if (albumId) {
              setIndex(0); // Close full player
              
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('Album', { 
                  id: albumId, 
                  image: currentPlaying.artwork 
                });
              }
              return;
            }
          }
        } catch (ytError) {
          // Error silently handled
        }
        return;
      }
      
      // For JioSaavn songs, fetch song data to get album info
      const songData = await getSongData(currentPlaying.id);
      const song = songData?.data?.[0];
      
      if (!song) {
        return;
      }
      
      if (song?.album_id || song?.albumid || song?.album?.id) {
        const albumId = song.album_id || song.albumid || song.album?.id;
        const albumImage = song?.album?.image?.[2]?.url || song?.image?.[2]?.url || currentPlaying.artwork;
        
        setIndex(0); // Close full player
        
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('Album', { 
            id: albumId, 
            image: albumImage 
          });
        }
      }
    } catch (error) {
      // Error silently handled
    }
  }

  async function GetLyrics() {
    setShowDailog(true)
    const cacheKey = currentPlaying?.id || `${currentPlaying?.artist}-${currentPlaying?.title}`
    const cached = lyricsCacheRef?.current?.[cacheKey]
    if (cached) {
      setLyric(cached)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const preferredLanguage = await GetLanguageValue()
      
      // Use preferred language first, then fall back to track language
      // This ensures user's language choice is respected over auto-detected language
      const languageToUse = preferredLanguage || currentPlaying?.language || 'en';
      
      const Lyrics = await getYTLyricsSongData(currentPlaying.artist, currentPlaying.title, languageToUse)
      if (Lyrics.success){
        if (lyricsCacheRef?.current) {lyricsCacheRef.current[cacheKey] = Lyrics.data}
        setLyric(Lyrics.data)
      } else {
        const fallback = { lyrics:"No Lyrics Found \nOpps... O_o" }
        if (lyricsCacheRef?.current) {lyricsCacheRef.current[cacheKey] = fallback}
        setLyric(fallback)
      }
    } catch (e) {
      const fallback = { lyrics:"No Lyrics Found \nOpps... O_o" }
      if (lyricsCacheRef?.current) {lyricsCacheRef.current[cacheKey] = fallback}
      setLyric(fallback)
    } finally {
      setLoading(false)
    }
  }
  return (
   <Animated.View entering={FadeInDown.delay(200)} style={{backgroundColor:"rgb(0,0,0)",flex:1}}>
     <ShowLyrics Loading={Loading} Lyric={Lyric} setShowDailog={setShowDailog} ShowDailog={ShowDailog}/>
     <ImageBackground blurRadius={20} source={{uri: currentPlaying?.artwork ?? "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png"}} style={{
       flex:1,
     }}>
       <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.44)"}}>
         <LinearGradient start={{x: 0, y: 0}} end={{x: 0, y: 1}} colors={['rgba(4,4,4,0.23)','rgba(9,9,9,0.47)', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.89)', 'rgba(0,0,0,0.9)', "rgba(0,0,0,1)"]} style={{flex:1,alignItems:"center"}}>
          <View style={{
            width:"90%",
            marginTop:5,
            height:60,
            alignItems:"center",
            justifyContent:"space-between",
            flexDirection:"row",
          }}>
            <TouchableOpacity 
              onPress={() => setShowMenu(true)}
              style={{
                padding: 8,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons name="dots-vertical" size={24} color="white" />
            </TouchableOpacity>
            <GetLyricsButton onPress={GetLyrics} />
            <TouchableOpacity 
              onPress={() => setIndex(0)}
              style={{
                padding: 8,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <AntDesign name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          
          {/* Three Dots Menu Modal */}
          <Modal
            visible={showMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenu(false)}
          >
            <Pressable 
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-start',
                paddingTop: 60,
                paddingLeft: 10,
              }}
              onPress={() => setShowMenu(false)}
            >
              <View style={{
                backgroundColor: '#1a1a1a',
                borderRadius: 10,
                width: 200,
                padding: 10,
              }}>
                <TouchableOpacity
                  onPress={() => {
                    handleGoToAlbum().catch(err => {
                                        });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <MaterialCommunityIcons name="album" size={20} color="white" />
                  <PlainText text="Go to Album" />
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
           <Spacer height={20}/>
           <GestureDetector gesture={pan}>
             <FastImage
               source={{
                 uri: currentPlaying?.artwork ?? "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png",
               }}
               resizeMode={FastImage.resizeMode.contain}
               style={{
                 height: width * 0.9,
                 width: width * 0.9,
                 borderRadius: 10,
               }}
             />
           </GestureDetector>
           <Spacer/>
           <Heading text={currentPlaying?.title ?? "No music :("} style={{textAlign:"center", paddingHorizontal:2}} nospace={true}/>
           <SmallText text={currentPlaying?.artist ?? "Explore now!"} style={{textAlign:"center", paddingHorizontal:2}}/>
           <Spacer/>
           <ProgressBar/>
           <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-around", width:"100%"}}>
             <View >
               <LikeSongButton size={20} />
             </View>
             <View style={{flexDirection:"row",alignItems:"center",justifyContent:"center", gap:20}}>
               <PreviousSongButton size={30}/>
               <PlayPauseButton isFullScreen={true} />
               <NextSongButton size={30}/>
             </View>
             <View >
               <RepeatSongButton size={25}/>
             </View>
           </View>
         </LinearGradient>
       </View>
     </ImageBackground>
     <QueueBottomSheet Index={1}/>
   </Animated.View>
  );
};

