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
        // If not a direct http link, resolve via YouTube APIs
        if (!Visible.url.startsWith('http')) {
          // Try Invidious API first (more reliable)
          const invidiousInstances = [
            'https://yt.omada.cafe',
            'https://inv.perditum.com',
          ];
          
          for (const invidiousInstance of invidiousInstances) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);
              
              const response = await fetch(`${invidiousInstance}/api/v1/videos/${Visible.url}`, {
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                
                // Check if the response contains an error
                if (data.error) {
                  // console.log(`Invidious ${invidiousInstance} returned error:`, data.error);
                  continue;
                }
                
                // Try to get proxied URLs first (more reliable for downloads)
                try {
                  const proxiedResponse = await fetch(`${invidiousInstance}/api/v1/videos/${Visible.url}?local=true`, {
                    signal: controller.signal,
                  });
                  
                  if (proxiedResponse.ok) {
                    const proxiedData = await proxiedResponse.json();
                    
                    // Check for proxied formatStreams
                    if (proxiedData.formatStreams && proxiedData.formatStreams.length > 0) {
                      const audioStream = proxiedData.formatStreams.find(f => 
                        f.type && f.type.includes('audio') && 
                        (f.resolution === '360p' || f.resolution === '240p' || f.quality === 'small')
                      );
                      
                      if (audioStream?.url) {
                        // console.log(`Using proxied Invidious audio from ${invidiousInstance}: ${audioStream.quality || audioStream.resolution}`);
                        return { url: audioStream.url, isMp3: false };
                      }
                    }
                    
                    // Check for proxied adaptiveFormats
                    if (proxiedData.adaptiveFormats && proxiedData.adaptiveFormats.length > 0) {
                      const audioFormats = proxiedData.adaptiveFormats.filter(f => 
                        f.type && f.type.includes('audio')
                      );
                      
                      if (audioFormats.length > 0) {
                        const bestAudio = audioFormats.sort((a,b)=> {
                          const aBitrate = parseInt(a.bitrate || 0);
                          const bBitrate = parseInt(b.bitrate || 0);
                          return bBitrate - aBitrate;
                        })[0];
                        
                        if (bestAudio?.url) {
                          // console.log(`Using proxied Invidious audio from ${invidiousInstance}: ${bestAudio.bitrate} bps`);
                          return { url: bestAudio.url, isMp3: false };
                        }
                      }
                    }
                  }
                } catch (proxyErr) {
                  // console.log(`Proxied request failed for ${invidiousInstance}:`, proxyErr.message);
                }
                
                // Fall back to direct URLs if proxied fails
                const adaptiveFormats = data?.adaptiveFormats || [];
                
                // Find audio-only formats
                const audioFormats = adaptiveFormats.filter(f => 
                  f.type && f.type.includes('audio')
                );
                
                if (audioFormats.length > 0) {
                  // Prefer formats with higher bitrate
                  const bestAudio = audioFormats.sort((a,b)=> {
                    const aBitrate = parseInt(a.bitrate || 0);
                    const bBitrate = parseInt(b.bitrate || 0);
                    return bBitrate - aBitrate;
                  })[0];
                  
                  if (bestAudio?.url) {
                    // console.log(`Using direct Invidious audio from ${invidiousInstance}: ${bestAudio.bitrate} bps - ${bestAudio.type}`);
                    return { url: bestAudio.url, isMp3: false };
                  }
                } else {
                  // console.log(`No audio formats from ${invidiousInstance}`);
                }
              } else {
                // console.log(`Invidious ${invidiousInstance} unavailable (${response.status})`);
              }
            } catch (e) {
              // console.log(`Invidious ${invidiousInstance} failed:`, e.message);
              continue;
            }
          }
          
          // Try Piped API as fallback
          const pipedInstance = 'https://pipedapi.tokhmi.xyz';
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${pipedInstance}/streams/${Visible.url}`, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              
              // Check if Piped returned an error
              if (data.error) {
                // console.log(`Piped API returned error:`, data.error);
                return { url: null, isMp3: false };
              }
              
              const audioStreams = data?.audioStreams || [];
              
              if (audioStreams.length > 0) {
                // Prefer mp3/mpeg stream for better compatibility
                const mp3 = audioStreams.find(s => 
                  (s.mimeType || '').includes('audio/mpeg') || 
                  (s.url || '').includes('.mp3')
                );
                
                if (mp3?.url) {
                  // console.log('Found MP3 stream from Piped');
                  return { url: mp3.url, isMp3: true };
                }
                
                // Fallback to highest bitrate audio
                const best = audioStreams.sort((a,b)=> (b.bitrate||0) - (a.bitrate||0))[0];
                if (best?.url) {
                  // console.log(`Using best audio stream from Piped: ${best.quality || best.bitrate} - ${best.mimeType}`);
                  return { url: best.url, isMp3: false };
                }
              } else {
                // console.log(`No audio streams from Piped`);
              }
            } else {
              // console.log(`Piped API unavailable (${response.status})`);
            }
          } catch (e) {
            // console.log(`Piped API failed:`, e.message);
          }
          
          // Both APIs failed
          // console.log('All download sources failed for video:', Visible.url);
          return { url: null, isMp3: false };
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
      // console.log('Download URL resolution error:', e);
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
    
    // Decide extension and mime based on URL and format info
    const deriveExt = () => {
      const lower = (downloadLink || '').toLowerCase();
      if (isMp3 || lower.includes('.mp3')) return 'mp3';
      if (lower.includes('.m4a') || lower.includes('audio/mp4')) return 'm4a';
      if (lower.includes('.webm') || lower.includes('audio/webm') || lower.includes('codecs="opus"')) return 'webm';
      if (lower.includes('audio/mpeg')) return 'mp3';
      // Default to webm for Invidious streams as they're often Opus in WebM
      if (downloadLink.includes('invidious')) return 'webm';
      return 'mp3';
    }
    const ext = deriveExt();
    const mime = ext === 'mp3' ? 'audio/mpeg' : 
                 ext === 'm4a' ? 'audio/mp4' : 
                 ext === 'webm' ? 'audio/webm' : 'audio/*';

    const baseDir = (path === "Downloads") ? dirs.LegacyDownloadDir : dirs.LegacyMusicDir;
    const fileName = `${FormatTitleAndArtist(Visible.title)}.${ext}`;
    const finalPath = `${baseDir}/Music Aura/${fileName}`;

    // Ensure parent directory exists
    try {
      const parent = finalPath.substring(0, finalPath.lastIndexOf('/'))
      const exists = await ReactNativeBlobUtil.fs.isDir(parent)
      if (!exists) await ReactNativeBlobUtil.fs.mkdir(parent)
    } catch (e) {
      // console.log('Error creating directory:', e);
    }

    // For YouTube downloads (complex URLs), use direct fetch without Download Manager
    const isYouTubeUrl = downloadLink.includes('googlevideo.com') || 
                         downloadLink.includes('piped') || 
                         downloadLink.includes('invidious');
    
    if (isYouTubeUrl) {
      let lastLoggedPercentage = -1;
      
      // Use ReactNativeBlobUtil fetch without Download Manager for complex URLs
      const downloadPromise = ReactNativeBlobUtil
        .config({
          path: finalPath,
          fileCache: true,
        })
        .fetch('GET', downloadLink, {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity', // Important: disable compression for audio
          'Range': 'bytes=0-', // Request full file
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Referer': 'https://yt.omada.cafe/', // Use the instance that provided the URL
        })
        .progress((received, total) => {
          if (total > 0) {
            const percentage = Math.floor((received / total) * 100);
            // Log progress at 25%, 50%, 75%, 100% only
            if (percentage > 0 && (percentage % 25 === 0) && percentage !== lastLoggedPercentage) {
              // console.log(`Download progress: ${percentage}%`);
              lastLoggedPercentage = percentage;
            }
          }
        });

      // Add timeout to download
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout after 60 seconds')), 60000);
      });

      Promise.race([downloadPromise, timeoutPromise])
        .then(async (res) => {
          // console.log('Download completed, file saved to:', res.path());
          
          // Check if file actually has content
          try {
            const stats = await ReactNativeBlobUtil.fs.stat(res.path());
            // console.log('Downloaded file size:', stats.size, 'bytes');
            
            if (stats.size === 0) {
              // console.log('Downloaded file is empty, deleting...');
              await ReactNativeBlobUtil.fs.unlink(res.path());
              ToastAndroid.showWithGravity(
                `Download failed: Empty file received`,
                ToastAndroid.LONG,
                ToastAndroid.CENTER,
              );
              return;
            }
          } catch (statErr) {
            // console.log('Error checking file stats:', statErr);
          }
          
          // Notify Android MediaScanner about the new file
          ReactNativeBlobUtil.fs.scanFile([{ path: res.path(), mime }])
            .then(() => {
              ToastAndroid.showWithGravity(
                `Download completed: ${fileName}`,
                ToastAndroid.SHORT,
                ToastAndroid.CENTER,
              );
            })
            .catch(() => {
              ToastAndroid.showWithGravity(
                `Downloaded to: ${fileName}`,
                ToastAndroid.SHORT,
                ToastAndroid.CENTER,
              );
            });
        })
        .catch((err) => {
          console.log('Download error:', err);
          ToastAndroid.showWithGravity(
            `Download failed: ${err.message || 'Network error'}`,
            ToastAndroid.LONG,
            ToastAndroid.CENTER
          );
        })
        .finally(() => setVisible({visible: false}))
    } else {
      // Use Download Manager for direct MP3 links (Saavn, etc.)
      ReactNativeBlobUtil
        .config({
          addAndroidDownloads:{
            useDownloadManager:true,
            path: finalPath,
            notification:true,
            title: fileName,
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
        .catch((err) => {
          console.log('Download error:', err);
          ToastAndroid.showWithGravity(
            `Download failed: ${err.message || 'Unknown error'}`,
            ToastAndroid.LONG,
            ToastAndroid.CENTER
          );
        })
        .finally(() => setVisible({visible: false}))
    }
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

