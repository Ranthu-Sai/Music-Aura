import { Dimensions, Modal, Pressable, ScrollView, Text, View, FlatList } from "react-native";
import { Heading } from "../Global/Heading";
import { Spacer } from "../Global/Spacer";
import { LoadingComponent } from "../Global/Loading";
import React, { useEffect, useRef } from "react";
import { useTheme } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Clipboard from '@react-native-clipboard/clipboard';
import TrackPlayer, { useProgress, usePlaybackState, State } from 'react-native-track-player';
import Ionicons from 'react-native-vector-icons/Ionicons';

export const ShowLyrics = ({ShowDailog, Loading, Lyric, setShowDailog}) => {
  const height  = Dimensions.get("window").height
  const width = Dimensions.get("window").width
  const theme = useTheme()
  const { position } = useProgress()
  const playbackState = usePlaybackState()
  const flatListRef = useRef(null)

  const [manualIndex, setManualIndex] = React.useState(-1)

  const timedLyrics = Lyric?.timed_lyrics
  const currentIndex = manualIndex >= 0 ? manualIndex : (timedLyrics ? (() => {
    const pos = position * 1000;
    let index = timedLyrics.findIndex(line => pos >= line.start_time && pos <= line.end_time);
    if (index === -1) {
      for (let i = timedLyrics.length - 1; i >= 0; i--) {
        if (timedLyrics[i].start_time <= pos) {
          index = i;
          break;
        }
      }
    }
    return index;
  })() : -1)

  useEffect(() => {
    if (manualIndex >= 0) {
      // Reset manual index after position updates
      const timer = setTimeout(() => setManualIndex(-1), 1000)
      return () => clearTimeout(timer)
    }
  }, [position, manualIndex])

  useEffect(() => {
    if (flatListRef.current && currentIndex >= 0) {
      flatListRef.current.scrollToIndex({ index: currentIndex, animated: true, viewPosition: 0.5 })
    }
  }, [position])

  const renderItem = ({ item, index }) => (
    <Pressable onPress={() => {
      setManualIndex(index)
      TrackPlayer.seekTo(item.start_time / 1000)
    }} style={{
      paddingVertical: 5,
      paddingHorizontal: 10,
    }}>
      <Text style={{
        color: index === currentIndex ? 'green' : theme.colors.text,
        fontSize: width * 0.055,
        fontWeight: index === currentIndex ? 'bold' : '300',
        textAlign: "center",
      }}>{item.text}</Text>
    </Pressable>
  )

  return (
    <Modal transparent={true} visible={ShowDailog} statusBarTranslucent={true} >
      <View style={{
        backgroundColor:"rgba(0,0,0,0.75)",
        paddingHorizontal:20,
        paddingVertical:50,
        flex:1,
      }}>
        <Pressable onPress={() => setShowDailog(false)} style={{
          position: 'absolute',
          top: 60,
          right: 30,
          zIndex: 10,
        }}>
          <Ionicons name="close" size={30} color="white" />
        </Pressable>
        {Loading && <LoadingComponent loading={true} height={height - 70}/>}
        {!Loading && <>
          <Heading text={"Lyrics"} style={{
            textAlign:"center",
            fontSize:width * 0.1,
            color:theme.colors.primary,
          }}/>
          {timedLyrics ? (
            <FlatList
              ref={flatListRef}
              data={timedLyrics}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 300,
              }}
              getItemLayout={(data, index) => ({
                length: 40, // approximate height
                offset: 40 * index,
                index,
              })}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{
              minHeight:height,
            }}>
              <Text selectable={true} style={{
                color:theme.colors.text,
                fontSize:width * 0.055,
                fontWeight:300,
                paddingRight:10,
                textAlign:"center",
              }}>{Lyric?.lyrics?.replaceAll("<br>","\n")}</Text>
              <Spacer height={300}/>
            </ScrollView>
          )}
        </>}
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
