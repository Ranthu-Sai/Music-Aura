import { Dimensions, Pressable, TextInput, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import Entypo from "react-native-vector-icons/Entypo";
import { useState } from "react";

export const SearchBar = ({onChange, navigation}) => {
  const width = Dimensions.get("window").width
  const theme = useTheme()
  const [searchText, setSearchText] = useState("")
  return (
    <View style={{
      flexDirection:"row",
      gap:2,
      alignItems:"center",
      height:60,
      marginHorizontal:10,
    }}>
      <View style={{
        flex:1,
        paddingHorizontal:5,
        backgroundColor:"rgba(255,255,255,0.1)",
        borderWidth:1,
        borderColor:"rgba(255,255,255,0.3)",
        borderRadius:10,
        flexDirection:"row",
        alignItems:"center",
      }}>
        <TextInput cursorColor={"rgb(255,255,255)"} placeholder={"Type to search..."} style={{
          color:"white",
          fontSize:25,
          fontFamily:"roboto",
          flex:1,
        }} value={searchText} onChangeText={(text)=>{
          setSearchText(text)
          onChange(text)
        }} autoFocus={true}/>
        {searchText.length > 0 && (
          <Pressable onPress={()=>{
            setSearchText("")
            onChange("")
          }} style={{
            padding:5,
          }}>
            <Entypo name={"circle-with-cross"} size={width * 0.045} color={"white"}/>
          </Pressable>
        )}
      </View>
    </View>
  );
};
