import { Pressable, View } from "react-native";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import FastImage from "react-native-fast-image";
import { memo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";

function resolveImageUri(image) {
  if (!image) { return null; }
  if (typeof image === 'string') { return image; }
  if (Array.isArray(image)) {
    // Prefer middle sizes, then others
    const prefer = [2, 3, 1, 0];
    for (let idx of prefer) {
      const it = image[idx];
      if (!it) { continue; }
      const url = (typeof it === 'string') ? it : (it.url || it.link);
      if (url) { return url; }
    }
    // Fallback: any first valid url/link
    for (let it of image) {
      const url = (typeof it === 'string') ? it : (it?.url || it?.link);
      if (url) { return url; }
    }
    return null;
  }
  if (typeof image === 'object') {
    return image.url || image.link || null;
  }
  return null;
}

export const EachAlbumCard = memo(function EachAlbumCard({image,name,artists,id,mainContainerStyle,Search}) {
  const navigation = useNavigation()
  const initialUri = resolveImageUri(image) || 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image'
  const [imageUri, setImageUri] = useState(initialUri)
  let artistsNames = ""
  if (!Search){
    if (Array.isArray(artists) && artists.length > 3){
      for (let i = 0; i < 3; i++){
        if ( i === 2){
          artistsNames += artists[i].name
        } else {
          const additionName = artists[i].name + ", "
          artistsNames += additionName
        }
      }
      artistsNames += " ..."
    } else if (Array.isArray(artists)) {
      artists.forEach((e,i)=>{
        if (i === artists.length - 1){
          artistsNames += e.name
        } else {
          const additionName = e.name + ", "
          artistsNames += additionName
        }
      })
    }
  }
  function formattedText (text){
    const decoded = FormatTitleAndArtist(text || "");
    if (decoded.length >= 45){
      return decoded.slice(0,45) + "...";
    }
    return decoded;
  }
  return (
    <Pressable onPress={()=>{
      const nameLower = (name || "").toLowerCase();
      // Block navigation for obvious podcast/show entries
      if (nameLower.includes('podcast') || nameLower.includes('episode')) { return; }
      if ((id || "").includes('playlist')) {
        navigation.navigate("Playlist", {id, image: imageUri, name, follower: ""})
      } else {
        navigation.navigate("Album", {id, image: imageUri})
      }
    }} android_ripple={{ color: 'rgba(0,0,0,0)' }} style={{
      borderRadius:8,
      height:250,
      width:180,
      backgroundColor:"rgba(55,55,79,0)",
      overflow:"hidden",
      ...mainContainerStyle,
    }}>
      <FastImage source={{
        uri: imageUri,
        priority: 'high',
      }} onError={() => setImageUri('https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')} style={{
        height:180,
        width:'100%',
        borderRadius:8,
      }} resizeMode="contain" />
      <View style={{
        padding:8,
        height:60,
        alignItems:"center",
      }}>
        <PlainText text={formattedText(name)}/>
        <SmallText text={!Search ? artistsNames : artists} maxLine={1}/>
      </View>
    </Pressable>
  );
})
