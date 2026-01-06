import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { ThemeContext } from '../../Context/Context';
import { MainWrapper } from '../../Layout/MainWrapper';
import { PaddingConatiner } from '../../Layout/PaddingConatiner';
import { Heading } from '../../Component/Global/Heading';
import { EachSongCard } from '../../Component/Global/EachSongCard';
import { getArtistTopSongs } from '../../Api/Artists';
import { useActiveTrack } from 'react-native-track-player';
import { GetLanguageValue } from '../../LocalStorage/Languages';

export const ArtistSongsPage = ({ route }) => {
  const { artistId, artistName, artistImage } = route.params;
  const { currentThemeColors } = React.useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [artistData, setArtistData] = useState(null);
  const activeTrack = useActiveTrack();

  const songs = useMemo(() => artistData?.songs || [], [artistData]);

  // Normalize songs for EachSongCard compatibility
  const normalizedSongs = useMemo(() => {
    return songs.map(song => ({
      id: song.id,
      title: song.song || song.title || song.name,
      artist: song.primary_artists || song.artist || song.subtitle,
      url: song.id, // Use song ID, the app will handle fetching stream URL
      downloadUrl: song.downloadUrl, // Array of quality URLs from streaming API
      artwork: song.image,
      image: song.image,
      duration: song.duration || 0,
      language: song.language || 'unknown',
      artistID: song.primary_artists_id || song.artistID,
      albumName: song.album,
      releaseDate: song.release_date || song.year,
      albumId: song.album_id || song.albumid,
      source: 'saavn',
      // Keep original fields for reference
      ...song,
    }));
  }, [songs]);

  const fetchArtistSongs = useCallback(async () => {
    try {
      setLoading(true);
      const language = await GetLanguageValue();
      // Fetch more songs (100) to ensure we have enough after language filtering
      const data = await getArtistTopSongs(artistId, 100, language);
      setArtistData(data);
    } catch (error) {
      console.error('Failed to fetch artist songs:', error);
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    fetchArtistSongs();
  }, [fetchArtistSongs]);

  const formatFollowers = (count) => {
    if (!count) {
      return '';
    }
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M followers`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K followers`;
    }
    return `${count} followers`;
  };

  return (
    <MainWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: activeTrack ? 105 : 70,
        }}
      >
        {/* Artist Header */}
        <View style={[styles.header, { backgroundColor: currentThemeColors.secondaryBackground }]}>
          <Image
            source={{ uri: artistImage || artistData?.image }}
            style={styles.artistImage}
            resizeMode="cover"
          />
          <Text style={[styles.artistName, { color: currentThemeColors.text }]}>
            {artistName || artistData?.name}
          </Text>
          {artistData?.followerCount && (
            <Text style={[styles.followers, { color: currentThemeColors.secondaryText }]}>
              {formatFollowers(artistData.followerCount)}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={currentThemeColors.primary} />
          </View>
        ) : (
          <>
            <PaddingConatiner>
              <Heading text={`Top Songs (${normalizedSongs.length})`} />
            </PaddingConatiner>

            {normalizedSongs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: currentThemeColors.secondaryText }]}>
                  No songs found for the selected language
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 10 }}>
                {normalizedSongs.map((song, index) => (
                  <EachSongCard
                    key={song.id || `song-${index}`}
                    id={song.id}
                    title={song.title}
                    artist={song.artist}
                    image={song.image}
                    url={song.url}
                    duration={song.duration}
                    language={song.language}
                    artistID={song.artistID}
                    albumName={song.albumName}
                    releaseDate={song.releaseDate}
                    albumId={song.albumId}
                    index={index}
                    Data={normalizedSongs}
                    source="artist"
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  artistImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 16,
  },
  artistName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  followers: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
