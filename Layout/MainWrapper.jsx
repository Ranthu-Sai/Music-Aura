import { SafeAreaView } from "react-native-safe-area-context";
import { memo, useContext } from "react";
import { StatusBar } from "react-native";
import Context from "../Context/Context";
export const MainWrapper = memo(function MainWrapper({children}) {
  const { currentThemeColors } = useContext(Context);
  return (
    <SafeAreaView style={{flex:1,backgroundColor: currentThemeColors.background}}>
        <StatusBar backgroundColor={currentThemeColors.background} animated={true}/>
        {children}
    </SafeAreaView>
  );
})
