import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { RootRoute } from "./Route/RootRoute";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Dimensions } from "react-native";
import ContextState from "./Context/ContextState";
import { ThemeContext } from "./Context/Context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { RouteOnboarding } from "./Route/OnboardingScreen/RouteOnboarding";
import { InitialScreen } from "./Route/InitialScreen";
// import CodePush from "react-native-code-push";
import React, { useEffect, useContext } from "react";

const Stack = createNativeStackNavigator();

function ThemedNavigation() {
  const width = Dimensions.get("window").width;
  const { currentThemeColors } = useContext(ThemeContext);
  const isLight = currentThemeColors.background === '#FFFFFF';
  const MyTheme = {
    ...DefaultTheme,
    dark: !isLight,
    colors: {
      ...DefaultTheme.colors,
      primary: currentThemeColors.primary,
      text: currentThemeColors.text,
      textSecondary: currentThemeColors.secondaryText,
      white: "white",
      spacing: 10,
      headingSize: width * 0.085,
      fontSize: width * 0.045,
      disabled: 'rgb(131,131,131)',
      background: currentThemeColors.background,
    },
  };

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: currentThemeColors.background },
      }}>
        <Stack.Screen name="Initial" component={InitialScreen} />
        <Stack.Screen name="Onboarding" component={RouteOnboarding} />
        <Stack.Screen name="MainRoute" component={RootRoute} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// App is a thin wrapper that mounts providers and navigation
function App() {
  useEffect(() => {}, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ContextState>
        <BottomSheetModalProvider>
          <ThemedNavigation />
        </BottomSheetModalProvider>
      </ContextState>
    </GestureHandlerRootView>
  );
}

export default App;
