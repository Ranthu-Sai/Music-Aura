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
      const { id, isSong } = route.params
      let data = { data: { songs: [] } };

      const fetchAsSong = async (songId) => {
        try {
          const songData = await getSongData(songId)
          let song = null;
          if (songData && songData.data && Array.isArray(songData.data) && songData.data[0]) {
            song = songData.data[0]
          } else if (songData && songData[songId]) {
            song = songData[songId]
          } else if (songData && typeof songData === 'object' && !songData.data) {
            song = songData;
          }

          if (song && (song.name || song.title)) {
            return {
              data: {
                name: song.name || song.title,
                image: song.image,
                year: song.year,
                songs: [song],
                primaryArtist: FormatArtist(song.artists?.primary || song.artist)
              },
            };
          }
        } catch (e) {
          // Song fetch failed
        }
        return null;
      };

      if (isSong) {
        const sData = await fetchAsSong(id);
        if (sData) {
          data = sData;
        }
      }

      // If we still don't have songs, try fetching as album
      if (!data.data.songs || data.data.songs.length === 0) {
        try {
          data = await getAlbumData(id)
        } catch (albumErr) {
          // If album call fails, try song data as fallback
          const sData = await fetchAsSong(id);
          if (sData) {
            data = sData;
          }
        }
      }

      // Add 1 second delay to ensure correct song results
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Block podcasts by name/type heuristics
      const albumName = (data?.data?.name || '').toLowerCase();
      const albumType = (data?.data?.type || '').toLowerCase();
      if (albumType.includes('podcast') || albumType.includes('show') || albumName.includes('podcast') || albumName.includes('episode')) {
        data = { data: { name: data?.data?.name || 'Unavailable', image: data?.data?.image || [], year: data?.data?.year || '', songs: [] } };
      }
      // Final fallback check if still empty
      if (!data.data.songs || data.data.songs.length === 0) {
        const sData = await fetchAsSong(id);
        if (sData) {
          data = sData;
        }
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
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
              <Animated.ScrollView
                scrollEventThrottle={16}
                ref={AnimatedRef}
                contentContainerStyle={{
                  paddingBottom: activeTrack ? 105 : 70,
                }}
              >
                {/* Album Header */}
                {/* <PlaylistTopHeader url={headerImage} /> */}

                <AlbumDetails
                  name={albumData.name ?? ""}
                  artist={albumData.primaryArtist ?? "Various Artists"}
                  year={albumData.year ?? ""}
                  songCount={playableSongs.length}
                  duration={formatTotalDuration(albumData.totalDuration)}
                  Data={Data}
                />

                {/* Songs List */}
                <View style={{
                  paddingHorizontal: 15,
                  marginTop: 8,
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
            </View>
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

const styles = StyleSheet.create({});

