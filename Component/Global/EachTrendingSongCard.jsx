import { Pressable, View } from "react-native";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import FastImage from "react-native-fast-image";
import { memo, useContext, useState, useCallback } from "react";
import { PlayOneSong, getIndexQuality } from "../../MusicPlayerFunctions";
import Context from "../../Context/Context";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import FormatArtist from "../../Utils/FormatArtists";
import { getSongData } from "../../Api/Songs";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";

export const EachTrendingSongCard = memo(function EachTrendingSongCard({image, name, artists, id}) {
  const { updateTrack } = useContext(Context);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUri, setImageUri] = useState(image || 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')
  const currentPlaying = useActiveTrack();
  const playerState = usePlaybackState();

  const artistsNames = artists?.primary?.map(e => e.name).join(", ") || "";
  const formattedName = FormatTitleAndArtist(name || "");

  const isCurrentSong = id === currentPlaying?.id;
  const isPlaying = playerState.state === "playing";

  const PlaySong = useCallback(async () => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      // Fetch full song data from playback API
      const songData = await getSongData(id);
      const quality = await getIndexQuality();
      const songObj = songData.data[0]; // API returns array
      const song = {
        url: songObj.downloadUrl[quality].url,
        title: FormatTitleAndArtist(songObj.name),
        artist: FormatTitleAndArtist(FormatArtist(songObj.artists?.primary)),
        artwork: songObj.image[2]?.url || image,
        duration: songObj.duration,
        id: songObj.id,
        language: songObj.language,
        artistID: songObj.primary_artists_id,
        image: songObj.image[2]?.url || image,
        downloadUrl: songObj.downloadUrl,
      };
      await PlayOneSong(song);
      updateTrack();
    } catch (error) {
      console.error('Error playing song:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, id, image, updateTrack]);

  const getIconName = () => {
    if (isCurrentSong) {
      return isPlaying ? "pause" : "play";
    }
    return "play";
  };

  return (
    <Pressable onPress={PlaySong} disabled={isLoading} style={{
      borderRadius: 8,
      height: 208,
      width: 150,
      backgroundColor: "rgba(55,55,79,0)",
      overflow: "hidden",
      opacity: isLoading ? 0.5 : 1,
    }}>
      <FastImage source={{
        uri: imageUri,
        priority: 'high',
      }} onError={() => setImageUri('https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')} style={{
        height: 140,
        width: '100%',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: 20,
          padding: 8,
        }}>
          <MaterialCommunityIcons name={getIconName()} size={24} color="white" />
        </View>
      </FastImage>
      <View style={{
        padding: 8,
        height: 80,
      }}>
        <PlainText text={formattedName} numberOfLine={5} />
        <SmallText text={artistsNames} maxLine={1} />
      </View>
    </Pressable>
  );
});
