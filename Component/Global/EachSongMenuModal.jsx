import Modal from "react-native-modal";
import { Dimensions, PermissionsAndroid, Platform, Pressable, ToastAndroid, View } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import React, { useContext } from "react";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import { Spacer } from "./Spacer";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import ReactNativeBlobUtil from "react-native-blob-util";
import { GetDownloadPath } from "../../LocalStorage/AppSettings";
import DeviceInfo from "react-native-device-info";
import { AddSongsToQueue, getIndexQuality} from "../../MusicPlayerFunctions";
import Context from "../../Context/Context";

export const EachSongMenuModal = ({Visible, setVisible}) => {
  const {updateTrack} = useContext(Context)
  function isMp3Link(link, mime) {
    return (mime && mime.includes('audio/mpeg')) || (link || '').toLowerCase().includes('.mp3');
  }

  async function resolveDownloadUrl() {
    try {
      // Visible.url can be an array of qualities (saavn) or a videoId/string (YT)
      if (typeof Visible.url === 'string') {
        // If not a direct http link, resolve via Piped
        if (!Visible.url.startsWith('http')) {
          const response = await fetch(`https://pipedapi.in.projectsegfau.lt/streams/${Visible.url}`);
          const data = await response.json();
          const audioStreams = data?.audioStreams || [];
          // Prefer mp3/mpeg stream, else highest bitrate
          const mp3 = audioStreams.find(s => (s.mimeType || '').includes('audio/mpeg') || (s.url || '').includes('.mp3'));
          const best = mp3 || audioStreams.sort((a,b)=> (b.bitrate||0) - (a.bitrate||0))[0];
          return { url: best?.url, isMp3: !!mp3 };
        }
        return { url: Visible.url, isMp3: isMp3Link(Visible.url) };
      }
      // Find an mp3 link in the array if available, otherwise pick highest index
      if (Array.isArray(Visible.url)) {
        const mp3Item = Visible.url.find(it => isMp3Link(it?.url));
        if (mp3Item?.url) return { url: mp3Item.url, isMp3: true };
        // default to 320kbps index when present else last
        const candidate = Visible.url[4]?.url || Visible.url[Visible.url.length - 1]?.url;
        return { url: candidate, isMp3: isMp3Link(candidate) };
      }
    } catch (e) {
      // fallthrough
    }
    return { url: null, isMp3: false };
  }

  async function actualDownload () {
    let dirs = ReactNativeBlobUtil.fs.dirs
    const path = await GetDownloadPath()
    const { url: downloadLink, isMp3 } = await resolveDownloadUrl();
    if (!downloadLink) {
      ToastAndroid.showWithGravity(
        `Unable to resolve download link`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
      setVisible({visible: false})
      return;
    }
    ToastAndroid.showWithGravity(
      `Download Started`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
    // Decide extension and mime
    const deriveExt = () => {
      const lower = (downloadLink || '').toLowerCase();
      if (isMp3 || lower.includes('.mp3')) return 'mp3';
      if (lower.includes('.m4a')) return 'm4a';
      if (lower.includes('.webm')) return 'webm';
      return 'mp3';
    }
    const ext = deriveExt();
    const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : ext === 'webm' ? 'audio/webm' : 'audio/*';

    const baseDir = (path === "Downloads") ? dirs.LegacyDownloadDir : dirs.LegacyMusicDir;
    const finalPath = `${baseDir}/Music Aura/${FormatTitleAndArtist(Visible.title)}.${ext}`;

    // Ensure parent directory exists for DownloadManager path
    try {
      const parent = finalPath.substring(0, finalPath.lastIndexOf('/'))
      const exists = await ReactNativeBlobUtil.fs.isDir(parent)
      if (!exists) await ReactNativeBlobUtil.fs.mkdir(parent)
    } catch (_) {}

    ReactNativeBlobUtil
      .config({
        addAndroidDownloads:{
          useDownloadManager:true,
          path: finalPath,
          notification:true,
          title:`${FormatTitleAndArtist(Visible.title)}`,
          mime,
        },
        fileCache: true,
      })
      .fetch('GET', downloadLink, {})
      .then(() => {
        ToastAndroid.showWithGravity(
          ext === 'mp3' ? "Download successfully Completed" : `Saved as .${ext}`,
          ToastAndroid.SHORT,
          ToastAndroid.CENTER,
        );
      })
      .catch(() => {
        ToastAndroid.showWithGravity("Download failed", ToastAndroid.SHORT, ToastAndroid.CENTER)
      })
      .finally(() => setVisible({visible: false}))
  }

  const getPermission = async () => {
    if (Platform.OS === 'ios') {
      actualDownload();
    } else {
      try {
        let deviceVersion = DeviceInfo.getSystemVersion();
        let granted = PermissionsAndroid.RESULTS.DENIED;
        if (deviceVersion >= 13) {
          granted = PermissionsAndroid.RESULTS.GRANTED;
        } else {
          granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          );
        }
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          actualDownload();
        } else {
                }
      } catch (err) {
        console.log("display error",err)    }
    }
  };
  async function addSongToQueue(){
    const quality = await getIndexQuality()
    const song  = {
      url: Visible.url[quality].url,
      title:FormatTitleAndArtist(Visible.title),
      artist:FormatTitleAndArtist(Visible.artist),
      artwork:Visible.image,
      duration:Visible.duration,
      id:Visible.id,
      language:Visible.language,
      image:Visible.image,
      downloadUrl:Visible.url,
    }
   await AddSongsToQueue([song])
    updateTrack()
    setVisible({visible: false})
    ToastAndroid.showWithGravity(
      `Song Added To Queue`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
  }
  const size = Dimensions.get("window").height
  return (
    <Modal onBackButtonPress={()=>setVisible({visible: false})} onSwipeComplete={()=>setVisible({visible: false})} onBackdropPress={()=>setVisible({visible: false})} swipeDirection={['up', 'left', 'right', 'down']} isVisible={Visible.visible} style={{
      justifyContent: 'flex-end',
      margin: 0,
    }}>
      <View style={{
        backgroundColor:"rgb(18,18,18)",
        elevation:10,
      }}>
        <Spacer/>
        <View
          style={{
            flexDirection: 'row',
            justifyContent:"space-between",
            paddingHorizontal:15,
            paddingTop:5,
            alignItems:"center",
            gap:10,
          }}>
          <View style={{
            flexDirection:"row",
            flex:1,
          }}>
            <FastImage
              source={{
                uri: Visible.image ?? "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png",
              }}
              style={{
                height: (size *  0.1) - 30,
                width: (size *  0.1) - 30,
                borderRadius: 10,
              }}
            />
            <View style={{
              flex:1,
              height:(size *  0.1) - 30,
              alignItems:"flex-start",
              justifyContent:"center",
              paddingHorizontal:10,
            }}>
              <PlainText text={FormatTitleAndArtist(Visible?.title) ?? "No music :("} style={{color:"white"}}/>
              <SmallText text={FormatTitleAndArtist(Visible?.artist) ?? "Explore now!"} maxLine={1}/>
            </View>
          </View>
        </View>
        <Spacer/>
        <View style={{
          flexDirection:"row",
          gap:10,
          paddingHorizontal:10,
        }}>
          <EachModalButton text={"Add to Queue"} icon={<MaterialCommunityIcons name={"playlist-music-outline"} size={25} color={"white"}/>} Onpress={addSongToQueue}/>
         <EachModalButton text={"Download"} Onpress={getPermission} icon={<AntDesign name={"download"} size={25} color={"white"}/>}/>
        </View>
        <Spacer/>
        <Spacer/>
        <Spacer/>
      </View>
    </Modal>
  );
};
function EachModalButton({icon,text,Onpress}){
  return  <Pressable onPress={()=>Onpress()} style={{
    height:100,
    backgroundColor:"rgb(41,47,49)",
    borderRadius:10,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    elevation:5,
  }}>
    {icon}
    <Spacer/>
    <PlainText text={text} style={{color:"white", paddingRight:0}}/>
  </Pressable>
}

