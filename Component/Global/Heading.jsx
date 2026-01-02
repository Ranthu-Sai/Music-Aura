import { Dimensions, Text } from "react-native";
import { useTheme } from "@react-navigation/native";
import { Spacer } from "./Spacer";
import { useContext } from "react";
import { ThemeContext } from "../../Context/Context";

export const Heading = ({text, style, nospace}) => {
  const theme = useTheme()
  const { fontSize } = useContext(ThemeContext);
  const width = Dimensions.get('window').width
  let Size = width * 0.055;
  if (fontSize === "Medium"){
    Size = width * 0.055
  } else if (fontSize === "Small"){
    Size = width * 0.045
  } else {
    Size = width * 0.065
  }
  return (
   <>
     {!nospace && <Spacer/>}
     <Text numberOfLines={2} style={{
       fontWeight:900,
       color:theme.colors.text,
       fontSize:Size,
       fontFamily:'roboto',
       ...style,
     }}>{text}</Text>
     {!nospace && <Spacer/>}
   </>
  );
};
