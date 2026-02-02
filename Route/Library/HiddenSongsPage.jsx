import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ToastAndroid,
  FlatList,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {getHiddenFiles, unhideFile} from '../../LocalStorage/HiddenLocalFiles';
import {ShimmerSearchResults} from '../../Component/Global/ShimmerEffect';
import {DeviceEventEmitter} from 'react-native';

export const HiddenSongsPage = () => {
  const navigation = useNavigation();
  const [hiddenSongs, setHiddenSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHiddenSongs = useCallback(async () => {
    try {
      setIsLoading(true);
      const hiddenPaths = await getHiddenFiles();

      // Create song objects from paths
      const songs = hiddenPaths.map(path => {
        const fileName = path.split('/').pop().split('\\').pop();
        const title = fileName.replace(/\.[^/.]+$/, '');

        return {
          id: path,
          filePath: path,
          title: title,
          fileName: fileName,
        };
      });

      setHiddenSongs(songs);
    } catch (error) {
      console.error('Error loading hidden songs:', error);
      ToastAndroid.show('Failed to load hidden songs', ToastAndroid.SHORT);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHiddenSongs();
  }, [loadHiddenSongs]);

  const handleUnhide = useCallback(
    async song => {
      try {
        await unhideFile(song.filePath);
        ToastAndroid.show('Song unhidden', ToastAndroid.SHORT);

        // Emit event to refresh device files list
        DeviceEventEmitter.emit('localSongUnhidden', song.id);

        // Reload hidden songs list
        loadHiddenSongs();
      } catch (error) {
        console.error('Error unhiding song:', error);
        ToastAndroid.show('Failed to unhide song', ToastAndroid.SHORT);
      }
    },
    [loadHiddenSongs],
  );

  const renderItem = ({item}) => (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 15,
        marginVertical: 5,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
      }}>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
        <MaterialCommunityIcons
          name="music-note"
          size={24}
          color="rgba(255,255,255,0.5)"
        />
      </View>

      <View style={{flex: 1}}>
        <Text
          style={{color: 'white', fontSize: 15, fontWeight: '600'}}
          numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          style={{color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2}}
          numberOfLines={1}>
          {item.fileName}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => handleUnhide(item)}
        style={{
          backgroundColor: '#1DB954',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          marginLeft: 10,
        }}>
        <Text style={{color: 'white', fontSize: 13, fontWeight: '600'}}>
          Unhide
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{flex: 1, backgroundColor: 'black'}}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 15,
          paddingTop: 50,
          paddingBottom: 20,
        }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <AntDesign name="arrowleft" size={24} color="white" />
        </TouchableOpacity>

        <View style={{flex: 1, marginLeft: 10}}>
          <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold'}}>
            Hidden Songs
          </Text>
          <Text style={{color: '#1DB954', fontSize: 14, marginTop: 2}}>
            {hiddenSongs.length} songs hidden
          </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'stretch'}}>
          <View style={{paddingHorizontal: 10}}>
            <ShimmerSearchResults itemCount={6} />
          </View>
        </View>
      ) : hiddenSongs.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 40,
          }}>
          <MaterialCommunityIcons
            name="eye-off"
            size={64}
            color="rgba(255,255,255,0.2)"
          />
          <Text
            style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '600',
              marginTop: 20,
              textAlign: 'center',
            }}>
            No Hidden Songs
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center',
            }}>
            Songs you hide will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={hiddenSongs}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{paddingBottom: 100, paddingTop: 10}}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};
