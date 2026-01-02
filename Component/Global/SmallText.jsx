import { Text } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useContext } from "react";
import { ThemeContext } from "../../Context/Context";

export const SmallText = ({text, color, style, maxLine, selectable}) => {
  const theme = useTheme()
  const { fontSize } = useContext(ThemeContext);
  let Size = 10;
  if (fontSize === "Medium"){
    Size = 10
  } else if (fontSize === "Small"){
    Size = 10
  } else {
    Size = 11
  }
  return (
    <Text selectable={selectable} numberOfLines={maxLine ? maxLine : 2} style={{
      color:(!color) ? theme.colors.textSecondary : color,
      fontSize:Size,
      fontFamily:'roboto',
      ...style,
    }}>{text}</Text>
  );
};
