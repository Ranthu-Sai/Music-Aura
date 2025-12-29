import { Pressable, View, TouchableOpacity, Animated } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import { memo, useMemo, useRef } from "react";
import { SkipToTrack } from "../../MusicPlayerFunctions";
import TrackPlayer from "react-native-track-player";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { DownloadSong } from "../../Utils/DownloadHelper";
import { Swipeable } from "react-native-gesture-handler";

// Helper to normalize artwork value to a URL string
const resolveArtworkUri = (image) => {
  if (!image) { return null; }
  if (typeof image === 'string' && image.length > 0) { return image; }
  if (typeof image === 'object') {
    if (Array.isArray(image) && image.length > 0) {
      const best = image[image.length - 1] || image[0];
      if (!best) { return null; }
      if (typeof best === 'string') { return best; }
      if (best.url || best.link || best.uri) { return best.url || best.link || best.uri; }
    }
    if (image.url || image.uri || image.link) { return image.url || image.uri || image.link; }
    if (image.thumbnail) {
      return typeof image.thumbnail === 'string' ? image.thumbnail : (image.thumbnail.url || image.thumbnail.uri);
    }
    if (image.thumbnails && Array.isArray(image.thumbnails) && image.thumbnails.length > 0) {
      const best = image.thumbnails[image.thumbnails.length - 1] || image.thumbnails[0];
      return best?.url || best?.uri || best;
    }
  }
  return null;
};

export const EachSongQueue = memo(function EachSongQueue({ song, index, isActive, isPlaying, onRemove }) {
  const { title, artist, id, image } = song;
  const resolved = useMemo(() => resolveArtworkUri(image), [image]);
  const swipeableRef = useRef(null);

  const handlePress = async () => {
    try {
      const currentQueue = await TrackPlayer.getQueue();
      const actualIndex = currentQueue.findIndex(s => s.id === id);
      if (actualIndex !== -1) {
        SkipToTrack(actualIndex);
      }
    } catch (error) {
      console.error('Error skipping to track:', error);
    }
  };

  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
    });
    return (
      <TouchableOpacity 
        onPress={() => {
          swipeableRef.current?.close();
          onRemove(index, id);
        }}
        style={{ width: 80, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' }}
      >
        <MaterialCommunityIcons name="delete-outline" size={28} color="white" />
      </TouchableOpacity>
    );
  };

  const normalizedTitle = useMemo(() => 
    title?.toString()?.replace(/&quot;/g, "\"")?.replace(/&amp;/g, "and")?.replace(/&#039;/g, "'")?.replace(/&trade;/g, "™"),
    [title]
  );

  const normalizedArtist = useMemo(() => 
    artist?.toString()?.replace(/&quot;/g, "\"")?.replace(/&amp;/g, "and")?.replace(/&#039;/g, "'")?.replace(/&trade;/g, "™"),
    [artist]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
        style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: "center",
          paddingVertical: 8,
          paddingLeft: 6,
          paddingRight: 10,
          borderRadius: 12,
          marginVertical: 4,
          backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        }}
      >
        <View style={{ position: 'relative' }}>
          <FastImage
            source={isPlaying ? require("../../Images/playing.gif") : (resolved ? { uri: resolved } : require("../../Images/Logo.jpg"))}
            resizeMode={FastImage.resizeMode.cover}
            style={{
              height: 50,
              width: 50,
              borderRadius: 8,
              opacity: isActive ? 0.7 : 1,
            }}
          />
          {isPlaying && (
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
            text={normalizedTitle}
            style={{
              color: isActive ? '#1DB954' : 'white',
              fontWeight: isActive ? 'bold' : 'normal',
            }}
            numberOfLines={1}
          />
          <SmallText
            text={normalizedArtist}
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
    </Swipeable>
  );
})
