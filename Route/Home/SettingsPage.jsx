import { Heading } from "../../Component/Global/Heading";
import { MainWrapper } from "../../Layout/MainWrapper";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { Pressable, ScrollView, ToastAndroid, View } from "react-native";
import { PlainText } from "../../Component/Global/PlainText";
import { Dropdown } from "react-native-element-dropdown";
import {
  GetDownloadPath,
  GetFontSizeValue,
  GetPlaybackQuality,
  SetDownloadPath, SetFontSizeValue,
  SetPlaybackQuality,
  GetTheme, SetTheme,
} from "../../LocalStorage/AppSettings";
import { useEffect, useState, useContext } from "react";
import { SmallText } from "../../Component/Global/SmallText";
import Context from "../../Context/Context";

export const SettingsPage = ({navigation}) => {
  const { setFontSize, theme, setTheme, currentThemeColors } = useContext(Context);
  const [Font, setFont] = useState('Medium');
  const [Playback, setPlayback] = useState('320kbps');
  const [Download, setDownload] = useState('Music');
  const [Theme, setThemeState] = useState('Default');
  const FontSize = [
    { value: 'Small' },
    { value: 'Medium' },
    { value: 'Large' },
  ];
  const PlaybackQuality = [
    { value: '12kbps' },
    { value: '48kbps' },
    { value: '96kbps' },
    { value: '160kbps' },
    { value: '320kbps' },
  ];
  const DownloadPath = [
    { value: 'Music' },
    { value: 'Downloads' },
  ]
  const Themes = [
    { value: 'Default' },
    { value: 'Dark' },
    { value: 'Blue' },
    { value: 'Purple' },
    { value: 'Green' },
    { value: 'Red' },
    { value: 'Orange' },
    { value: 'Pink' },
    { value: 'Teal' },
  ]
  async function GetFontSize(){
    const data = await GetFontSizeValue()
    setFont(data)
  }
  async function GetPlayBack(){
    const data = await GetPlaybackQuality()
    setPlayback(data)
  }
  async function GetDownLoad(){
    const data = await GetDownloadPath()
    setDownload(data)
  }
  async function loadTheme(){
    const data = await GetTheme()
    setThemeState(data)
  }
  useEffect(() => {
    GetFontSize()
    GetPlayBack()
    GetDownLoad()
    loadTheme()
  }, []);

  async function SetDownLoad({ value }){
    await SetDownloadPath(value)
    ToastAndroid.showWithGravity(
      `Download path changed to ${value}`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
  }
  async function SetPlayBack({ value }){
    await SetPlaybackQuality(value)
    ToastAndroid.showWithGravity(
      `Playback quality changed to ${value}`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
  }
  async function SetFont({ value }){
    await SetFontSizeValue(value)
    setFontSize(value);
    ToastAndroid.showWithGravity(
      `Font size changed to ${value}`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
  }
  async function handleSetTheme({ value }){
    await SetTheme(value)
    setTheme(value);
    ToastAndroid.showWithGravity(
      `Theme changed to ${value}`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
  }
  function EachSettingsButton({text, OnPress}) {
    return <Pressable onPress={OnPress} style={{
      backgroundColor: currentThemeColors.background,
      padding:20,
      borderRadius:10,
      flexDirection:"row",
      justifyContent:"space-between",
      marginBottom:10,
    }}>
      <PlainText text={text}/>
      <PlainText text={"→"}/>
    </Pressable>
  }
  function EachDropDownWithLabel({data, text, placeholder, OnChange}){
    return <View style={{
      backgroundColor: currentThemeColors.background,
      padding:20,
      borderRadius:10,
      flexDirection:"row",
      justifyContent:"space-between",
      alignItems:"center",
      marginBottom:10,
    }}>
      <PlainText text={text}/>
      <Dropdown placeholder={placeholder} placeholderStyle={{
        color: currentThemeColors.text,
      }} itemTextStyle={{
        color: currentThemeColors.secondaryText,
      }} containerStyle={{
        backgroundColor: currentThemeColors.secondaryBackground,
        borderRadius:5,
        borderWidth:0,
      }} style={{
        width:120,
      }} data={data} labelField="value" valueField="value" onChange={OnChange}/>
    </View>
  }
  return (
    <MainWrapper>
       <PaddingConatiner>
         <Heading text={"SETTINGS"}/>
         <ScrollView>
           <EachSettingsButton text={"Change Name"} OnPress={()=>{
             navigation.navigate("ChangeName")
           }}/>
           <EachSettingsButton text={"Select Languages"} OnPress={()=>{
             navigation.navigate("SelectLanguages")
           }}/>
           <EachDropDownWithLabel data={FontSize} text={"Font size"} placeholder={Font} OnChange={SetFont}/>
           <EachDropDownWithLabel data={PlaybackQuality} text={"Playback quality"} placeholder={Playback} OnChange={SetPlayBack}/>
           <EachDropDownWithLabel data={DownloadPath} text={"Download Path"} placeholder={Download} OnChange={SetDownLoad}/>
           <EachDropDownWithLabel data={Themes} text={"App Theme"} placeholder={Theme} OnChange={handleSetTheme}/>
           <SmallText text={"*Note: If you change font size, change name or select languages please restart the app to see the effect"}/>
         </ScrollView>
       </PaddingConatiner>
    </MainWrapper>
  );
};
