import Animated, {
  interpolate,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import {Dimensions, View, Text} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export const LikedPagesTopHeader = ({
  AnimatedRef,
  url,
  generated,
  hideOverlay = false,
  disableCollapse = false,
  extendBgToTop = false,
}) => {
  const SizeOfSmallImage = Dimensions.get('window').width * 0.5;
  const insets = useSafeAreaInsets();
  const extraTop = extendBgToTop ? insets.top : 0;
  const ScrollOffset = useScrollViewOffset(AnimatedRef);
  const AnimatedImageStyle = useAnimatedStyle(() => {
    if (disableCollapse) {
      return {transform: [{translateY: 0}, {scale: 1}]};
    }
    return {
      transform: [
        {
          translateY: interpolate(
            ScrollOffset.value,
            [-SizeOfSmallImage, 0, SizeOfSmallImage],
            [-SizeOfSmallImage / 2, 0, SizeOfSmallImage * 1.2],
          ),
        },
        {
          scale: interpolate(
            ScrollOffset.value,
            [SizeOfSmallImage, 0, SizeOfSmallImage],
            [0, 1, 0],
          ),
        },
      ],
    };
  });
  //Animated For Large Image
  const AnimatedImageStyle2 = useAnimatedStyle(() => {
    if (disableCollapse) {
      return {transform: [{translateY: 0}]};
    }
    return {
      transform: [
        {
          translateY: interpolate(
            ScrollOffset.value,
            [-SizeOfSmallImage, 0, SizeOfSmallImage],
            [-SizeOfSmallImage / 2, 0, SizeOfSmallImage * 1.2],
          ),
        },
      ],
    };
  });
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        height: SizeOfSmallImage * 1.4 + extraTop,
        paddingTop: extraTop,
      }}>
      <View style={{elevation: 10}}>
        {generated ? (
          <Animated.View
            style={[
              {
                height: SizeOfSmallImage,
                width: SizeOfSmallImage,
                borderRadius: 10,
                overflow: 'hidden',
              },
              AnimatedImageStyle,
            ]}>
            <LinearGradient
              colors={generated.colors || ['#4E54C8', '#8F94FB']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
              {generated.icon === 'heart' && (
                <AntDesign
                  name="heart"
                  size={SizeOfSmallImage * 0.35}
                  color="#FFFFFF"
                />
              )}
              {generated.icon === 'playlist' && (
                <MaterialCommunityIcons
                  name="playlist-music"
                  size={SizeOfSmallImage * 0.35}
                  color="#FFFFFF"
                />
              )}
              {generated.icon === 'clock' && (
                <AntDesign
                  name="clockcircle"
                  size={SizeOfSmallImage * 0.35}
                  color="#FFFFFF"
                />
              )}
              {generated.title && (
                <Text
                  style={{
                    color: '#FFFFFF',
                    marginTop: 8,
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                  {generated.title}
                </Text>
              )}
            </LinearGradient>
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              {
                height: SizeOfSmallImage,
                width: SizeOfSmallImage,
                borderRadius: 10,
                overflow: 'hidden',
              },
              AnimatedImageStyle,
            ]}>
            <Animated.Image
              source={url}
              resizeMode="cover"
              style={{height: '100%', width: '100%'}}
            />
          </Animated.View>
        )}
      </View>
      {generated ? (
        <Animated.View
          style={[
            {
              height: SizeOfSmallImage * 2 + extraTop,
              width: '100%',
              position: 'absolute',
              zIndex: -1,
            },
            AnimatedImageStyle2,
          ]}>
          <LinearGradient
            colors={generated.bgColors || ['#2C2C54', '#24243e']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={{flex: 1}}
          />
        </Animated.View>
      ) : (
        <Animated.Image
          blurRadius={10}
          resizeMode="cover"
          source={url}
          style={[
            {
              height: SizeOfSmallImage * 2 + extraTop,
              width: '100%',
              position: 'absolute',
              zIndex: -1,
            },
            AnimatedImageStyle2,
          ]}
        />
      )}
      {!hideOverlay && (
        <View
          style={{
            height: SizeOfSmallImage * 2 + extraTop,
            width: '100%',
            position: 'absolute',
            zIndex: -1,
            backgroundColor: 'rgba(33,33,33,0.7)',
          }}
        />
      )}
    </View>
  );
};
