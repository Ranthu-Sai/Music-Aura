import { Pressable, View, TouchableOpacity, Animated, InteractionManager } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import { memo, useMemo, useRef, useCallback } from "react";
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

// Static styles for better performance
const styles = {
  pressable: {
    flexDirection: 'row',
    gap: 12,
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 12,
    marginVertical: 4,
  },
  pressableActive: {
    flexDirection: 'row',
    gap: 12,
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  imageContainer: { position: 'relative' },
  image: {
    height: 50,
    width: 50,
    borderRadius: 8,
    opacity: 1,
  },
  textContainer: { flex: 1 },
  downloadButton: { padding: 8 },
};

const EachSongQueueComponent = ({ song, index, playerState, currentTrackId, onRemove }) => {
  // Extract primitives from song object
  const id = song?.id;
  const title = song?.title;
  const artist = song?.artist;

  // Normalize artwork from various possible properties
  const imageSource = useMemo(() =>
    song?.artwork || song?.image || song?.thumbnail || song?.thumbnails || song?.bestThumbnail || null,
    [song?.artwork, song?.image, song?.thumbnail, song?.thumbnails, song?.bestThumbnail]
  );

  // Check if this is the currently playing track
  const isCurrentTrack = id === currentTrackId;
  const isPlaying = playerState === 'playing' && isCurrentTrack;
  const resolved = useMemo(() => resolveArtworkUri(imageSource), [imageSource]);
  const swipeableRef = useRef(null);

  const handlePress = useCallback(async () => {
    try {
      const currentQueue = await TrackPlayer.getQueue();
      const actualIndex = currentQueue.findIndex(s => s.id === id);
      if (actualIndex !== -1) {
        SkipToTrack(actualIndex);
      }
    } catch (error) {
      console.error('Error skipping to track:', error);
    }
  }, [id]);

  const handleRemovePress = useCallback(() => {
    swipeableRef.current?.close();
    onRemove(index, id);
  }, [index, id, onRemove]);

  const renderRightActions = useCallback((progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
    });
    return (
      <TouchableOpacity
        onPress={handleRemovePress}
        style={{ width: 80, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' }}
      >
        <MaterialCommunityIcons name="delete-outline" size={28} color="white" />
      </TouchableOpacity>
    );
  }, [handleRemovePress]);

  const handleDownload = useCallback(() => {
    // PERFORMANCE: Defer heavy download operation
    InteractionManager.runAfterInteractions(() => {
      DownloadSong(song);
    });
  }, [song]);

  // Memoize style based on isCurrentTrack
  const pressableStyle = useMemo(() =>
    isCurrentTrack ? styles.pressableActive : styles.pressable,
    [isCurrentTrack]
  );

  // Memoize text style based on isCurrentTrack
  const textStyle = useMemo(() => ({
    color: isCurrentTrack ? '#1DB954' : 'white',
    fontWeight: isCurrentTrack ? 'bold' : 'normal',
  }), [isCurrentTrack]);

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
        style={pressableStyle}
      >
        <View style={styles.imageContainer}>
          <FastImage
            source={isPlaying
              ? require("../../Images/playing.gif")
              : (resolved ? { uri: resolved } : require("../../Images/Logo.jpg"))}
            resizeMode={FastImage.resizeMode.cover}
            style={styles.image}
          />
        </View>

        <View style={styles.textContainer}>
          <PlainText
            text={title}
            style={textStyle}
            numberOfLines={1}
          />
          <SmallText
            text={artist}
            numberOfLines={1}
          />
        </View>

        <TouchableOpacity
          onPress={handleDownload}
          style={styles.downloadButton}
        >
          <AntDesign name="download" size={22} color="white" />
        </TouchableOpacity>
      </Pressable>
    </Swipeable>
  );
};

// Custom memo with MINIMAL comparison - only check song.id (fastest)
export const EachSongQueue = memo(EachSongQueueComponent, (prev, next) =>
  prev.song?.id === next.song?.id &&
  prev.playerState === next.playerState &&
  prev.currentTrackId === next.currentTrackId
);
