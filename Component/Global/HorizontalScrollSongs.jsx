import {EachSongCard} from './EachSongCard';
import {Dimensions, ScrollView, View} from 'react-native';
import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {getPlaylistData} from '../../Api/Playlist';
import {LoadingComponent} from './Loading';
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
      const data = await getPlaylistData(id);
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
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          <View>
            {songs.slice(0, 4).map((e, i) => (
              <View key={e?.id ?? `song-${i}`} style={{marginBottom: 7}}>
                <EachSongCard
                  index={i}
                  isFromPlaylist={true}
                  Data={Data}
                  artist={FormatArtist(e?.artists?.primary)}
                  language={e?.language}
                  playlist={true}
                  artistID={e?.primary_artists_id}
                  duration={e?.duration}
                  image={
                    Array.isArray(e?.image)
                      ? e?.image[2]?.url ||
                        e?.image[1]?.url ||
                        e?.image[0]?.url ||
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
              <View key={e?.id ?? `song-${i + 4}`} style={{marginBottom: 7}}>
                <EachSongCard
                  index={i + 4}
                  Data={Data}
                  isFromPlaylist={true}
                  artist={FormatArtist(e?.artists?.primary)}
                  language={e?.language}
                  playlist={true}
                  artistID={e?.primary_artists_id}
                  duration={e?.duration}
                  image={
                    Array.isArray(e?.image)
                      ? e?.image[2]?.url ||
                        e?.image[1]?.url ||
                        e?.image[0]?.url ||
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
      {Loading && (
        <View
          style={{
            height: 280,
          }}>
          <LoadingComponent loading={Loading} />
        </View>
      )}
    </>
  );
});
