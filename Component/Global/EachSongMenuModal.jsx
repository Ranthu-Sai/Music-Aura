import Modal from "react-native-modal";
import { Dimensions, Pressable, ToastAndroid, View } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "./PlainText";
import { SmallText } from "./SmallText";
import React, { useContext } from "react";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import { Spacer } from "./Spacer";
import AntDesign from "react-native-vector-icons/AntDesign";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { AddSongsToQueue, getIndexQuality, AddOneSongToPlaylist } from "../../MusicPlayerFunctions";
import Context from "../../Context/Context";
import { DownloadSong } from "../../Utils/DownloadHelper";

export const EachSongMenuModal = ({ Visible, setVisible }) => {
  const { updateTrack } = useContext(Context);

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
          <EachModalButton text={"Add to Queue"} icon={<MaterialCommunityIcons name={"playlist-music-outline"} size={25} color={"white"} />} Onpress={addSongToQueue} />
          <EachModalButton text={"Playlist"} icon={<MaterialCommunityIcons name={"playlist-plus"} size={25} color={"white"} />} Onpress={() => {
            setVisible({ visible: false });
            AddOneSongToPlaylist(Visible);
          }} />
          {/* Show Remove from Playlist if in a local playlist */}
          {Visible.playlistId && (
            <EachModalButton
              text={"Remove"}
              colors={["#FFB347", "#FFCC33"]}
              icon={<MaterialCommunityIcons name={"playlist-remove"} size={25} color={"white"} />}
              Onpress={async () => {
                const { RemoveFromPlaylist } = require('../../LocalStorage/StoreUserPlaylists');
                const success = await RemoveFromPlaylist(Visible.playlistId, Visible.id);
                if (success) {
                  ToastAndroid.show("Song removed from playlist", ToastAndroid.SHORT);
                  // Since we can't easily trigger a re-render of the Playlist screen from here, 
                  // we notify the user. He might need to navigate back/forward to see it.
                } else {
                  ToastAndroid.show("Failed to remove song", ToastAndroid.SHORT);
                }
                setVisible({ visible: false });
              }}
            />
          )}
          {/* Show Delete instead of Download if local file */}
          {(Visible.url && (Visible.url.startsWith('/') || Visible.url.startsWith('file://'))) ? (
            <EachModalButton
              text={"Delete"}
              colors={["#e53935", "#e35d5b"]}
              icon={<AntDesign name={"delete"} size={25} color={"white"} />}
              Onpress={async () => {
                const { deleteLocalSong } = require('../../Utils/LocalMusicScanner');
                const success = await deleteLocalSong(Visible.url);
                if (success) {
                  ToastAndroid.show("File deleted. Please refresh list.", ToastAndroid.SHORT);
                } else {
                  ToastAndroid.show("Failed to delete file", ToastAndroid.SHORT);
                }
                setVisible({ visible: false });
              }}
            />
          ) : (
            <EachModalButton text={"Download"} Onpress={getPermission} icon={<AntDesign name={"download"} size={25} color={"white"} />} />
          )}
          {Visible.albumId && (
            <EachModalButton text={"Go to Album"} icon={<MaterialCommunityIcons name={"album"} size={25} color={"white"} />} Onpress={() => {
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
