import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  DeviceEventEmitter,
  StyleSheet,
  Dimensions,
  ToastAndroid,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { GetUserPlaylists, CreatePlaylist, AddToPlaylist } from '../../LocalStorage/StoreUserPlaylists';
import { PlainText } from './PlainText';
import { Heading } from './Heading';
import { Spacer } from './Spacer';

const { height, width } = Dimensions.get('window');

const PlaylistSelector = () => {
  const [visible, setVisible] = useState(false);
  const [song, setSong] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('showPlaylistSelector', (data) => {
      setSong(data.song);
      setVisible(true);
      loadPlaylists();
    });

    return () => subscription.remove();
  }, []);

  const loadPlaylists = async () => {
    const data = await GetUserPlaylists();
    setPlaylists(data);
  };

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim() === '') {
      ToastAndroid.show('Please enter a playlist name', ToastAndroid.SHORT);
      return;
    }

    const result = await CreatePlaylist(newPlaylistName);
    if (result) {
      setNewPlaylistName('');
      setShowCreateForm(false);
      loadPlaylists();
      ToastAndroid.show('Playlist created', ToastAndroid.SHORT);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!song) return;

    const result = await AddToPlaylist(playlistId, song);
    if (result.success) {
      ToastAndroid.show(result.message, ToastAndroid.SHORT);
      setVisible(false);
    } else {
      ToastAndroid.show(result.message, ToastAndroid.SHORT);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => setVisible(false)}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => setVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.container}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Heading text="Add to Playlist" nospace style={styles.headerTitle} />
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
              <AntDesign name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.playlistList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.createButton, showCreateForm && styles.activeCreateButton]}
              onPress={() => setShowCreateForm(!showCreateForm)}
            >
              <MaterialCommunityIcons name="playlist-plus" size={28} color={showCreateForm ? "white" : "#6CC04A"} />
              <PlainText text="Create new playlist" style={[styles.createText, showCreateForm && styles.activeCreateText]} />
            </TouchableOpacity>

            {showCreateForm && (
              <View style={styles.createForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Playlist Name"
                  placeholderTextColor="#888"
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoFocus
                />
                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={[styles.formButton, styles.cancelButton]}
                    onPress={() => setShowCreateForm(false)}
                  >
                    <PlainText text="Cancel" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formButton, styles.saveButton]}
                    onPress={handleCreatePlaylist}
                  >
                    <PlainText text="Create" style={styles.saveButtonText} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Spacer height={10} />

            {playlists.length === 0 ? (
              <View style={styles.emptyContainer}>
                <PlainText text="No playlists yet" style={styles.emptyText} />
              </View>
            ) : (
              playlists.map((playlist) => (
                <TouchableOpacity
                  key={playlist.id}
                  style={styles.playlistItem}
                  onPress={() => handleAddToPlaylist(playlist.id)}
                >
                  <MaterialCommunityIcons name="playlist-music" size={24} color="white" />
                  <PlainText text={playlist.name} style={styles.playlistName} />
                  <PlainText text={`${playlist.songs.length} songs`} style={styles.songCount} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: 'white',
  },
  closeButton: {
    padding: 5,
  },
  playlistList: {
    width: '100%',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 5,
  },
  activeCreateButton: {
    backgroundColor: '#6CC04A',
  },
  createText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#6CC04A',
    fontWeight: 'bold',
  },
  activeCreateText: {
    color: 'white',
  },
  createForm: {
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold', // Thick name while typing
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    gap: 10,
  },
  formButton: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: '#1DB954',
  },
  saveButtonText: {
    color: 'black',
    fontWeight: '900',
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  playlistName: {
    marginLeft: 15,
    fontSize: 17,
    fontWeight: 'bold', // Visible thick name
    color: 'white',
    flex: 1,
  },
  songCount: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
  },
});

export default PlaylistSelector;
