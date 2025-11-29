import { Dimensions, Text } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useContext } from "react";
import Context from "../../Context/Context";

export const PlainText = ({text,style, numberOfLine}) => {
  const theme = useTheme()
  const { fontSize } = useContext(Context);
  const width = Dimensions.get('window').width;
  let Size = width * 0.035;
  if (fontSize === "Medium"){
    Size = width * 0.035
  } else if (fontSize === "Small"){
    Size = width * 0.030
  } else {
    Size = width * 0.040
  }
  return (
    <Text numberOfLines={numberOfLine ? numberOfLine : 2}  style={{
      color:theme.colors.text,
      fontSize:Size,
      fontWeight:500,
      paddingRight:10,
      fontFamily:'roboto',
      ...style,
    }}>{text}</Text>
  );
};
