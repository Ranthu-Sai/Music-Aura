import {Dimensions, View, Image} from 'react-native';

export const PlaylistTopHeader = ({url}) => {
  const SizeOfSmallImage = Dimensions.get('window').width * 0.9;
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        height: SizeOfSmallImage * 1.4,
      }}>
      <View
        style={{
          elevation: 10,
        }}>
        <Image
          source={
            url
              ? {
                  uri: url,
                }
              : require('../../Images/LikedSong.png')
          }
          style={[
            {
              height: SizeOfSmallImage,
              width: SizeOfSmallImage,
              borderRadius: 10,
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};
