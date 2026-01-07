import {Dimensions, Text} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {useContext} from 'react';
import {ThemeContext} from '../../Context/Context';

export const PlainText = ({text, style, numberOfLine}) => {
  const theme = useTheme();
  const {fontSize} = useContext(ThemeContext);
  const width = Dimensions.get('window').width;
  let Size = width * 0.035;
  if (fontSize === 'Medium') {
    Size = width * 0.035;
  } else if (fontSize === 'Small') {
    Size = width * 0.03;
  } else {
    Size = width * 0.04;
  }
  const baseStyle = {
    color: theme.colors.text,
    fontSize: Size,
    fontWeight: '500',
    paddingRight: 10,
    fontFamily: 'roboto',
  };
  const mergedStyle = Array.isArray(style)
    ? [baseStyle, ...style]
    : [baseStyle, style];
  return (
    <Text numberOfLines={numberOfLine ? numberOfLine : 2} style={mergedStyle}>
      {text}
    </Text>
  );
};
