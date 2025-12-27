import { Pressable, View } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import { memo } from "react";
import { SkipToTrack } from "../../MusicPlayerFunctions";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";
import TrackPlayer from "react-native-track-player";

// Helper to normalize artwork value to a URL string
const resolveArtworkUri = (image) => {
  if (!image) {return null;}

  // If it's already a string URL
  if (typeof image === 'string' && image.length > 0) {return image;}

  // If it's an object
  if (typeof image === 'object') {
    // Array of thumbnails
    if (Array.isArray(image) && image.length > 0) {
      const best = image[image.length - 1] || image[0];
      if (!best) {return null;}
      if (typeof best === 'string') {return best;}
      if (best.url) {return best.url;}
      if (best.link) {return best.link;}
      if (best.uri) {return best.uri;}
      if (best.thumbnail && (best.thumbnail.url || best.thumbnail.uri)) {return best.thumbnail.url || best.thumbnail.uri;}
    }

    // Common fields
    if (image.url) {return image.url;}
    if (image.uri) {return image.uri;}
    if (image.link) {return image.link;}

    // Nested thumbnail object
    if (image.thumbnail) {
      if (typeof image.thumbnail === 'string') {return image.thumbnail;}
      if (image.thumbnail.url) {return image.thumbnail.url;}
      if (image.thumbnail.uri) {return image.thumbnail.uri;}
    }

    // Thumbnails array property
    if (image.thumbnails && Array.isArray(image.thumbnails) && image.thumbnails.length > 0) {
      const best = image.thumbnails[image.thumbnails.length - 1] || image.thumbnails[0];
      if (best?.url) {return best.url;}
      if (best?.uri) {return best.uri;}
      if (typeof best === 'string') {return best;}
    }

    // Some providers nest images under 'images' or 'bestThumbnail'
    if (image.images && Array.isArray(image.images) && image.images.length > 0) {
      const best = image.images[image.images.length - 1] || image.images[0];
      if (best?.url) {return best.url;}
      if (best?.uri) {return best.uri;}
      if (typeof best === 'string') {return best;}
    }

    if (image.bestThumbnail && (image.bestThumbnail.url || image.bestThumbnail.uri)) {
      return image.bestThumbnail.url || image.bestThumbnail.uri;
    }
  }

  return null;
};

export const EachSongQueue = memo(function EachSongQueue({ title, artist, index, image, id }) {
  const playerState = usePlaybackState()
  const currentPlaying = useActiveTrack()

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
    <Pressable onPress={handlePress} style={{
      flexDirection: 'row',
      gap: 10,
      alignItems: "center",
      maxHeight: 60,
      elevation: 10,
      marginVertical: 5,
      marginBottom: 6,
    }}>
      {(() => {
        const resolved = resolveArtworkUri(image);
          if (!resolved && image) {
            console.log('[Queue] Unresolved artwork shape:', image);
          }
        return (
          <FastImage source={((id === currentPlaying?.id ?? "") && playerState.state === "playing") ? require("../../Images/playing.gif") : ((id === currentPlaying?.id ?? "") && playerState.state !== "playing") ? require("../../Images/songPaused.gif") : (resolved ? { uri: resolved } : { uri: 'https://via.placeholder.com/60x60/cccccc/000000?text=No+Img' })}
            resizeMode={FastImage.resizeMode.cover}
            style={{
              height: 60,
              width: 60,
              borderRadius: 10,
            }} />
        )
      })()}

      <View>
        <PlainText text={title?.toString()?.replaceAll("&quot;", "\"")?.replaceAll("&amp;", "and")?.replaceAll("&#039;", "'")?.replaceAll("&trade;", "™")} style={{ paddingRight: 15 }} />
        <SmallText text={artist?.toString()?.replaceAll("&quot;", "\"")?.replaceAll("&amp;", "and")?.replaceAll("&#039;", "'")?.replaceAll("&trade;", "™")} style={{ paddingRight: 15 }} />
      </View>
    </Pressable>
  );
})
