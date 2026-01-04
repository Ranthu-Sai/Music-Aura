import { View } from "react-native";

export const SpaceBetween = ({children,style}) => {
  return (
    <View style={Array.isArray(style) ? [{
      justifyContent:"space-between",
      alignItems:'center',
      flexDirection:"row",
    }, ...style] : [{
      justifyContent:"space-between",
      alignItems:'center',
      flexDirection:"row",
    }, style]}>
      {children}
    </View>
  );
};
