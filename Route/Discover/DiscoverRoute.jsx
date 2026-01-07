import {Playlist} from '../Playlist';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Discover} from './Discover';
import {LanguageDetailPage} from '../../Component/Discover/LanguageDetailPage';
import ShowPlaylistofType from '../../Component/Discover/ShowPlaylistofType';
const Stack = createNativeStackNavigator();

export const DiscoverRoute = () => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
      <Stack.Screen name="DiscoverPage" component={Discover} />
      <Stack.Screen
        name="Playlist"
        component={Playlist}
        options={{gestureEnabled: true}}
      />
      <Stack.Screen name="LanguageDetail" component={LanguageDetailPage} />
      <Stack.Screen name="ShowPlaylistofType" component={ShowPlaylistofType} />
    </Stack.Navigator>
  );
};
