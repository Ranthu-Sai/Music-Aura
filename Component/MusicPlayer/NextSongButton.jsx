import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import {useTheme} from '@react-navigation/native';
import {Pressable} from 'react-native';
import {PlayNextSong} from '../../MusicPlayerFunctions';

export const NextSongButton = ({size, color}) => {
  const theme = useTheme();
  return (
    <Pressable
      hitSlop={4}
      android_ripple={{color: 'rgba(255, 255, 255, 0.2)', radius: 20, foreground: true}}
      style={{
        padding: 12,
      }}
      onPress={() => {
        PlayNextSong();
      }}>
      <FontAwesome6
        name={'forward-step'}
        size={size ? size : 20}
        color={color || theme.colors.text}
      />
    </Pressable>
  );
};
