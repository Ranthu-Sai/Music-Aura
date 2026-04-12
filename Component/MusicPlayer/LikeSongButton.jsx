import {useTheme} from '@react-navigation/native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import {memo, useContext, useEffect, useState, useCallback} from 'react';
import {
  DeleteALikedSong,
  GetLikedSongs,
  SetLikedSongs,
} from '../../LocalStorage/StoreLikedSongs';
import {Pressable} from 'react-native';
import Context from '../../Context/Context';

export const LikeSongButton = memo(function LikeSongButton({size, color}) {
  const {currentPlaying} = useContext(Context);
  const theme = useTheme();
  const [Liked, setLiked] = useState(false);
  const getIsLiked = useCallback(async () => {
    if (!currentPlaying?.id) {
      setLiked(false);
      return;
    }
    try {
      const LikedSongs = await GetLikedSongs();
      if (LikedSongs?.songs?.[currentPlaying.id]) {
        setLiked(true);
      } else {
        setLiked(false);
      }
    } catch (error) {
      setLiked(false);
    }
  }, [currentPlaying]);
  async function LikeASong() {
    if (!currentPlaying?.id) {
      return;
    }
    try {
      const LikedSongs = await GetLikedSongs();
      if (!LikedSongs?.songs?.[currentPlaying.id]) {
        if (
          currentPlaying.title &&
          currentPlaying.artist &&
          currentPlaying.id &&
          currentPlaying.duration
        ) {
          setLiked(true);
          await SetLikedSongs(
            currentPlaying?.title,
            currentPlaying?.artist,
            currentPlaying?.artwork || currentPlaying?.image,
            currentPlaying?.id,
            currentPlaying?.url || currentPlaying?.downloadUrl,
            currentPlaying?.duration,
            currentPlaying?.language,
          );
        }
      } else {
        setLiked(false);
        await DeleteALikedSong(currentPlaying.id);
      }
    } catch (error) {
      // Error silently handled
    }
  }
  useEffect(() => {
    getIsLiked();
  }, [currentPlaying, getIsLiked]);
  return (
    <Pressable
      hitSlop={4}
      android_ripple={{color: 'rgba(255, 255, 255, 0.2)', radius: 20, foreground: true}}
      onPress={() => {
        LikeASong();
      }}>
      <AntDesign
        name={Liked ? 'heart' : 'hearto'}
        size={size ? size : 15}
        color={Liked ? 'rgb(234,113,113)' : color || theme.colors.text}
      />
    </Pressable>
  );
});
