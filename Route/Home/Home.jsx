import { MainWrapper } from "../../Layout/MainWrapper";
import { ScrollView, View, RefreshControl } from "react-native";
import { Heading } from "../../Component/Global/Heading";
import { HorizontalScrollSongs } from "../../Component/Global/HorizontalScrollSongs";
import { RouteHeading } from "../../Component/Home/RouteHeading";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { EachAlbumCard } from "../../Component/Global/EachAlbumCard";
import { RenderTopCharts } from "../../Component/Home/RenderTopCharts";
import { LoadingComponent } from "../../Component/Global/Loading";
import { useEffect, useState, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import { getHomePageData } from "../../Api/HomePage";
import { getAllPlaylists } from "../../Api/Playlist";
import { EachPlaylistCard } from "../../Component/Global/EachPlaylistCard";
import { EachTrendingSongCard } from "../../Component/Global/EachTrendingSongCard";
import { GetLanguageValue } from "../../LocalStorage/Languages";
import { TopHeader } from "../../Component/Home/TopHeader";
import { DisplayTopGenres } from "../../Component/Home/DisplayTopGenres";
import { useActiveTrack } from "react-native-track-player";

export const Home = () => {
  const [Loading, setLoading] = useState(true);
  const [Data, setData] = useState({});
  const [showHeader, setShowHeader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allPlaylists, setAllPlaylists] = useState([]);
  const isFocused = useIsFocused();
  const refreshTimerRef = useRef(null);
  const activeTrack = useActiveTrack();

  // Filter out podcast / non-music entries heuristically before grouping
  const rawAlbums = (Data?.data?.albums ?? []).filter(a => {
    const name = (a?.name || a?.title || '').toLowerCase();
    const type = (a?.type || '').toLowerCase();
    // Exclude if explicitly typed as podcast/show or name hints podcast content
    if (type.includes('podcast') || type.includes('show')) return false;
    if (name.includes('podcast') || name.includes('episode')) return false;
    return true;
  });
  const albumData = [];
  for (let i = 0; i < rawAlbums.length; i = i + 2) {
    if (i === rawAlbums.length - 1 && rawAlbums.length % 2 !== 0) {
      albumData.push([rawAlbums[i]]);
    } else {
      albumData.push([rawAlbums[i], rawAlbums[i + 1]]);
    }
  }

  const allPlaylistsData = [];
  for (let i = 0; i < allPlaylists.length; i = i + 8) {
    allPlaylistsData.push(allPlaylists.slice(i, i + 8));
  }

  async function fetchHomePageData(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }
      const Languages = await GetLanguageValue();
      const data = await getHomePageData(Languages);
      const playlists = await getAllPlaylists(Languages);

      // Filter albums by selected language
      if (data?.data?.albums && Languages && Languages !== 'All') {
        const languageLower = Languages.toLowerCase();
        data.data.albums = data.data.albums.filter(album => {
          const albumLanguage = (album?.language || '').toLowerCase();
          // Keep albums that match the selected language or have no language specified
          return !albumLanguage || albumLanguage === languageLower || albumLanguage === 'unknown';
        });
      }

      setData(data);
      setAllPlaylists(playlists?.data?.results || []);
    } catch (e) {
      // Error fetching home page data
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomePageData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHomePageData();
  }, []);

  // Refresh on focus and every 60s while focused
  useEffect(() => {
    if (isFocused) {
      fetchHomePageData(true);
      refreshTimerRef.current = setInterval(() => {
        fetchHomePageData(true);
      }, 60000);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isFocused]);

  return (
    <MainWrapper>
      <LoadingComponent loading={Loading} />
      {!Loading && (
        <View>
          <ScrollView
            style={{ zIndex: -1 }}
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y > 200 && !showHeader) {
                setShowHeader(true);
              } else if (e.nativeEvent.contentOffset.y < 200 && showHeader) {
                setShowHeader(false);
              }
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: activeTrack ? 105 : 70,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <RouteHeading showSearch={false} showSettings={true} />
            <DisplayTopGenres />
            <PaddingConatiner>
              <Heading text={"Trending Songs"} />
            </PaddingConatiner>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 10,
                paddingRight: 10,
              }}
            >
              {(Data?.data?.trending?.songs ?? []).map((item, index) => (
                <View
                  key={item?.id?.toString() ?? `trending-song-${index}`}
                  style={{ marginRight: 12 }}
                >
                  <EachTrendingSongCard
                    image={
                      item?.image?.[2]?.url ||
                      item?.image?.[2]?.link ||
                      item?.image?.[1]?.url ||
                      item?.image?.[1]?.link ||
                      item?.image?.[0]?.url ||
                      item?.image?.[0]?.link ||
                      item?.artwork ||
                      item?.thumbnail ||
                      "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png"
                    }
                    name={item.name}
                    artists={item.primaryArtists}
                    id={item.id}
                    url={item.downloadUrl}
                    duration={item.duration}
                    language={item.language}
                    artistID={item.primary_artists_id}
                  />
                </View>
              ))}
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[0]?.id} />
              <Heading text={"Recommended Playlists"} />
            </PaddingConatiner>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 10,
                paddingRight: 10,
              }}
            >
              {(Data?.data?.playlists ?? []).map((item, index) => (
                <View
                  key={item?.id?.toString() ?? `playlist-${index}`}
                  style={{ marginRight: 12 }}
                >
                  <EachPlaylistCard
                    name={item.title}
                    follower={item.subtitle}
                    image={
                      item.image[2]?.url ||
                      item.image[2]?.link ||
                      item.image[0]?.url
                    }
                    id={item.id}
                  />
                </View>
              ))}
            </ScrollView>
            <PaddingConatiner>
              <Heading text={"Trending Albums"} />
            </PaddingConatiner>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 10,
                paddingRight: 10,
              }}
            >
              {(Data?.data?.trending?.albums ?? []).map((item, index) => (
                <View
                  key={item?.id?.toString() ?? `trending-album-${index}`}
                  style={{ marginRight: 12 }}
                >
                  <EachAlbumCard
                    image={item.image[2].url || item.image[2].link}
                    artists={item.artists}
                    name={item.name}
                    id={item.id}
                  />
                </View>
              ))}
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[1]?.id} />
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Top Charts"} />
            </PaddingConatiner>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 10,
              }}
            >
              <RenderTopCharts playlist={Data?.data?.charts || []} />
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[3]?.id} />
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Recommended Albums"} />
            </PaddingConatiner>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 10,
                paddingRight: 10,
              }}
            >
              {albumData.map((e, i) => (
                <View
                  key={`album-row-${i}`}
                  style={{
                    gap: 15,
                    marginRight: 12,
                  }}
                >
                  {e.map((item, index) => (
                    <View key={item?.id ?? `album-col-${i}-${index}`}>
                      <EachAlbumCard
                        image={
                          item?.image[2]?.url || item?.image[2]?.link || ""
                        }
                        artists={item.artists}
                        name={item.name}
                        id={item.id}
                        isSong={true}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[2]?.id} />
            </PaddingConatiner>
          </ScrollView>
          <TopHeader showHeader={showHeader} />
        </View>
      )}
    </MainWrapper>
  );
};
