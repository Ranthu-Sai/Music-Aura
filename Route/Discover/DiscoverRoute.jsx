import { Playlist } from "../Playlist";
import { createStackNavigator } from '@react-navigation/stack';
import { Discover } from "./Discover";
import { LanguageDetailPage } from "../../Component/Discover/LanguageDetailPage";
import ShowPlaylistofType from "../../Component/Discover/ShowPlaylistofType";
const Stack = createStackNavigator();

export const DiscoverRoute = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen  name="DiscoverPage" component={Discover} />
      <Stack.Screen  name="Playlist" component={Playlist} options={{gestureEnabled: true}} />
      <Stack.Screen  name="LanguageDetail" component={LanguageDetailPage} />
      <Stack.Screen  name="ShowPlaylistofType" component={ShowPlaylistofType} />
    </Stack.Navigator>
  );
};
