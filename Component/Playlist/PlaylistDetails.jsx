import {Dimensions, View, TouchableOpacity, ToastAndroid} from 'react-native';
import {Heading} from '../Global/Heading';
import {SmallText} from '../Global/SmallText';
import {Spacer} from '../Global/Spacer';
import {PlayButton} from './PlayButton';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme, useNavigation} from '@react-navigation/native';
import {AddPlaylist, getIndexQuality} from '../../MusicPlayerFunctions';
import {useContext} from 'react';
import {ActionsContext} from '../../Context/Context';
import {LikedPlaylist} from './LikedPlaylist';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FormatArtist from '../../Utils/FormatArtists';
import FormatTitleAndArtist from '../../Utils/FormatTitleAndArtist';

export const PlaylistDetails = ({
  name,
  listener,
  notReleased,
  Data,
  Loading,
  id,
  image,
  follower,
}) => {
  const {updateTrack} = useContext(ActionsContext);
  const navigation = useNavigation();
  const theme = useTheme();
  async function AddToPlayer() {
    if (!Data?.data?.songs) {
      return;
    }
    const quality = await getIndexQuality();
    const ForMusicPlayer = Data?.data?.songs?.map((e, i) => {
      // Handle local songs (source: local) vs API songs
      const isLocal = Data.data.source === 'local';
      return {
        url: isLocal
          ? e.url
          : Array.isArray(e?.downloadUrl)
          ? e?.downloadUrl[quality]?.url
          : e?.downloadUrl,
        title: FormatTitleAndArtist(e?.name || e?.title),
        artist: FormatTitleAndArtist(
          FormatArtist(e?.artists?.primary) || e?.artist || 'Unknown Artist',
        ),
        artwork: isLocal
          ? e.image
          : Array.isArray(e?.image)
          ? e?.image[2]?.url
          : e?.image,
        image: isLocal
          ? e.image
          : Array.isArray(e?.image)
          ? e?.image[2]?.url
          : e?.image,
        duration: e?.duration,
        id: e?.id,
        language: e?.language,
        artistID: e?.primary_artists_id,
      };
    });
    await AddPlaylist(ForMusicPlayer);
    updateTrack();
  }

  const handleDeletePlaylist = async () => {
    const {DeletePlaylist} = require('../../LocalStorage/StoreUserPlaylists');
    const success = await DeletePlaylist(id);
    if (success) {
      ToastAndroid.show('Playlist deleted', ToastAndroid.SHORT);
      navigation.goBack();
    }
  };
  const width = Dimensions.get('window').width;
  return (
    <LinearGradient
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      colors={['rgba(44,44,44,0)', 'rgb(18,18,18)', theme.colors.background]}
      style={{
        padding: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexDirection: 'row',
      }}>
      {!notReleased && (
        <>
          <View
            style={{
              paddingLeft: 5,
              maxWidth: width * 0.8,
            }}>
            <Heading text={name} />
            <View style={{flexDirection: 'row', gap: 5}}>
              <Ionicons name={'musical-note'} size={16} />
              <SmallText text={listener} />
            </View>
            <Spacer />
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
              <LikedPlaylist
                id={id}
                image={image}
                name={name}
                follower={follower}
              />
              {id?.startsWith('playlist_') && (
                <TouchableOpacity
                  onPress={handleDeletePlaylist}
                  style={{padding: 5}}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={24}
                    color="#FF4B2B"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <PlayButton
            Loading={Loading}
            onPress={() => {
              if (!Loading) {
                AddToPlayer();
              }
            }}
          />
        </>
      )}
    </LinearGradient>
  );
};
