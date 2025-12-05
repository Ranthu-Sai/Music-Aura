import { Dimensions, Pressable,View } from "react-native";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import FastImage from "react-native-fast-image";
import { PlaySongWithRelated } from "../../MusicPlayerFunctions";
import { memo, useContext, useState, useCallback } from "react";
import Context from "../../Context/Context";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import { EachSongMenuButton } from "../MusicPlayer/EachSongMenuButton";


export const EachSongCard = memo(function EachSongCard({title,artist,image,id,url,duration,language,artistID,isLibraryLiked, width, titleandartistwidth, isFromPlaylist, Data, index}) {
  const width1 = Dimensions.get("window").width;
  const {updateTrack, setVisible, lyricsCacheRef} = useContext(Context)
  const currentPlaying = useActiveTrack()
  const playerState = usePlaybackState()
  const [isLoading, setIsLoading] = useState(false);

  const AddSongToPlayer = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (lyricsCacheRef?.current) { lyricsCacheRef.current = {}; }
      // Pass full song info for YouTube support
      await PlaySongWithRelated(id, image, { title, artist, url, duration, language })
      updateTrack()
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, id, image, title, artist, url, duration, language, updateTrack, lyricsCacheRef]);

  return (
    <>
      <View style={{
        flexDirection:'row',
        width:width ? width : width1,
        marginRight:10,
        alignItems:"center",
        paddingRight:4,
        // backgroundColor:"red"
      }}>
        <Pressable onPress={AddSongToPlayer} disabled={isLoading} style={{
          flexDirection:'row',
          gap:8,
          alignItems:"center",
          elevation:10,
          marginBottom:4,
          flex:1,
          opacity: isLoading ? 0.5 : 1,
        }}>
          <FastImage source={((id === currentPlaying?.id ?? "") && playerState.state === "playing") ? require("../../Images/playing.gif") : ((id === currentPlaying?.id ?? "") && playerState.state !== "playing" ) ? require("../../Images/songPaused.gif") : {
            uri: image || 'https://via.placeholder.com/40x40/cccccc/000000?text=No+Img',
          }} 
          resizeMode={FastImage.resizeMode.contain}
          style={{
            height:60,
            width:60,
            borderRadius:8,
          }}/>
          <View style={{
            flex:1,
          }}>
            <PlainText text={FormatTitleAndArtist(title)} style={{width:titleandartistwidth ? titleandartistwidth : width1 * 0.67}}/>
            <SmallText text={FormatTitleAndArtist(artist)} style={{width:titleandartistwidth ? titleandartistwidth : width1 * 0.67}}/>
          </View>
        </Pressable>
        <EachSongMenuButton Onpress={()=>{
          setVisible({
            visible:true,
            title,artist,image,id,url,duration,language,
          })
        }}/>
      </View>
    </>
  );
})
