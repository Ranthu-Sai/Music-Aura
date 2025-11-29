import { MainWrapper } from "../Layout/MainWrapper";
import Animated, { useAnimatedRef} from "react-native-reanimated";
import { PlaylistTopHeader } from "../Component/Playlist/PlaylistTopHeader";
import { View } from "react-native";
import { EachSongCard } from "../Component/Global/EachSongCard";
import { useEffect, useState } from "react";
import { LoadingComponent } from "../Component/Global/Loading";
import { useTheme } from "@react-navigation/native";
import { PlainText } from "../Component/Global/PlainText";
import { SmallText } from "../Component/Global/SmallText";
import { getAlbumData } from "../Api/Album";
import { getSongData } from "../Api/Songs";
import { AlbumDetails } from "../Component/Album/AlbumDetails";
import FormatArtist from "../Utils/FormatArtists";

export const Album = ({route}) => {
  const theme = useTheme();
  const AnimatedRef = useAnimatedRef()
  const [Loading, setLoading] = useState(true)
  const [Data, setData] = useState({});
  const {id} = route.params
  async function fetchAlbumData(){
    try {
      setLoading(true)
      let data = await getAlbumData(id)
      // Add 1 second delay to ensure correct song results
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Check if songs are sample or empty
      if (!data.data.songs || data.data.songs.length === 0 || data.data.songs.some(song => song.name.toLowerCase().includes('sample') || song.name.toLowerCase().includes('trailer'))) {
        // Try fetching as song
        const songData = await getSongData(id)
        const song = songData.data[0]
        data = { data: {
          name: song.name,
          image: song.image,
          year: song.year,
          songs: [song],
        } }
      }
      setData(data)
    } catch (e) {
      // Error fetching album data
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchAlbumData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <MainWrapper>
      {Loading &&
        <LoadingComponent loading={Loading}/>}
      {!Loading &&  <>
        {(() => {
          const filteredSongs = Data?.data?.songs?.filter(song => song.downloadUrl && song.downloadUrl.length > 0 && !song.name.toLowerCase().includes('trailer') && !song.name.toLowerCase().includes('sample')) || [];
          return filteredSongs.length > 0 ? <Animated.ScrollView scrollEventThrottle={16} ref={AnimatedRef} contentContainerStyle={{
            paddingBottom:80,
            backgroundColor:"#101010",
          }}>
            <PlaylistTopHeader AnimatedRef={AnimatedRef} url={Array.isArray(Data?.data?.image) ? Data?.data?.image[2]?.url : Data?.data?.image ?? ""} />
            <AlbumDetails name={Data?.data?.name ?? ""} liked={false} releaseData={Data?.data?.year ?? ""}  Data={Data}/>
            {<View style={{
              paddingHorizontal:10,
              backgroundColor:"#101010",
              gap:7,
            }}>
              {filteredSongs.map((e,i)=><EachSongCard isFromPlaylist={true} Data={Data} index={i} artist={FormatArtist(e?.artists?.primary)} language={e?.language} playlist={true} artistID={e?.primary_artists_id} key={i} duration={e?.duration} image={e?.image[2]?.url} id={e?.id} width={"100%"} title={e?.name}  url={e?.downloadUrl} style={{
                marginBottom:15,
              }}/>)}
            </View>}
          </Animated.ScrollView> : <View style={{
            flex: 1,
            alignItems:"center",
            justifyContent:"center",
          }}>
            <PlainText text={"Album not available"}/>
            <SmallText text={"Songs are not playable"}/>
          </View>;
        })()}
      </>}
    </MainWrapper>
  );
};
