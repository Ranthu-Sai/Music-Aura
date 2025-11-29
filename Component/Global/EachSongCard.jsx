import { Dimensions, Pressable,View } from "react-native";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import FastImage from "react-native-fast-image";
import { AddPlaylist, getIndexQuality, PlayOneSong } from "../../MusicPlayerFunctions";
import { memo, useContext, useState, useCallback } from "react";
import Context from "../../Context/Context";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import FormatArtist from "../../Utils/FormatArtists";
import { EachSongMenuButton } from "../MusicPlayer/EachSongMenuButton";


export const EachSongCard = memo(function EachSongCard({title,artist,image,id,url,duration,language,artistID,isLibraryLiked, width, titleandartistwidth, isFromPlaylist, Data, index}) {
  const width1 = Dimensions.get("window").width;
  const {updateTrack, setVisible} = useContext(Context)
  const currentPlaying = useActiveTrack()
  const playerState = usePlaybackState()
  const [isLoading, setIsLoading] = useState(false);

  const AddSongToPlayer = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (isFromPlaylist){
        const ForMusicPlayer = []
        const quality = await getIndexQuality()
        Data?.data?.songs?.map((e,i)=>{
          if (i >= index){
            ForMusicPlayer.push({
              url:e?.downloadUrl[quality].url,
              title:FormatTitleAndArtist(e?.name),
              artist:FormatTitleAndArtist(FormatArtist(e?.artists?.primary)),
              artwork:e?.image[2]?.url,
              image:e?.image[2]?.url,
              duration:e?.duration,
              id:e?.id,
              language:e?.language,
              downloadUrl:e?.downloadUrl,
            })
          }
        })
        await AddPlaylist(ForMusicPlayer)
      } else if (isLibraryLiked){
        const Final = []
        Data?.map((e,i)=>{
          if (i >= index) {
            Final.push({
              url:e.url,
              title:e?.title,
              artist:e?.artist,
              artwork:e?.artwork,
              duration:e?.duration,
              id:e?.id,
              language:e?.language,
              artistID:e?.primary_artists_id,
              downloadUrl:e?.downloadUrl,
            })
          }
        })
        await AddPlaylist(Final)
      } else {
        const quality = await getIndexQuality()
        const song  = {
          url: typeof url === 'string' ? url : url[quality].url,
          title:FormatTitleAndArtist(title),
          artist:FormatTitleAndArtist(artist),
          artwork:image,
          duration,
          id,
          language,
          artistID:artistID,
          image:image,
          downloadUrl:url,
        }
        PlayOneSong(song)
      }
      updateTrack()
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isFromPlaylist, Data, index, isLibraryLiked, url, title, artist, image, duration, id, language, artistID, updateTrack]);

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
          maxHeight:50,
          elevation:10,
          marginBottom:4,
          flex:1,
          opacity: isLoading ? 0.5 : 1,
        }}>
          <FastImage source={((id === currentPlaying?.id ?? "") && playerState.state === "playing") ? require("../../Images/playing.gif") : ((id === currentPlaying?.id ?? "") && playerState.state !== "playing" ) ? require("../../Images/songPaused.gif") : {
            uri: image || 'https://via.placeholder.com/40x40/cccccc/000000?text=No+Img',
          }} style={{
            height:40,
            width:40,
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
