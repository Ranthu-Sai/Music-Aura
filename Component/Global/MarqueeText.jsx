import React, {useEffect, useState, useContext, useRef} from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {ThemeContext} from '../../Context/Context';

import {Spacer} from './Spacer';

export const MarqueeText = ({text, style, nospace}) => {
  const theme = useTheme();
  const {fontSize} = useContext(ThemeContext);
  const {width: screenWidth} = Dimensions.get('window');

  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);

  let Size = screenWidth * 0.055;
  if (fontSize === 'Medium') {
    Size = screenWidth * 0.055;
  } else if (fontSize === 'Small') {
    Size = screenWidth * 0.045;
  } else {
    Size = screenWidth * 0.065;
  }

  const baseStyle = {
    fontWeight: '900',
    color: theme.colors.text,
    fontSize: Size,
    fontFamily: 'roboto',
  };
  const mergedStyle = Array.isArray(style)
    ? [baseStyle, ...style]
    : [baseStyle, style];

  useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      const scrollDistance = textWidth - containerWidth + 30; // 30 is extra padding

      const startAnimation = () => {
        animatedValue.setValue(0);
        animationRef.current = Animated.loop(
          Animated.sequence([
            Animated.delay(1500),
            Animated.timing(animatedValue, {
              toValue: -scrollDistance,
              duration: textWidth * 30, // Adjust speed based on text length
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.delay(1000),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        );
        animationRef.current.start();
      };

      startAnimation();
    } else {
      if (animationRef.current) {
        animationRef.current.stop();
      }
      animatedValue.setValue(0);
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [textWidth, containerWidth, text, animatedValue]);

  return (
    <>
      {!nospace && <Spacer />}
      <View
        style={{overflow: 'hidden', width: '100%'}}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
        <View style={{flexDirection: 'row', width: 2000}}>
          <Animated.View
            style={{
              transform: [{translateX: animatedValue}],
            }}>
            <Text
              onLayout={e => setTextWidth(e.nativeEvent.layout.width)}
              numberOfLines={1}
              style={[...mergedStyle, {width: undefined}]}>
              {text}
            </Text>
          </Animated.View>
        </View>
      </View>
      {!nospace && <Spacer />}
    </>
  );
};
