import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SearchPage} from '../SearchPage';
import {Playlist} from '../Playlist';
import {Album} from '../Album';

const Stack = createNativeStackNavigator();

export const SearchRoute = () => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
      <Stack.Screen name="SearchPage" component={SearchPage} />
      <Stack.Screen
        name="Playlist"
        component={Playlist}
        options={{gestureEnabled: true}}
      />
      <Stack.Screen
        name="Album"
        component={Album}
        options={{gestureEnabled: true}}
      />
    </Stack.Navigator>
  );
};
