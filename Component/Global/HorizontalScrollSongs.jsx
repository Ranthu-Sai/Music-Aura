import {EachSongCard} from './EachSongCard';
import {Dimensions, ScrollView, View} from 'react-native';
import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {getPlaylistData} from '../../Api/Playlist';
import {ShimmerHorizontalSongList} from './ShimmerEffect';
import {Heading} from './Heading';
import FormatArtist from '../../Utils/FormatArtists';
import {Spacer} from './Spacer';

export const HorizontalScrollSongs = React.memo(({id}) => {
  const width = Dimensions.get('window').width;
  const [Loading, setLoading] = useState(true);
  const [Data, setData] = useState({});

  const fetchPlaylistData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      console.log('[HorizontalScrollSongs] loading playlist', {id});
      const data = await getPlaylistData(id);
      console.log('[HorizontalScrollSongs] playlist loaded', {
        id,
        hasData: !!data?.data,
        playlistName: data?.data?.name,
        songCount: data?.data?.songs?.length || 0,
        source: data?.data?.source,
        firstSong: data?.data?.songs?.[0]
          ? {
              id: data.data.songs[0].id,
              hasDownloadUrl: !!data.data.songs[0].downloadUrl,
              downloadUrlType: Array.isArray(data.data.songs[0].downloadUrl)
                ? 'array'
                : typeof data.data.songs[0].downloadUrl,
              source: data.data.songs[0].source,
            }
          : null,
      });
      setData(data);
    } catch (e) {
      console.warn('HorizontalScrollSongs: Failed to fetch playlist', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlaylistData();
  }, [fetchPlaylistData]);

  const songs = useMemo(() => Data?.data?.songs || [], [Data]);
  const playlistName = useMemo(() => Data?.data?.name || '', [Data]);
  const shouldRender = useMemo(
    () => id && playlistName !== 'Trending Today',
    [id, playlistName],
  );

  useEffect(() => {
    if (playlistName) {
      console.log('[HorizontalScrollSongs] render state', {
        id,
        playlistName,
        loading: Loading,
        songCount: songs.length,
        source: Data?.data?.source,
      });
    }
  }, [id, playlistName, Loading, songs.length, Data?.data?.source]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <Spacer />
      <Spacer />
      <Heading
        text={Loading ? 'Please Wait...' : playlistName}
        nospace={true}
      />
      <Spacer />
      {!Loading && songs.length > 0 && (
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingLeft: 13, paddingRight: 15}}>
          <View>
            {songs.slice(0, 4).map((e, i) => (
              <View key={e?.id ?? `song-${i}`} style={{marginBottom: 3}}>
                <EachSongCard
                  index={i}
                  isFromPlaylist={true}
                  Data={Data}
                  artist={FormatArtist(e?.artists?.primary || e?.primaryArtists)}
                  language={e?.language}
                  source={'saavn'}
                  playlist={true}
                  artistID={e?.primary_artists_id || e?.primaryArtistsId}
                  duration={e?.duration}
                  image={
                    Array.isArray(e?.image)
                      ? e?.image[2]?.url ||
                        e?.image[2]?.link ||
                        e?.image[1]?.url ||
                        e?.image[1]?.link ||
                        e?.image[0]?.url ||
                        e?.image[0]?.link ||
                        ''
                      : typeof e?.image === 'string'
                      ? e?.image
                      : ''
                  }
                  id={e?.id}
                  width={width * 0.8}
                  title={e?.name}
                  url={e?.downloadUrl}
                  titleandartistwidth={width * 0.5}
                />
              </View>
            ))}
          </View>
          <View>
            {songs.slice(4, 8).map((e, i) => (
              <View key={e?.id ?? `song-${i + 4}`} style={{marginBottom: 3}}>
                <EachSongCard
                  index={i + 4}
                  Data={Data}
                  isFromPlaylist={true}
                  artist={FormatArtist(e?.artists?.primary || e?.primaryArtists)}
                  language={e?.language}
                  source={'saavn'}
                  playlist={true}
                  artistID={e?.primary_artists_id || e?.primaryArtistsId}
                  duration={e?.duration}
                  image={
                    Array.isArray(e?.image)
                      ? e?.image[2]?.url ||
                        e?.image[2]?.link ||
                        e?.image[1]?.url ||
                        e?.image[1]?.link ||
                        e?.image[0]?.url ||
                        e?.image[0]?.link ||
                        ''
                      : typeof e?.image === 'string'
                      ? e?.image
                      : ''
                  }
                  id={e?.id}
                  width={width * 0.8}
                  title={e?.name}
                  url={e?.downloadUrl}
                  titleandartistwidth={width * 0.5}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {Loading && <ShimmerHorizontalSongList />}
    </>
  );
});
