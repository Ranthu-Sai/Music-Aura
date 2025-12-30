import { Dimensions, Pressable, TextInput, View, Keyboard } from "react-native";
import { useTheme } from "@react-navigation/native";
import Entypo from "react-native-vector-icons/Entypo";
import Ionicons from "react-native-vector-icons/Ionicons";
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";

export const SearchBar = forwardRef(({ onChange, onSubmit, navigation }, ref) => {
  const width = Dimensions.get("window").width
  const theme = useTheme()
  const [searchText, setSearchText] = useState("")
  const inputRef = useRef()

  useImperativeHandle(ref, () => ({
    setText: (text) => {
      setSearchText(text);
      inputRef.current?.setNativeProps({ text });
    }
  }), []);

  // Notify parent immediately
  useEffect(() => {
    if (onChange) {
      onChange(searchText);
    }
  }, [searchText, onChange]);

  const handleSubmit = () => {
    if (searchText.trim() && onSubmit) {
      onSubmit(searchText.trim());
      Keyboard.dismiss(); // Close keyboard after clicking search icon
    }
  };

  return (
    <View style={{
      flexDirection: "row",
      gap: 2,
      alignItems: "center",
      height: 60,
      marginHorizontal: 10,
    }}>
      <View style={{
        flex: 1,
        paddingHorizontal: 5,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.3)",
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
      }}>
        <TextInput
          cursorColor={"rgb(255,255,255)"}
          placeholder={"Type to search..."}
          placeholderTextColor={"rgba(255,255,255,0.5)"}
          style={{
            color: "white",
            fontSize: 25,
            fontFamily: "roboto",
            flex: 1,
            paddingVertical: 8,
          }}
          ref={inputRef}
          onChangeText={(text) => {
            setSearchText(text)
          }}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoFocus={true}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => {
            setSearchText("")
            inputRef.current?.setNativeProps({ text: "" })
            onChange("")
          }} style={{
            padding: 8,
            marginRight: 4,
          }}>
            <Entypo name={"circle-with-cross"} size={width * 0.065} color={"rgba(255,255,255,0.7)"} />
          </Pressable>
        )}
        {searchText.trim().length > 0 && (
          <Pressable
            onPress={handleSubmit}
            style={{
              padding: 8,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 8,
              marginLeft: 4,
            }}
          >
            <Ionicons name={"search"} size={width * 0.065} color={"white"} />
          </Pressable>
        )}
      </View>
    </View>
  );
});
