import {
  Pressable,
  View,
  Text,
  TouchableOpacity,
  InteractionManager,
  StyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import {PlainText} from '../Global/PlainText';
import {SmallText} from '../Global/SmallText';
import {memo, useMemo, useRef, useCallback} from 'react';
import {SkipToTrack} from '../../MusicPlayerFunctions';
import TrackPlayer from 'react-native-track-player';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {DownloadSong} from '../../Utils/DownloadHelper';
import {Swipeable} from 'react-native-gesture-handler';

// Helper to normalize artwork value to a URL string
const resolveArtworkUri = image => {
  if (!image) {
    return null;
  }
  if (typeof image === 'string' && image.length > 0) {
    return image;
  }
  if (typeof image === 'object') {
    if (Array.isArray(image) && image.length > 0) {
      const best = image[image.length - 1] || image[0];
      if (!best) {
        return null;
      }
      if (typeof best === 'string') {
        return best;
      }
      if (best.url || best.link || best.uri) {
        return best.url || best.link || best.uri;
      }
    }
    if (image.url || image.uri || image.link) {
      return image.url || image.uri || image.link;
    }
    if (image.thumbnail) {
      return typeof image.thumbnail === 'string'
        ? image.thumbnail
        : image.thumbnail.url || image.thumbnail.uri;
    }
    if (
      image.thumbnails &&
      Array.isArray(image.thumbnails) &&
      image.thumbnails.length > 0
    ) {
      const best =
        image.thumbnails[image.thumbnails.length - 1] || image.thumbnails[0];
      return best?.url || best?.uri || best;
    }
  }
  return null;
};

const styles = StyleSheet.create({
  pressable: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 12,
    marginVertical: 4,
  },
  pressableActive: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 9,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 14,
    marginVertical: 4,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.38)',
  },
  imageContainer: {position: 'relative'},
  image: {
    height: 50,
    width: 50,
    borderRadius: 8,
    opacity: 1,
  },
  textContainer: {flex: 1},
  downloadButton: {padding: 8},
  nowPlayingTag: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nowPlayingTagText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

const EachSongQueueComponent = ({
  song,
  index,
  playerState,
  currentTrackId,
  onRemove,
}) => {
  // Extract primitives from song object
  const id = song?.id;
  const title = song?.title;
  const artist = song?.artist;

  // Normalize artwork from various possible properties
  const imageSource = useMemo(
    () =>
      song?.artwork ||
      song?.image ||
      song?.thumbnail ||
      song?.thumbnails ||
      song?.bestThumbnail ||
      null,
    [
      song?.artwork,
      song?.image,
      song?.thumbnail,
      song?.thumbnails,
      song?.bestThumbnail,
    ],
  );

  // Check if this is the currently playing track
  const isCurrentTrack = id === currentTrackId;
  const isPlaying =
    (playerState === 'playing' || playerState === 3) && isCurrentTrack;
  const resolved = useMemo(() => resolveArtworkUri(imageSource), [imageSource]);
  const swipeableRef = useRef(null);
  const skipInProgressRef = useRef(false);

  const handlePress = useCallback(async () => {
    if (skipInProgressRef.current) {
      return;
    }

    skipInProgressRef.current = true;
    try {
      const currentQueue = await TrackPlayer.getQueue();
      const actualIndex = currentQueue.findIndex(
        (track, idx) =>
          track?.id === id ||
          (song?._originalIndex !== undefined && idx === song._originalIndex) ||
          (idx === index && track?.id),
      );

      if (actualIndex !== -1 && actualIndex !== null) {
        SkipToTrack(actualIndex);
      } else {
        console.warn('Could not find track in queue:', id);
      }
    } catch (error) {
      console.error('Error skipping to track:', error);
    } finally {
      skipInProgressRef.current = false;
    }
  }, [id, index, song?._originalIndex]);

  const handleRemovePress = useCallback(() => {
    swipeableRef.current?.close();
    onRemove(index, id);
  }, [index, id, onRemove]);

  const renderRightActions = useCallback(
    () => (
      <TouchableOpacity
        onPress={handleRemovePress}
        style={{
          width: 80,
          backgroundColor: '#FF3B30',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <MaterialCommunityIcons
          name="delete-outline"
          size={28}
          color="white"
        />
      </TouchableOpacity>
    ),
    [handleRemovePress],
  );

  const handleDownload = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      DownloadSong(song);
    });
  }, [song]);

  const pressableStyle = useMemo(
    () => (isCurrentTrack ? styles.pressableActive : styles.pressable),
    [isCurrentTrack],
  );

  const textStyle = useMemo(
    () => ({
      color: isCurrentTrack ? '#1DB954' : 'white',
      fontWeight: isCurrentTrack ? 'bold' : 'normal',
      flexShrink: 1,
    }),
    [isCurrentTrack],
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}>
      <Pressable
        onPress={handlePress}
        android_ripple={{color: 'rgba(255,255,255,0.1)'}}
        style={pressableStyle}>
        <View style={styles.imageContainer}>
          <FastImage
            source={
              isPlaying
                ? require('../../Images/playing.gif')
                : resolved
                ? {uri: resolved}
                : require('../../Images/Logo.jpg')
            }
            resizeMode={FastImage?.resizeMode?.cover || 'cover'}
            style={styles.image}
          />
        </View>

        <View style={styles.textContainer}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
            {isCurrentTrack && (
              <View style={styles.nowPlayingTag}>
                <Text style={styles.nowPlayingTagText}>PLAYING</Text>
              </View>
            )}
            <PlainText text={title} style={textStyle} numberOfLines={1} />
          </View>
          <SmallText text={artist} numberOfLines={1} />
        </View>

        <TouchableOpacity
          onPress={handleDownload}
          style={styles.downloadButton}>
          <AntDesign name="download" size={22} color="white" />
        </TouchableOpacity>
      </Pressable>
    </Swipeable>
  );
};

// Custom memo with comparison
export const EachSongQueue = memo(
  EachSongQueueComponent,
  (prev, next) =>
    prev.song?.id === next.song?.id &&
    prev.playerState === next.playerState &&
    prev.currentTrackId === next.currentTrackId &&
    prev.song?._originalIndex === next.song?._originalIndex,
);
