import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {RootRoute} from './Route/RootRoute';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Dimensions} from 'react-native';
import ContextState from './Context/ContextState';
import {ThemeContext} from './Context/Context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {PaperProvider, MD3DarkTheme, MD3LightTheme} from 'react-native-paper';
import {RouteOnboarding} from './Route/OnboardingScreen/RouteOnboarding';
import {InitialScreen} from './Route/InitialScreen';
// import CodePush from "react-native-code-push";
import React, {useEffect, useContext} from 'react';
import LoginScreen from './Component/Auth/LoginScreen';

const Stack = createNativeStackNavigator();

function ThemedNavigation() {
  const width = Dimensions.get('window').width;
  const {currentThemeColors} = useContext(ThemeContext);
  const isLight = currentThemeColors.background === '#FFFFFF';
  const paperTheme = {
    ...(isLight ? MD3LightTheme : MD3DarkTheme),
    colors: {
      ...(isLight ? MD3LightTheme.colors : MD3DarkTheme.colors),
      primary: currentThemeColors.primary,
      background: currentThemeColors.background,
      surface: currentThemeColors.secondaryBackground,
      onSurface: currentThemeColors.text,
      onSurfaceVariant: currentThemeColors.secondaryText,
      outline: currentThemeColors.secondaryText,
      backdrop: 'rgba(0,0,0,0.5)',
    },
  };
  const MyTheme = {
    ...DefaultTheme,
    dark: !isLight,
    colors: {
      ...DefaultTheme.colors,
      primary: currentThemeColors.primary,
      text: currentThemeColors.text,
      card: currentThemeColors.secondaryBackground,
      border: currentThemeColors.secondaryText,
      notification: currentThemeColors.primary,
      textSecondary: currentThemeColors.secondaryText,
      white: 'white',
      spacing: 10,
      headingSize: width * 0.085,
      fontSize: width * 0.045,
      disabled: 'rgb(131,131,131)',
      background: currentThemeColors.background,
    },
  };

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={MyTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: {backgroundColor: currentThemeColors.background},
          }}>
          <Stack.Screen name="Initial" component={InitialScreen} />
          <Stack.Screen name="Onboarding" component={RouteOnboarding} />
          <Stack.Screen name="MainRoute" component={RootRoute} />
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

// App is a thin wrapper that mounts providers and navigation
function App() {
  useEffect(() => {}, []);
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <ContextState>
        <BottomSheetModalProvider>
          <ThemedNavigation />
        </BottomSheetModalProvider>
      </ContextState>
    </GestureHandlerRootView>
  );
}

export default App;
