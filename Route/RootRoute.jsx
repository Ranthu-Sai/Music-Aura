import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeRoute } from "./Home/HomeRoute";
import { DiscoverRoute } from "./Discover/DiscoverRoute";
import { LibraryRoute } from "./Library/LibraryRoute";
import { SearchRoute } from "./Search/SearchRoute";
import Entypo from "react-native-vector-icons/Entypo";
import Octicons from "react-native-vector-icons/Octicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "@react-navigation/native";
import CustomTabBar from '../Component/Tab/CustomTabBar';
const Tab = createBottomTabNavigator();

// Top-level icon components to avoid defining components inside render
const OcticonsHome = ({ color, size, focused }) => (
  <Octicons name="home" color={color} size={size - 4} />
);
const OcticonsSearch = ({ color, size, focused }) => (
  <Octicons name="search" color={color} size={size - 4} />
);
const EntypoCompass = ({ color, size, focused }) => (
  <Entypo name="compass" color={color} size={size - 4} />
);
const MaterialMusicBox = ({ color, size, focused }) => (
  <MaterialCommunityIcons name="music-box-multiple-outline" color={color} size={size - 4} />
);
export const RootRoute = () => {
  const theme = useTheme()
  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props}/>}
        sceneContainerStyle={{ backgroundColor: theme.colors.background }}
        screenOptions={{tabBarShowLabel:false,tabBarLabelStyle:{
          fontWeight:"bold",
          },tabBarInactiveTintColor:theme.colors.textSecondary,tabBarActiveTintColor:theme.colors.primary,headerShown:false, tabBarStyle: {
            backgroundColor:theme.colors.background,
            borderColor:"rgba(28,27,27,0)"}}}>
        <Tab.Screen  options={{
          tabBarIcon: OcticonsHome,
        }} name="Home" component={HomeRoute} />
        <Tab.Screen options={{
          tabBarIcon: OcticonsSearch,
        }} name="Search" component={SearchRoute} />
        <Tab.Screen options={{
          tabBarIcon: EntypoCompass,
        }} name="Discover" component={DiscoverRoute} />
        <Tab.Screen options={{
          tabBarIcon: MaterialMusicBox,
        }}  name="Library" component={LibraryRoute} />
      </Tab.Navigator>
    </>
  );
};
