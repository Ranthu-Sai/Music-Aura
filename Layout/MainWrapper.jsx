import { SafeAreaView } from "react-native-safe-area-context";
import { memo, useContext } from "react";
import { StatusBar } from "react-native";
import { ThemeContext } from "../Context/Context";
export const MainWrapper = memo(function MainWrapper({children}) {
  const { currentThemeColors } = useContext(ThemeContext);
  const bgColor = currentThemeColors?.background || '#101010';
  
  return (
    <SafeAreaView style={{flex:1, backgroundColor: bgColor}}>
        <StatusBar 
          backgroundColor={bgColor} 
          barStyle="light-content" 
          translucent={true}
          animated={true}
        />
        {children}
    </SafeAreaView>
  );
})
