import React, {useContext, useEffect} from 'react';
import {View, StyleSheet, Pressable, Text} from 'react-native';
import BottomSheetMusic from '../MusicPlayer/BottomSheetMusic';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {ActionsContext} from '../../Context/Context';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
const bottomColor = '#151515';
function GetIcon(label, isDiabled = false) {
  if (label === 'Home') {
    return (
      <Ionicons
        name={'headset-outline'}
        color={isDiabled ? 'rgb(153,151,151)' : 'white'}
        size={22}
      />
    );
  } else if (label === 'Search') {
    return (
      <Ionicons
        name={'search-outline'}
        color={isDiabled ? 'rgb(153,151,151)' : 'white'}
        size={22}
      />
    );
  } else if (label === 'Discover') {
    return (
      <Ionicons
        name={'apps-outline'}
        color={isDiabled ? 'rgb(153,151,151)' : 'white'}
        size={22}
      />
    );
  } else if (label === 'Library') {
    return (
      <Ionicons
        name={'person-outline'}
        color={isDiabled ? 'rgb(153,151,151)' : 'white'}
        size={22}
      />
    );
  }
}

export default function CustomTabBar({state, descriptors, navigation}) {
  const {setIndex} = useContext(ActionsContext);

  // Get the current focused route name from nested navigators
  const getCurrentRouteName = () => {
    const currentRoute = state.routes[state.index];
    const routeName = getFocusedRouteNameFromRoute(currentRoute) ?? currentRoute.name;
    return routeName;
  };

  const currentRouteName = getCurrentRouteName();

  // Hide mini player on Settings-related pages
  const hidePlayer = [
    'Settings',
    'QualitySettings',
    'ThemeSettings',
    'StorageSettings',
    'ClearCache',
    'ChangeName',
    'SelectLanguages',
    'AboutProject',
  ].includes(currentRouteName);

  useEffect(() => {
    setIndex(0);
  }, [setIndex]);

  return (
    <>
      {!hidePlayer && <BottomSheetMusic color={bottomColor} />}
      <View style={styles.mainContainer}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <View key={index} style={styles.mainItemContainer}>
              <Pressable
                onPress={onPress}
                style={{
                  backgroundColor: 'rgba(0,0,0,0)',
                  borderRadius: 20,
                  height: 40,
                }}>
                {!isFocused && (
                  <View
                    style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      flex: 1,
                      paddingHorizontal: 15,
                      borderRadius: 15,
                      gap: 2,
                    }}>
                    {GetIcon(label, true)}
                    <Text
                      style={{
                        fontSize: 8,
                        color: 'rgb(153,151,151)',
                        fontFamily: 'roboto',
                        letterSpacing: 1,
                      }}>
                      {label}
                    </Text>
                  </View>
                )}
                {isFocused && (
                  <Animated.View
                    entering={FadeInUp}
                    style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      flex: 1,
                      paddingHorizontal: 15,
                      borderRadius: 15,
                      gap: 2,
                    }}>
                    {GetIcon(label)}
                    <Animated.Text
                      entering={FadeInDown}
                      style={{
                        fontSize: 8,
                        color: 'white',
                        fontFamily: 'roboto',
                        letterSpacing: 1,
                      }}>
                      {label}
                    </Animated.Text>
                  </Animated.View>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flexDirection: 'row',
    height: 70,
    alignItems: 'center',
    backgroundColor: bottomColor,
  },
  mainItemContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
