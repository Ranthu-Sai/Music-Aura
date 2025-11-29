import { MainWrapper } from "../../Layout/MainWrapper";
import FastImage from "react-native-fast-image";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { PlainText } from "../../Component/Global/PlainText";
import { Heading } from "../../Component/Global/Heading";
import { SmallText } from "../../Component/Global/SmallText";
import AntDesign from "react-native-vector-icons/AntDesign";
import { Spacer } from "../../Component/Global/Spacer";
import EvilIcons from "react-native-vector-icons/EvilIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import Entypo from "react-native-vector-icons/Entypo";

export const AboutProject = () => {
  const TopHeight = 120
  return (
    <MainWrapper>
      <ScrollView>
        <Spacer/>
        <Spacer/>
        <View style={{paddingHorizontal:10}}>
          <View style={{
            height:TopHeight,
            flexDirection:"row",
            gap:10,
          }}>
            <FastImage 
  source={{
    uri: "https://res.cloudinary.com/dkpi8hona/image/upload/v1737190997/me.jpeg_uhraqu.jpg",
  }} 
  style={{
    height: TopHeight,
    width: TopHeight,
    borderRadius: 200000,
  }}
/>
            <View style={{justifyContent:"center"}}>
              <PlainText text={"Developed By"}/>
              <Heading text={"Ranthu Sai"} nospace={true}/>
              <View style={{flexDirection:"row", gap:10}}>
                <EachSocialButton title={"Github"} icon={<AntDesign name={"github"}/>} color={"rgb(42,42,42)"} url={"https://github.com/Ranthu-Sai"}/>
                <EachSocialButton title={"LinkedIn"} icon={<AntDesign name={"linkedin-square"}/>} color={"rgb(23,59,100)"} url={"https://www.linkedin.com/in/sai-ranthu-73b352295/"}/>
                <EachSocialButton title={"Instagram"} icon={<AntDesign name={"instagram"}/>} color={"rgb(83,43,43)"} url={"https://www.instagram.com/s.a.i_r.a.n.t.h.u/"}/>
              </View>
            </View>
          </View>
          <Spacer/>
          <Spacer/>
          <PlainText text={"Want to stay updated?"} nospace={true}/>
          <SmallText text={"join the community."}/>
          <Spacer/>
          {/*<View style={{flexDirection:"row", gap:10, alignItems:"center", justifyContent:"space-between"}}>
            <EachCommunityButton title={"Telegram"} icon={<EvilIcons name={"sc-telegram"} size={35}/>} color={"rgb(50,95,123)"} subTitle={'Melody'} url={"https://t.me/+-irbEXtzhwI1NzU1"}/>
            <EachCommunityButton title={"Whatsapp"} icon={<FontAwesome name={"whatsapp"} size={35}/>} color={"rgb(52,123,50)"} subTitle={'Melody'} url={"https://whatsapp.com/channel/0029VaCr9oTIt5s5DxEQCI11"}/>
          </View>*/}
          <Spacer/>
          <PlainText text={"Are you a developer?"} nospace={true}/>
          <SmallText text={"Contribute to the project."}/>
          <Spacer/>
          <View style={{
            height:100,
          }}>
            <EachCommunityButton style={{
              justifyContent:"space-around",
            }} title={"Music Aura"} icon={<AntDesign name={"github"} size={40}/>} color={"rgb(46,46,46)"} subTitle={'An open source music player to listen music for free.'} url={"https://github.com/Ranthu-Sai/Music-Aura.git"}/>
          </View>
          <Spacer/>
          <PlainText text={"Request a new feature?"} nospace={true}/>
          <SmallText text={"Or report a bug?"}/>
          <Spacer/>
          <View style={{
            height:120,
          }}>
            <EachCommunityButton style={{
              justifyContent:"space-around",
            }} title={""} icon={<Entypo name={"bug"} size={40}/>} color={"rgb(98,38,38)"} subTitle={'You can always request me new features or report a bug in any of my social media handles or you can mail me at :\nsaiyadav4719@gmail.com\n\nEven you can raise an issue in Github'} url={""}/>
          </View>
          <Spacer/>
          <View style={{
            alignItems: 'center',
            paddingVertical: 20,
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: 10,
            marginHorizontal: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
          }}>
            <Heading text={"v1.0.0"} nospace={true} style={{color: 'rgb(255,255,255)', fontSize: 24}}/>
          </View>
        </View>
      </ScrollView>
    </MainWrapper>
  );
};
function EachSocialButton({icon,color,title,url}) {
  function loadInBrowser () {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  }
  return <Pressable onPress={loadInBrowser} style={{
    flexDirection:"row",
    backgroundColor:color,
    padding:5,
    borderRadius:5,
    alignItems:"center",
    justifyContent:"center",
    gap:5,
  }}>
      <SmallText text={title}/>
      {icon}
  </Pressable>
}

function EachCommunityButton({icon,color,title,url, subTitle, style}){
  function loadInBrowser () {
   if (url !== ""){
     Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
   }
  }
  return <Pressable onPress={loadInBrowser} style={{
    flexDirection:"row",
    backgroundColor:color,
    padding:5,
    borderRadius:5,
    alignItems:"center",
    justifyContent:"center",
    flex:1,
    gap:5,
    ...style,
  }}>
    <View>
      {title !== "" && <Heading text={title} nospace={true}/>}
      <SmallText text={subTitle} style={{maxWidth:270}} maxLine={20}/>
    </View>
    {icon}
  </Pressable>
}
