import {Pressable} from 'react-native';
import {useTheme} from '@react-navigation/native';
import Entypo from 'react-native-vector-icons/Entypo';

export const EachSongMenuButton = ({Onpress}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Onpress();
      }}
      style={{
        padding: 10,
        backgroundColor: 'transparent', // Transparent background for a cleaner look
        borderRadius: 100,
        marginRight: 0, // Reset margin since it's now absolutely positioned
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Entypo
        name={'dots-three-vertical'}
        size={18}
        color={theme.colors.text}
        style={{opacity: 0.6}}
      />
    </Pressable>
  );
};
