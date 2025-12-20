import { Dimensions, View } from "react-native";
import { Heading } from "../Global/Heading";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SmallText } from "../Global/SmallText";
import { Spacer } from "../Global/Spacer";
import LinearGradient from "react-native-linear-gradient";
import { useTheme } from "@react-navigation/native";
import { AddPlaylist, getIndexQuality } from "../../MusicPlayerFunctions";
import { PlayButton } from "../Playlist/PlayButton";
import { useContext } from "react";
import Context from "../../Context/Context";
import FormatArtist from "../../Utils/FormatArtists";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";



export const AlbumDetails = ({ name, artist, year, songCount, duration, Data }) => {
  const { updateTrack } = useContext(Context)

  async function AddToPlayer() {
    const quality = await getIndexQuality()
    const ForMusicPlayer = Data?.data?.songs?.map((e, i) => {
      // Handle the case where downloadUrl might be a single URL or an array
      const download = Array.isArray(e?.downloadUrl) ? (e?.downloadUrl[quality]?.url || e?.downloadUrl[0]?.url) : e?.downloadUrl;

      return {
        url: download,
        title: FormatTitleAndArtist(e?.name),
        artist: FormatTitleAndArtist(FormatArtist(e?.artists?.primary)),
        artwork: Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[0]?.url) : e?.image,
        image: Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[0]?.url) : e?.image,
        duration: e?.duration,
        id: e?.id,
        language: e?.language,
        artistID: e?.primary_artists_id,
        source: 'ytmusic'
      }
    })
    await AddPlaylist(ForMusicPlayer)
    updateTrack()
  }

  const theme = useTheme()
  const width = Dimensions.get('window').width

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      colors={['transparent', 'rgba(0,0,0,0.8)', '#080808']}
      style={{
        padding: 20,
        paddingTop: 10,
      }}
    >
      <Heading text={name} style={{ fontSize: 28, marginBottom: 5 }} />

      <View style={{ marginBottom: 15 }}>
        <SmallText
          text={artist}
          style={{
            fontSize: 18,
            color: 'white',
            fontWeight: 'bold',
            marginBottom: 4
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <SmallText text={year} style={{ color: '#AAAAAA' }} />
          <SmallText text="•" style={{ color: '#666666' }} />
          <SmallText text={`${songCount} songs`} style={{ color: '#AAAAAA' }} />
          <SmallText text="•" style={{ color: '#666666' }} />
          <SmallText text={duration} style={{ color: '#AAAAAA' }} />
        </View>
      </View>

      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 15
      }}>
        <PlayButton onPress={AddToPlayer} />
        {/* Placeholder for shuffle button which could be added later */}
      </View>
    </LinearGradient>
  );
};
