
import { Home } from "./Home";
import { Playlist } from "../Playlist";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Album } from "../Album";
import { LikedSongPage } from "../Library/LikedSongPage";
import { LikedPlaylistPage } from "../Library/LikedPlaylistPage";
import { SettingsPage } from "./SettingsPage";
import { ClearCachePage } from "./ClearCachePage";
import { ChangeName } from "./ChangeName";
import { SelectLanguages } from "./SelectLanguages";
import ShowPlaylistofType from "../../Component/Discover/ShowPlaylistofType";
import { AboutProject } from "../Library/AboutProject";
const Stack = createNativeStackNavigator();
export const HomeRoute = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="HomePage" component={Home} />
      <Stack.Screen name="Playlist" component={Playlist} options={{ gestureEnabled: true }} />
      <Stack.Screen name={"Album"} component={Album} options={{ gestureEnabled: true }} />
      <Stack.Screen name={"LikedSongs"} component={LikedSongPage} />
      <Stack.Screen name={"LikedPlaylists"} component={LikedPlaylistPage} />
      <Stack.Screen name={"Settings"} component={SettingsPage} />
      <Stack.Screen name={"ClearCache"} component={ClearCachePage} />
      <Stack.Screen name={"ChangeName"} component={ChangeName} />
      <Stack.Screen name={"SelectLanguages"} component={SelectLanguages} />
      <Stack.Screen name="ShowPlaylistofType" component={ShowPlaylistofType} />
      <Stack.Screen name={"AboutProject"} component={AboutProject} />
    </Stack.Navigator>
  );
};
