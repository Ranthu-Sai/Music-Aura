import Animated, {useAnimatedRef} from 'react-native-reanimated';
import {
  useState,
  useCallback,
  useMemo,
} from 'react';
import {EachSongCard} from '../../Component/Global/EachSongCard';
import {
  Dimensions,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ToastAndroid,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import useAllSongsManager from '../../Component/Offline/AllSongsManager';
import {ShimmerSearchResults} from '../../Component/Global/ShimmerEffect';


export const AllSongsPage = () => {
  const AnimatedRef = useAnimatedRef();
  const width = Dimensions.get('window').width;
  const navigation = useNavigation();


  const [activeTab, setActiveTab] = useState('downloads'); // 'downloads' or 'local'
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden] = useState(false);

  const onSongsChanged = useCallback(songs => {}, []);



  const {
    downloadedSongs,
    localSongs,
    isLoading,
    isScanningLocal,
    loadDownloadedSongs,
    loadLocalSongs,
  } = useAllSongsManager({
    onSongsChanged,
    onDownloadStatusChanged: (songId, isDownloaded) => {},
    showHidden: showHidden,
  });

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'downloads') {
        await loadDownloadedSongs();
      } else {
        await loadLocalSongs(true);
      }
      ToastAndroid.show(`Refreshed ${activeTab} songs`, ToastAndroid.SHORT);
  }, [activeTab, loadDownloadedSongs, loadLocalSongs]);

  const filteredSongs = useMemo(() => {
    const source = activeTab === 'downloads' ? downloadedSongs : localSongs;
    if (!searchQuery) {
      return source;
    }
    return source.filter(
      song =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [activeTab, downloadedSongs, localSongs, searchQuery]);

  const handleShufflePlay = useCallback(async () => {
    if (filteredSongs.length === 0) {
      return;
    }
    const {AddPlaylist} = require('../../MusicPlayerFunctions');
    const shuffled = [...filteredSongs].sort(() => Math.random() - 0.5);

    const forPlayer = shuffled.map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.filePath,
      artwork: track.artwork,
      duration: track.duration,
      source: activeTab === 'downloads' ? 'downloaded' : 'local',
    }));

    await AddPlaylist(forPlayer);
    ToastAndroid.show('Shuffling ' + activeTab + ' songs', ToastAndroid.SHORT);
  }, [filteredSongs, activeTab]);



  return (
    <View style={{flex: 1, backgroundColor: 'black'}}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        ref={AnimatedRef}
        contentContainerStyle={{
          paddingBottom: 120,
          backgroundColor: 'black',
        }}>
        <View
          style={{paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20}}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <View>
              <Text style={{color: 'white', fontSize: 36, fontWeight: 'bold'}}>
                Library
              </Text>
              <Text
                style={{
                  color: '#1DB954',
                  fontSize: 16,
                  fontWeight: '600',
                  marginTop: 4,
                }}>
                {activeTab === 'downloads'
                  ? `${downloadedSongs.length} Downloaded`
                  : `${localSongs.length} Local`}{' '}
                Songs
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleShufflePlay}
              style={{
                backgroundColor: '#1DB954',
                width: 56,
                height: 56,
                borderRadius: 28,
                justifyContent: 'center',
                alignItems: 'center',
                elevation: 10,
                shadowColor: '#1DB954',
                shadowOffset: {width: 0, height: 4},
                shadowOpacity: 0.4,
                shadowRadius: 6,
              }}>
              <AntDesign name="caretright" size={26} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 25,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 15,
            height: 50,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}>
          <AntDesign name="search1" size={18} color="rgba(255,255,255,0.5)" />
          <TextInput
            placeholder="Search your music..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              color: 'white',
              fontSize: 16,
              marginLeft: 10,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <AntDesign
                name="closecircle"
                size={16}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Segmented Control */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginTop: 20,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 4,
            alignItems: 'center',
          }}>
          <TouchableOpacity
            onPress={() => setActiveTab('downloads')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor:
                activeTab === 'downloads'
                  ? 'rgba(255,255,255,0.15)'
                  : 'transparent',
              borderRadius: 10,
            }}>
            <Text
              style={{
                color:
                  activeTab === 'downloads'
                    ? '#1DB954'
                    : 'rgba(255,255,255,0.5)',
                fontWeight: '700',
                fontSize: 14,
              }}>
              Downloads
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('local')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor:
                activeTab === 'local'
                  ? 'rgba(255,255,255,0.15)'
                  : 'transparent',
              borderRadius: 10,
            }}>
            <Text
              style={{
                color:
                  activeTab === 'local' ? '#1DB954' : 'rgba(255,255,255,0.5)',
                fontWeight: '700',
                fontSize: 14,
              }}>
              Device Files
            </Text>
          </TouchableOpacity>

          {/* Show Hidden Files Toggle - Only visible for local tab */}
          {activeTab === 'local' && (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('HiddenSongs');
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginLeft: 4,
                backgroundColor: 'transparent',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MaterialCommunityIcons
                name="eye-off"
                size={22}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={{paddingHorizontal: 10, marginTop: 20}}>
          {isLoading || isScanningLocal ? (
            <View style={{marginTop: 50}}>
              {isScanningLocal ? (
                <>
                  <ActivityIndicator size="large" color="#1DB954" />
                  <Text
                    style={{color: 'white', textAlign: 'center', marginTop: 10}}>
                    Scanning local storage...
                  </Text>
                  <Text
                    style={{
                      color: 'white',
                      opacity: 0.5,
                      textAlign: 'center',
                      fontSize: 10,
                    }}>
                    Scanning your device for music files...
                  </Text>
                </>
              ) : (
                <ShimmerSearchResults itemCount={8} />
              )}
            </View>
          ) : (
            <View style={{paddingHorizontal: 5}}>
              {filteredSongs.length === 0 ? (
                <View style={{marginTop: 50, alignItems: 'center'}}>
                  <AntDesign
                    name="search1"
                    size={50}
                    color="rgba(255,255,255,0.2)"
                  />
                  <Text
                    style={{
                      color: 'white',
                      opacity: 0.6,
                      marginTop: 15,
                      fontSize: 16,
                    }}>
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : `No ${activeTab} songs found`}
                  </Text>
                  <TouchableOpacity
                    onPress={handleRefresh}
                    style={{
                      marginTop: 20,
                      paddingHorizontal: 25,
                      paddingVertical: 12,
                      backgroundColor: '#1DB954',
                      borderRadius: 25,
                    }}>
                    <Text style={{color: 'black', fontWeight: 'bold'}}>
                      Refresh List
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{flexDirection: 'column'}}>
                  {filteredSongs.map((track, i) => (
                    <View key={track.id} style={{marginBottom: 8}}>
                      <EachSongCard
                        width={width - 20}
                        Data={filteredSongs.map(t => ({
                          id: t?.id,
                          title: t?.title,
                          artist: t?.artist,
                          url: t?.filePath,
                          artwork: t?.artwork,
                          image: t?.artwork,
                          duration: t?.duration,
                          source:
                            activeTab === 'downloads' ? 'downloaded' : 'local',
                        }))}
                        index={i}
                        url={track?.filePath}
                        id={track?.id}
                        title={track?.title}
                        artist={track?.artist}
                        image={track?.artwork}
                        duration={track?.duration}
                        source={
                          activeTab === 'downloads' ? 'downloaded' : 'local'
                        }
                        onRemove={() =>
                          activeTab === 'downloads'
                            ? loadDownloadedSongs()
                            : loadLocalSongs()
                        }
                      />
                    </View>
                  ))}
                </View>
              )}

              {filteredSongs.length > 0 && (
                <TouchableOpacity
                  onPress={handleRefresh}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                    marginTop: 10,
                    gap: 8,
                  }}>
                  <AntDesign name="reload1" size={14} color="#1DB954" />
                  <Text
                    style={{color: '#1DB954', fontSize: 13, fontWeight: '600'}}>
                    Refresh Offline Library
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
};
