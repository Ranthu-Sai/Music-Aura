import { Pressable, View } from "react-native";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import { SpaceBetween } from "../../Layout/SpaceBetween";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import FastImage from "react-native-fast-image";
import { memo, useState } from "react";
import { useNavigation, useTheme } from "@react-navigation/native";

export const EachPlaylistCard = memo(function EachPlaylistCard({ image, name, follower, id, MainContainerStyle, ImageStyle }) {
  const theme = useTheme()
  const navigation = useNavigation()
  const [imageUri, setImageUri] = useState(image || 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')
  return (
    <Pressable onPress={() => { navigation.navigate("Playlist", { id, image, name, follower }) }} style={{
      width: 180,
      height: 240,
      ...MainContainerStyle,
    }}>
      <FastImage source={{
        uri: imageUri,
        priority: 'high',
      }} onError={() => setImageUri('https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')} style={{
        width: "100%",
        aspectRatio: 1,
        borderRadius: 8,
        ...ImageStyle,
      }} resizeMode="contain" />
      <SpaceBetween style={{
        height: 50,
      }}>
        <View style={{
          width: "85%",
          alignItems: "center",
        }}>
          <PlainText text={name} />
          <SmallText text={follower} />
        </View>
        <FontAwesome5 name={"play"} size={15} color={theme.colors.text} />
      </SpaceBetween>
    </Pressable>
  );
})
