import { MainWrapper } from "../Layout/MainWrapper";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { PlaylistTopHeader } from "../Component/Playlist/PlaylistTopHeader";
import { View, ImageBackground, StyleSheet, Dimensions } from "react-native";
import { EachSongCard } from "../Component/Global/EachSongCard";
import { useEffect, useState } from "react";
import { LoadingComponent } from "../Component/Global/Loading";
import { useTheme } from "@react-navigation/native";
import { PlainText } from "../Component/Global/PlainText";
import { SmallText } from "../Component/Global/SmallText";
import { getAlbumData } from "../Api/Album";
import { getSongData } from "../Api/Songs";
import { AlbumDetails } from "../Component/Album/AlbumDetails";
import FormatArtist from "../Utils/FormatArtists";
import { useActiveTrack } from "react-native-track-player";

export const Album = ({ route }) => {
  const theme = useTheme();
  const AnimatedRef = useAnimatedRef()
  const [Loading, setLoading] = useState(true)
  const [Data, setData] = useState({});
  const activeTrack = useActiveTrack();
  const { id, image: passedImage, highlightSongId } = route.params
  const [headerImage, setHeaderImage] = useState(passedImage || "");

  async function fetchAlbumData() {
    try {
      setLoading(true)
      let data = await getAlbumData(id)

      // Add 1 second delay to ensure correct song results
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Block podcasts by name/type heuristics
      const albumName = (data?.data?.name || '').toLowerCase();
      const albumType = (data?.data?.type || '').toLowerCase();
      if (albumType.includes('podcast') || albumType.includes('show') || albumName.includes('podcast') || albumName.includes('episode')) {
        data = { data: { name: data?.data?.name || 'Unavailable', image: data?.data?.image || [], year: data?.data?.year || '', songs: [] } };
      }
      // Check if songs are sample or empty
      if (!data.data.songs || data.data.songs.length === 0 || data.data.songs.some(song => song.name.toLowerCase().includes('sample') || song.name.toLowerCase().includes('trailer'))) {
        // Try fetching as song
        const songData = await getSongData(id)
        const song = songData.data[0]
        data = {
          data: {
            name: song.name,
            image: song.image,
            year: song.year,
            songs: [song],
          },
        }
      }
      if (data?.data?.songs?.length > 0) {
      }
      setData(data)

      // Update header image with the actual album image from API
      if (data?.data?.image) {
        const apiImage = Array.isArray(data.data.image) ? data.data.image[2]?.url : data.data.image;
        if (apiImage) {
          setHeaderImage(apiImage);
        }
      }
    } catch (e) {
      // Error fetching album data
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchAlbumData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Helper to format total duration
  const formatTotalDuration = (seconds) => {
    if (!seconds) {return "";}
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  return (
    <MainWrapper>
      {Loading &&
        <LoadingComponent loading={Loading} />}
      {!Loading && <>
        {(() => {
          const playableSongs = Data?.data?.songs?.filter(song => !song.name?.toLowerCase()?.includes('trailer') && !song.name?.toLowerCase()?.includes('sample')) || [];
          const albumData = Data?.data || {};

          return playableSongs.length > 0 ? (
            <ImageBackground
              source={{ uri: headerImage }}
              style={styles.background}
              blurRadius={50}
            >
              <View style={styles.overlay} />
              <Animated.ScrollView
                scrollEventThrottle={16}
                ref={AnimatedRef}
                contentContainerStyle={{
                  paddingBottom: activeTrack ? 105 : 70,
                  backgroundColor: "transparent",
                }}
              >
                {/* Premium Header with Background Image / Gradient */}
                <View style={{ position: 'relative' }}>
                  <PlaylistTopHeader url={headerImage} />
                </View>

                <AlbumDetails
                  name={albumData.name ?? ""}
                  artist={albumData.primaryArtist ?? "Various Artists"}
                  year={albumData.year ?? ""}
                  songCount={playableSongs.length}
                  duration={formatTotalDuration(albumData.totalDuration)}
                  Data={Data}
                />

                <View style={{
                  paddingHorizontal: 15,
                  marginTop: 10,
                  gap: 5,
                }}>
                  {playableSongs.map((e, i) => (
                    <EachSongCard
                      Data={Data}
                      index={i}
                      title={e?.name}
                      artist={FormatArtist(e?.artists?.primary)}
                      language={e?.language}
                      artistID={e?.primary_artists_id}
                      key={e?.id}
                      duration={e?.duration}
                      image={Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[1]?.url || e?.image[0]?.url || "") : (typeof e?.image === 'string' ? e?.image : "")}
                      id={e?.id}
                      width={"100%"}
                      albumName={albumData.name}
                      albumId={albumData.id}
                      releaseDate={albumData.year}
                      url={e?.downloadUrl || []}
                      highlightSongId={highlightSongId}
                      isHighlighted={highlightSongId === e?.id}
                    />
                  ))}
                </View>
              </Animated.ScrollView>
            </ImageBackground>
          ) : (
            <View style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}>
              <PlainText text={"Album not available"} />
              <SmallText text={"Songs are not playable"} />
            </View>
          );
        })()}
      </>}
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});

