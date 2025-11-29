import { Pressable, View } from "react-native";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import FastImage from "react-native-fast-image";
import { memo, useState } from "react";
import { useNavigation } from "@react-navigation/native";


export const EachAlbumCard = memo(function EachAlbumCard({image,name,artists,id,mainContainerStyle,Search}) {
  const navigation = useNavigation()
  const [imageUri, setImageUri] = useState(image || 'https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')
  let artistsNames = ""
  if (!Search){
    if (artists.length > 3){
      for (let i = 0; i < 3; i++){
        if ( i === 2){
          artistsNames += artists[i].name
        } else {
          const additionName = artists[i].name + ", "
          artistsNames += additionName
        }
      }
      artistsNames += " ..."
    } else {
      artists.map((e,i)=>{
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
    if (text.length >= 45){
      return text.slice(0,45) + "..."
    }
    else {
      return text
    }
  }
  return (
    <Pressable onPress={()=>{
      if (id.includes('playlist')) {
        navigation.navigate("Playlist", {id, image, name, follower: ""})
      } else {
        navigation.navigate("Album", {id})
      }
    }} style={{
      borderRadius:8,
      height:210,
      width:150,
      backgroundColor:"rgba(55,55,79,0)",
      overflow:"hidden",
      ...mainContainerStyle,
    }}>
      <FastImage source={{
        uri: imageUri,
        priority: 'high',
      }} onError={() => setImageUri('https://via.placeholder.com/150x150/cccccc/000000?text=No+Image')} style={{
        height:150,
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
