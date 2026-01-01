import { MainWrapper } from "../../Layout/MainWrapper";
import { ScrollView, View, RefreshControl, FlatList } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Heading } from "../../Component/Global/Heading";
import { HorizontalScrollSongs } from "../../Component/Global/HorizontalScrollSongs";
import { RouteHeading } from "../../Component/Home/RouteHeading";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { EachAlbumCard } from "../../Component/Global/EachAlbumCard";
import { RenderTopCharts } from "../../Component/Home/RenderTopCharts";
import { LoadingComponent } from "../../Component/Global/Loading";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useIsFocused } from "@react-navigation/native";
import { getHomePageData } from "../../Api/HomePage";
import { getAllPlaylists, getSearchPlaylistData } from "../../Api/Playlist";
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
  const [viralHitsId, setViralHitsId] = useState(null);
  const [trendingLangId, setTrendingLangId] = useState(null);
  const isFocused = useIsFocused();
  const refreshTimerRef = useRef(null);
  const activeTrack = useActiveTrack();

  // Filter out podcast / non-music entries heuristically before grouping
  const rawAlbums = useMemo(() => {
    return (Data?.data?.albums ?? []).filter(a => {
      const name = (a?.name || a?.title || '').toLowerCase();
      const type = (a?.type || '').toLowerCase();
      if (type.includes('podcast') || type.includes('show')) { return false; }
      if (name.includes('podcast') || name.includes('episode')) { return false; }
      return true;
    });
  }, [Data]);

  const albumData = useMemo(() => {
    const list = [];
    for (let i = 0; i < rawAlbums.length; i = i + 2) {
      if (i === rawAlbums.length - 1 && rawAlbums.length % 2 !== 0) {
        list.push([rawAlbums[i]]);
      } else {
        list.push([rawAlbums[i], rawAlbums[i + 1]]);
      }
    }
    return list;
  }, [rawAlbums]);

  const allPlaylistsData = useMemo(() => {
    const list = [];
    for (let i = 0; i < allPlaylists.length; i = i + 8) {
      list.push(allPlaylists.slice(i, i + 8));
    }
    return list;
  }, [allPlaylists]);

  const trendingSongs = useMemo(() => Data?.data?.trending?.songs ?? [], [Data]);
  const playlists = useMemo(() => Data?.data?.playlists ?? [], [Data]);
  const trendingAlbums = useMemo(() => Data?.data?.trending?.albums ?? [], [Data]);

  async function fetchHomePageData(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }
      const Languages = await GetLanguageValue();
      const data = await getHomePageData(Languages);
      const playlists = await getAllPlaylists(Languages);

      setData(data);
      setAllPlaylists(playlists?.data?.results || []);

      // Fetch Viral Hits and Trending ID for replacement
      if (Languages && Languages !== 'All') {
        try {
          const viralSearch = await getSearchPlaylistData(`Viral hits ${Languages}`, 1, 1);
          if (viralSearch?.data?.results?.[0]?.id) {
            setViralHitsId(viralSearch.data.results[0].id);
          }
          
          const trendingSearch = await getSearchPlaylistData(`Trending ${Languages}`, 1, 1);
          if (trendingSearch?.data?.results?.[0]?.id) {
            setTrendingLangId(trendingSearch.data.results[0].id);
          }
        } catch (err) {
          console.warn("Home: Failed to fetch viral/trending hits", err);
        }
      }
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

  const getChartId = (index) => {
    const chart = Data?.data?.charts?.[index];
    if (!chart) return null;
    
    const title = (chart.title || chart.name || '').toLowerCase();
    if (title.includes('2000s') && viralHitsId) {
      return viralHitsId;
    }
    return chart.id;
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
        <Animated.View entering={FadeIn.duration(400)}>
          <ScrollView
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
              <Heading text={"Top Trending Songs"} />
            </PaddingConatiner>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trendingSongs}
              keyExtractor={(item, index) => item?.id?.toString() ?? `trending-song-${index}`}
              contentContainerStyle={{ paddingHorizontal: 10 }}
              renderItem={({ item }) => (
                <View style={{ marginRight: 12 }}>
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
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(0)} />
              <Heading text={"Recommended Playlists"} />
            </PaddingConatiner>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={playlists}
              keyExtractor={(item, index) => item?.id?.toString() ?? `playlist-${index}`}
              contentContainerStyle={{ paddingHorizontal: 10 }}
              renderItem={({ item }) => (
                <View style={{ marginRight: 12 }}>
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
              )}
            />
            <PaddingConatiner>
              <Heading text={"Trending Albums"} />
            </PaddingConatiner>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trendingAlbums}
              keyExtractor={(item, index) => item?.id?.toString() ?? `trending-album-${index}`}
              contentContainerStyle={{ paddingHorizontal: 10 }}
              renderItem={({ item }) => (
                <View style={{ marginRight: 12 }}>
                  <EachAlbumCard
                    image={item.image[2].url || item.image[2].link}
                    artists={item.artists}
                    name={item.name}
                    id={item.id}
                  />
                </View>
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(1)} />
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
              <HorizontalScrollSongs id={getChartId(3)} />
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Recommended Albums"} />
            </PaddingConatiner>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={albumData}
              keyExtractor={(e, i) => `album-row-${i}`}
              contentContainerStyle={{ paddingHorizontal: 10 }}
              renderItem={({ item: e, index: i }) => (
                <View
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
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(2)} />
            </PaddingConatiner>
            <PaddingConatiner>
              <HorizontalScrollSongs id={trendingLangId} />
            </PaddingConatiner>
          </ScrollView>
          <TopHeader showHeader={showHeader} />
        </Animated.View>
      )}
    </MainWrapper>
  );
};
