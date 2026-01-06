import Modal from "react-native-modal";
import { Dimensions, Pressable, ToastAndroid, View, Share, Alert } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import React, { useContext } from "react";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import { Spacer } from "./Spacer";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { AddSongsToQueue, getIndexQuality, AddOneSongToPlaylist } from "../../MusicPlayerFunctions";
import { ActionsContext } from "../../Context/Context";
import { DownloadSong } from "../../Utils/DownloadHelper";
import Clipboard from '@react-native-clipboard/clipboard';

export const EachSongMenuModal = ({ Visible, setVisible }) => {
  const { updateTrack } = useContext(ActionsContext);

  const getPermission = async () => {
    setVisible({ visible: false });
    await DownloadSong(Visible);
  };

  async function addSongToQueue() {
    const quality = await getIndexQuality();
    const song = {
      url: Array.isArray(Visible.url) ? Visible.url[quality]?.url : Visible.url,
      title: FormatTitleAndArtist(Visible.title),
      artist: FormatTitleAndArtist(Visible.artist),
      artwork: Visible.image,
      duration: Visible.duration,
      id: Visible.id,
      language: Visible.language,
      image: Visible.image,
      downloadUrl: Visible.url,
    };
    await AddSongsToQueue([song]);
    updateTrack();
    setVisible({ visible: false });
    ToastAndroid.showWithGravity(
      `Song Added To Queue`,
      ToastAndroid.SHORT,
      ToastAndroid.CENTER,
    );
  }

  const size = Dimensions.get("window").height;

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out this song: ${Visible.title} by ${Visible.artist}\nShared from Music Aura`,
      });
      setVisible({ visible: false });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const showInfo = () => {
    Alert.alert(
      "Song Information",
      `Title: ${Visible.title}\nArtist: ${Visible.artist}\nAlbum: ${Visible.albumName || 'N/A'}\nDuration: ${Math.floor(Visible.duration / 60)}:${(Visible.duration % 60).toString().padStart(2, '0')}\nSource: ${Visible.source || 'Online'}`,
      [{ text: "OK" }]
    );
  };

  return (
    <Modal
      onBackButtonPress={() => setVisible({ visible: false })}
      onSwipeComplete={() => setVisible({ visible: false })}
      onBackdropPress={() => setVisible({ visible: false })}
      swipeDirection={['up', 'left', 'right', 'down']}
      isVisible={Visible.visible}
      style={{
        justifyContent: 'flex-end',
        margin: 0,
      }}
    >
      <View style={{
        backgroundColor: "rgb(18,18,18)",
        elevation: 10,
      }}>
        <Spacer />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: "space-between",
            paddingHorizontal: 15,
            paddingTop: 5,
            alignItems: "center",
            gap: 10,
          }}
        >
          <View style={{
            flexDirection: "row",
            flex: 1,
          }}>
            <FastImage
              source={{
                uri: Visible.image ?? "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png",
              }}
              style={{
                height: (size * 0.1) - 30,
                width: (size * 0.1) - 30,
                borderRadius: 10,
              }}
            />
            <View style={{
              flex: 1,
              height: (size * 0.1) - 30,
              alignItems: "flex-start",
              justifyContent: "center",
              paddingHorizontal: 10,
            }}>
              <PlainText text={FormatTitleAndArtist(Visible?.title) ?? "No music :("} style={{ color: "white" }} />
              <SmallText text={FormatTitleAndArtist(Visible?.artist) ?? "Explore now!"} maxLine={1} />
            </View>
          </View>
        </View>
        <Spacer />
        <View style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 10,
        }}>
          <EachModalButton text={"Queue"} icon={<MaterialCommunityIcons name={"playlist-music-outline"} size={25} color={"white"} />} Onpress={addSongToQueue} />
          <EachModalButton text={"Playlist"} icon={<MaterialCommunityIcons name={"playlist-plus"} size={25} color={"white"} />} Onpress={() => {
            setVisible({ visible: false });
            AddOneSongToPlaylist(Visible);
          }} />
          <EachModalButton text={"Share"} icon={<AntDesign name={"sharealt"} size={25} color={"white"} />} Onpress={onShare} />
          <EachModalButton text={"Info"} icon={<AntDesign name={"infocirlceo"} size={25} color={"white"} />} Onpress={showInfo} />
        </View>
        <Spacer />
        <View style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 10,
        }}>
          {/* Show Delete from Downloads if it's a downloaded song */}
          {Visible.source === 'downloaded' && (
            <EachModalButton
              text={"Delete"}
              colors={["#e53935", "#e35d5b"]}
              icon={<MaterialCommunityIcons name={"delete-forever"} size={25} color={"white"} />}
              Onpress={async () => {
                const { StorageManager } = require('../../Utils/StorageManager');
                const { DeviceEventEmitter } = require('react-native');
                const ReactNativeBlobUtil = require('react-native-blob-util').default;
                try {
                  const songPath = await StorageManager.getSongPath(Visible.id);
                  await StorageManager.removeDownloadedSongMetadata(Visible.id);

                  // Verification check
                  let deletedSuccessfully = true;
                  if (songPath) {
                    const exists = await ReactNativeBlobUtil.fs.exists(songPath) ||
                                 await ReactNativeBlobUtil.fs.exists(decodeURI(songPath));
                    if (exists) {deletedSuccessfully = false;}
                  }

                  DeviceEventEmitter.emit('downloadedSongRemoved', Visible.id);

                  if (deletedSuccessfully) {
                    ToastAndroid.show("Song deleted from storage", ToastAndroid.SHORT);
                  } else {
                    ToastAndroid.show("Removed from list, but file may still exist in storage", ToastAndroid.LONG);
                  }

                  if (Visible.onRemove) { Visible.onRemove(); }
                } catch (error) {
                  ToastAndroid.show("Failed to delete song", ToastAndroid.SHORT);
                }
                setVisible({ visible: false });
              }}
            />
          )}

          {/* Show Delete from History if in history context */}
          {Visible.isHistory && (
            <EachModalButton
              text={"Delete"}
              colors={["#FFB347", "#FFCC33"]}
              icon={<MaterialCommunityIcons name={"history"} size={25} color={"white"} />}
              Onpress={async () => {
                const historyManager = require('../../Utils/HistoryManager').default;
                const success = await historyManager.removeFromHistory(Visible.id);
                if (success) {
                  ToastAndroid.show("Deleted from history", ToastAndroid.SHORT);
                  if (Visible.onRemove) { Visible.onRemove(); }
                } else {
                  ToastAndroid.show("Failed to delete", ToastAndroid.SHORT);
                }
                setVisible({ visible: false });
              }}
            />
          )}
          {/* Show Delete from Playlist if in a local playlist */}
          {Visible.playlistId && (
            <EachModalButton
              text={"Delete"}
              colors={["#FFB347", "#FFCC33"]}
              icon={<MaterialCommunityIcons name={"playlist-remove"} size={25} color={"white"} />}
              Onpress={async () => {
                const { RemoveFromPlaylist } = require('../../LocalStorage/StoreUserPlaylists');
                const success = await RemoveFromPlaylist(Visible.playlistId, Visible.id);
                if (success) {
                  ToastAndroid.show("Song deleted from playlist", ToastAndroid.SHORT);
                  if (Visible.onRemove) { Visible.onRemove(); }
                } else {
                  ToastAndroid.show("Failed to delete song", ToastAndroid.SHORT);
                }
                setVisible({ visible: false });
              }}
            />
          )}
          {/* Show Delete instead of Download if local file */}
          {(Visible.source === 'local' || (Visible.url && typeof Visible.url === 'string' && (Visible.url.startsWith('/') || Visible.url.startsWith('file://')) && Visible.source !== 'downloaded')) ? (
            <EachModalButton
              text={"Delete"}
              colors={["#e53935", "#e35d5b"]}
              icon={<AntDesign name={"delete"} size={25} color={"white"} />}
              Onpress={async () => {
                console.log('=== DELETE BUTTON CLICKED ===');
                const { DeviceEventEmitter } = require('react-native');
                const { hideFile } = require('../../LocalStorage/HiddenLocalFiles');

                try {
                  console.log('Delete button pressed for:', Visible.title);
                  console.log('File path:', Visible.url);
                  console.log('Song ID:', Visible.id);

                  // Show immediate feedback
                  ToastAndroid.show("Removing from app...", ToastAndroid.SHORT);

                  // Add to hidden files list
                  await hideFile(Visible.url);

                  // Remove from app view immediately
                  console.log('Emitting localSongDeleted event');
                  DeviceEventEmitter.emit('localSongDeleted', Visible.id);

                  // Close modal first
                  setVisible({ visible: false });

                  // Call onRemove callback to refresh the list
                  if (Visible.onRemove) {
                    console.log('Calling onRemove callback');
                    Visible.onRemove();
                  }

                  // Try to delete the actual file in background
                  setTimeout(async () => {
                    try {
                      const { deleteLocalSong, isFileDeletable } = require('../../Utils/LocalMusicScanner');

                      if (!isFileDeletable(Visible.url)) {
                        console.log('File is not deletable (protected directory)');
                        return;
                      }

                      const result = await deleteLocalSong(Visible.url);
                      console.log('Delete result:', result);

                      if (result.success) {
                        ToastAndroid.show("Deleted from storage", ToastAndroid.SHORT);
                      }
                    } catch (error) {
                      console.error('Background deletion error:', error);
                    }
                  }, 100);

                } catch (error) {
                  console.error('Error in delete handler:', error);
                  // Still remove from view even on error
                  DeviceEventEmitter.emit('localSongDeleted', Visible.id);
                  if (Visible.onRemove) {
                    Visible.onRemove();
                  }
                  setVisible({ visible: false });
                  ToastAndroid.show("Removed from app", ToastAndroid.SHORT);
                }
              }}
            />
          ) : (Visible.source !== 'downloaded' && Visible.source !== 'local' && !Visible.isHistory && !Visible.playlistId) ? (
            <EachModalButton text={"Download"} Onpress={getPermission} icon={<AntDesign name={"download"} size={25} color={"white"} />} />
          ) : null}

          {Visible.albumId && (
            <EachModalButton text={"Album"} icon={<MaterialCommunityIcons name={"album"} size={25} color={"white"} />} Onpress={() => {
              setVisible({ visible: false });
              Visible.navigation.navigate('Album', { id: Visible.albumId, image: Visible.image });
            }} />
          )}
        </View>
        <Spacer />
        <Spacer />
        <Spacer />
      </View>
    </Modal>
  );
};

function EachModalButton({ icon, text, Onpress, colors }) {
  return (
    <Pressable onPress={() => Onpress()} style={{
      height: 100,
      backgroundColor: colors ? colors[0] : "rgb(41,47,49)",
      borderRadius: 10,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      elevation: 5,
    }}>
      {icon}
      <Spacer />
      <PlainText text={text} style={{ color: "white", paddingRight: 0 }} />
    </Pressable>
  );
}
