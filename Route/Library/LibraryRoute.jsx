import { Playlist } from "../Playlist";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Library } from "./Library";
import { LikedSongPage } from "./LikedSongPage";
import { LikedPlaylistPage } from "./LikedPlaylistPage";
import { RecentlyPlayedPage } from "./RecentlyPlayedPage";
import { DownloadedSongsPage } from "./DownloadedSongsPage";
const Stack = createNativeStackNavigator();
export const LibraryRoute = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="LibraryPage" component={Library} />
      <Stack.Screen name="Playlist" component={Playlist} options={{ gestureEnabled: true }} />
      <Stack.Screen name={"LikedSongs"} component={LikedSongPage} />
      <Stack.Screen name={"LikedPlaylists"} component={LikedPlaylistPage} />
      <Stack.Screen name={"RecentlyPlayed"} component={RecentlyPlayedPage} />
      <Stack.Screen name={"DownloadedSongs"} component={DownloadedSongsPage} />
    </Stack.Navigator>
  );
};

