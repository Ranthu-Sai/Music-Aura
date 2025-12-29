import { Pressable, View, TouchableOpacity } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import { memo } from "react";
import { SkipToTrack } from "../../MusicPlayerFunctions";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";
import TrackPlayer from "react-native-track-player";
import AntDesign from "react-native-vector-icons/AntDesign";
import { DownloadSong } from "../../Utils/DownloadHelper";

// Helper to normalize artwork value to a URL string
const resolveArtworkUri = (image) => {
  if (!image) { return null; }

  // If it's already a string URL
  if (typeof image === 'string' && image.length > 0) { return image; }

  // If it's an object
  if (typeof image === 'object') {
    // Array of thumbnails
    if (Array.isArray(image) && image.length > 0) {
      const best = image[image.length - 1] || image[0];
      if (!best) { return null; }
      if (typeof best === 'string') { return best; }
      if (best.url) { return best.url; }
      if (best.link) { return best.link; }
      if (best.uri) { return best.uri; }
      if (best.thumbnail && (best.thumbnail.url || best.thumbnail.uri)) { return best.thumbnail.url || best.thumbnail.uri; }
    }

    // Common fields
    if (image.url) { return image.url; }
    if (image.uri) { return image.uri; }
    if (image.link) { return image.link; }

    // Nested thumbnail object
    if (image.thumbnail) {
      if (typeof image.thumbnail === 'string') { return image.thumbnail; }
      if (image.thumbnail.url) { return image.thumbnail.url; }
      if (image.thumbnail.uri) { return image.thumbnail.uri; }
    }

    // Thumbnails array property
    if (image.thumbnails && Array.isArray(image.thumbnails) && image.thumbnails.length > 0) {
      const best = image.thumbnails[image.thumbnails.length - 1] || image.thumbnails[0];
      if (best?.url) { return best.url; }
      if (best?.uri) { return best.uri; }
      if (typeof best === 'string') { return best; }
    }

    // Some providers nest images under 'images' or 'bestThumbnail'
    if (image.images && Array.isArray(image.images) && image.images.length > 0) {
      const best = image.images[image.images.length - 1] || image.images[0];
      if (best?.url) { return best.url; }
      if (best?.uri) { return best.uri; }
      if (typeof best === 'string') { return best; }
    }

    if (image.bestThumbnail && (image.bestThumbnail.url || image.bestThumbnail.uri)) {
      return image.bestThumbnail.url || image.bestThumbnail.uri;
    }
  }

  return null;
};

export const EachSongQueue = memo(function EachSongQueue({ song, index }) {
  const { title, artist, id, image } = song;
  const playerState = usePlaybackState()
  const currentPlaying = useActiveTrack()
  const resolved = resolveArtworkUri(image);

  const handlePress = async () => {
    try {
      // Get the current queue and find the actual index of this song
      const currentQueue = await TrackPlayer.getQueue();
      const actualIndex = currentQueue.findIndex(song => song.id === id);

      if (actualIndex !== -1) {
        SkipToTrack(actualIndex);
      } else {
        console.warn('Song not found in current queue:', id);
      }
    } catch (error) {
      console.error('Error skipping to track:', error);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: "center",
        paddingVertical: 8,
        paddingLeft: 6,
        paddingRight: 0,
        borderRadius: 12,
        marginVertical: 4,
        backgroundColor: id === currentPlaying?.id ? 'rgba(255,255,255,0.1)' : 'transparent',
      }}
    >
      <View style={{ position: 'relative' }}>
        <FastImage
          source={((id === currentPlaying?.id ?? "") && playerState.state === "playing") ? require("../../Images/playing.gif") : (resolved ? { uri: resolved } : { uri: 'https://via.placeholder.com/60x60/cccccc/000000?text=No+Img' })}
          resizeMode={FastImage.resizeMode.cover}
          style={{
            height: 50,
            width: 50,
            borderRadius: 8,
            opacity: id === currentPlaying?.id ? 0.7 : 1,
          }}
        />
        {id === currentPlaying?.id && playerState.state === "playing" && (
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: 8,
          }}>
            <FastImage
              source={require("../../Images/playing.gif")}
              style={{ width: 24, height: 24 }}
            />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <PlainText
          text={title?.toString()?.replace(/&quot;/g, "\"")?.replace(/&amp;/g, "and")?.replace(/&#039;/g, "'")?.replace(/&trade;/g, "™")}
          style={{
            color: id === currentPlaying?.id ? '#1DB954' : 'white',
            fontWeight: id === currentPlaying?.id ? 'bold' : 'normal',
          }}
          numberOfLines={1}
        />
        <SmallText
          text={artist?.toString()?.replace(/&quot;/g, "\"")?.replace(/&amp;/g, "and")?.replace(/&#039;/g, "'")?.replace(/&trade;/g, "™")}
          numberOfLines={1}
        />
      </View>

      <TouchableOpacity
        onPress={() => DownloadSong(song)}
        style={{ padding: 8 }}
      >
        <AntDesign name="download" size={22} color="white" />
      </TouchableOpacity>
    </Pressable>
  );
})
