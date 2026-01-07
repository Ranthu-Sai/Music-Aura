import {View} from 'react-native';
import FastImage from 'react-native-fast-image';
export const LoadingComponent = ({loading, height}) => {
  return (
    <>
      {loading && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}>
          <FastImage
            source={require('../../Images/loading.gif')}
            style={{
              height: 80,
              width: 80,
            }}
          />
        </View>
      )}
    </>
  );
};
