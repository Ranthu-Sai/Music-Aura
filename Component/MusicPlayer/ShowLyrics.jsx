import { Dimensions, Modal, Pressable, ScrollView, Text, View, FlatList } from "react-native";
import { Heading } from "../Global/Heading";
import { Spacer } from "../Global/Spacer";
import { LoadingComponent } from "../Global/Loading";
import React, { useEffect, useRef, useCallback } from "react";
import { useTheme } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Clipboard from '@react-native-clipboard/clipboard';
import TrackPlayer, { useProgress, usePlaybackState, State } from 'react-native-track-player';
import Ionicons from 'react-native-vector-icons/Ionicons';

export const ShowLyrics = ({ShowDailog, Loading, Lyric, setShowDailog, currentSong}) => {
  const height  = Dimensions.get("window").height
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

  useEffect(() => {
    // Intentionally left blank: do not auto-scroll the list when playback advances.
    // The pinned current line shows current playback; list is for manual navigation.
  }, [position, currentIndex, isManualScrolling, displayLyrics, flatListMounted])

  // Initial positioning when lyrics first load
  useEffect(() => {
    // No initial automatic scroll: keep list position independent of pinned current line.
  }, [displayLyrics, currentIndex, flatListMounted])

  const renderItem = ({ item, index }) => (
    <Pressable onPress={() => {
      setManualIndex(index)
      TrackPlayer.seekTo(item.start_time / 1000)
    }} style={{
      paddingVertical: 15,
      paddingHorizontal: 10,
      minHeight: 70,
      justifyContent: 'center',
      backgroundColor: 'transparent',
    }}>
      <Text style={{
        color: 'white',
        fontSize: width * 0.055,
        fontWeight: '300',
        textAlign: "center",
        lineHeight: width * 0.08,
        opacity: 0.85,
        textShadowColor: 'transparent',
        textShadowRadius: 0,
      }}>{item.text}</Text>
    </Pressable>
  )

  return (
    <Modal transparent={true} visible={ShowDailog} statusBarTranslucent={true} >
      <View style={{
        backgroundColor:"rgba(0,0,0,1)",
        flex:1,
      }}>
        {/* Fixed Header */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: 30, // reduced header top padding
          paddingHorizontal: 16,
          paddingBottom: 12, // reduced bottom padding
          backgroundColor: 'rgba(0,0,0,0.95)',
        }}>
          {/* Top Row: Lyrics Label, Centered Song Title, and Close Icon */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            height: 40,
          }}>
            {/* Lyrics Label */}
            <Text style={{
              color: 'white',
              fontSize: width * 0.04,
              fontWeight: '600',
            }}>
              Lyrics
            </Text>

            {/* Centered Song Title (absolute center) */}
            <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={{
                color: 'white',
                fontSize: width * 0.045,
                fontWeight: '600',
                textAlign: 'center',
              }}>{currentSong?.title || 'Unknown Song'}</Text>
            </View>

            {/* Close Icon */}
            <Pressable onPress={() => setShowDailog(false)} style={{
              padding: 5,
            }}>
              <Ionicons name="close" size={30} color="white" />
            </Pressable>
          </View>

          {/* Mode Toggle Buttons */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 8,
          }}>
            <Pressable 
              onPress={handleRegularMode}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: lyricsMode === 'regular' ? '#00FF88' : 'rgba(255,255,255,0.1)',
                marginRight: 10,
              }}
            >
              <Text style={{
                color: lyricsMode === 'regular' ? 'black' : 'white',
                fontSize: width * 0.035,
                fontWeight: '500',
              }}>
                Regular
              </Text>
            </Pressable>
            
            <Pressable 
              onPress={handleTimeSyncedMode}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: lyricsMode === 'time-synced' ? '#00FF88' : 'rgba(255,255,255,0.1)',
                opacity: 1, // Always enabled
              }}
            >
              <Text style={{
                color: lyricsMode === 'time-synced' ? 'black' : 'white',
                fontSize: width * 0.035,
                fontWeight: '500',
              }}>
                Time Synced
              </Text>
            </Pressable>
          </View>

          {/* Song title is shown in the top row; artist removed per request */}

          {/* Pinned current line for time-synced lyrics (fixed under header) */}
          {lyricsMode === 'time-synced' && displayLyrics && displayLyrics.length > 0 ? (
            <Pressable onPress={() => {
              try {
                const line = displayLyrics[currentIndex];
                if (line && line.start_time != null) {
                  TrackPlayer.seekTo(line.start_time / 1000);
                }
              } catch (e) {}
            }} style={{
              marginTop: 6,
              paddingVertical: 10,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: 'rgba(0,0,0,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text numberOfLines={2} style={{
                color: '#00FF88',
                fontSize: width * 0.055,
                fontWeight: '700',
                textAlign: 'center',
                lineHeight: width * 0.085,
              }}>{displayLyrics[currentIndex]?.text ?? ''}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Scrollable Content */}
        <View style={{
          flex: 1,
          // Account for reduced header + pinned current line height
          marginTop: currentSong ? 180 : 140,
        }}>
          {Loading && <LoadingComponent loading={true} height={height - 70}/>}
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
                  onScrollEndDrag={() => setIsManualScrolling(false)}
                  onMomentumScrollEnd={() => setIsManualScrolling(false)}
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
                  minHeight:height,
                  paddingTop: 20, // Reduced since header is now fixed
                }}
                onScrollBeginDrag={() => setIsManualScrolling(true)}
                onScrollEndDrag={() => setIsManualScrolling(false)}
                onMomentumScrollEnd={() => setIsManualScrolling(false)}
              >
                {/* Regular lyrics indicator */}
                <Text selectable={true} style={{
                  color:"white",
                  fontSize:width * 0.055,
                  fontWeight:300,
                  paddingRight:10,
                  textAlign:"center",
                  lineHeight: width * 0.08,
                }}>{Lyric?.lyrics?.replaceAll("<br>","\n")}</Text>
                <Spacer height={300}/>
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
        <LinearGradient start={{x: 0, y: 0}} end={{x: 0, y: 1}} colors={['rgba(0,0,0,0.07)','rgba(0,0,0,0.7)','rgb(0,0,0)', 'rgb(7,7,7)' ]} style={{flexDirection:"row", gap:4, position:"absolute", alignItems:"center", justifyContent:"center",height:120, paddingTop:70 , bottom:0, width:width + 20 }}>
         <Pressable onPress={()=>{
           setShowDailog(false)
         }}  style={{
           flex:1,
           backgroundColor:"rgb(255,255,255)",
           alignItems:"center",
           justifyContent:"center",
           padding:10,
           borderTopLeftRadius:10,
           borderBottomLeftRadius:10,
         }}>
           <Text style={{
             color:"black",
             fontWeight:"500",
           }}>Close</Text>
         </Pressable>
         <Pressable onPress={()=>Clipboard.setString(Lyric?.lyrics?.replaceAll("<br>","\n") ?? "")} style={{
           flex:1,
           backgroundColor:theme.colors.primary,
           alignItems:"center",
           justifyContent:"center",
           padding:10,
           borderBottomRightRadius:10,
           borderTopRightRadius:10,
         }}>
           <Text style={{
             color:"black",
             fontWeight:"500",
           }}>Copy</Text>
         </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
};
