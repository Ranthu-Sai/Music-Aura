import { MainWrapper } from "../../Layout/MainWrapper";
import { ScrollView, View, RefreshControl, FlatList, AppState } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Heading } from "../../Component/Global/Heading";
import { HorizontalScrollSongs } from "../../Component/Global/HorizontalScrollSongs";
import { RouteHeading } from "../../Component/Home/RouteHeading";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { EachAlbumCard } from "../../Component/Global/EachAlbumCard";
import { RenderTopCharts } from "../../Component/Home/RenderTopCharts";
import { LoadingComponent } from "../../Component/Global/Loading";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useIsFocused } from "@react-navigation/native";
import { getHomePageData } from "../../Api/HomePage";
import { getSearchPlaylistData } from "../../Api/Playlist";
import { EachPlaylistCard } from "../../Component/Global/EachPlaylistCard";
import { EachTrendingSongCard } from "../../Component/Global/EachTrendingSongCard";
import { GetLanguageValue } from "../../LocalStorage/Languages";
import { TopHeader } from "../../Component/Home/TopHeader";
import { DisplayTopGenres } from "../../Component/Home/DisplayTopGenres";
import { useActiveTrack } from "react-native-track-player";
import { EachArtistChip } from "../../Component/Global/EachArtistChip";
import { getTopArtists } from "../../Api/Artists";

export const Home = () => {
  const [Loading, setLoading] = useState(true);
  const [Data, setData] = useState({});
  const [showHeader, setShowHeader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [viralHitsId, setViralHitsId] = useState(null);
  const [trendingLangId, setTrendingLangId] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
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

  

  const trendingSongs = useMemo(() => Data?.data?.trending?.songs ?? [], [Data]);
  const playlists = useMemo(() => Data?.data?.playlists ?? [], [Data]);
  const trendingAlbums = useMemo(() => Data?.data?.trending?.albums ?? [], [Data]);

  const playlistColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < playlists.length; i = i + 2) {
      cols.push(playlists.slice(i, i + 2));
    }
    return cols;
  }, [playlists]);

  const trendingAlbumColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < trendingAlbums.length; i = i + 2) {
      cols.push(trendingAlbums.slice(i, i + 2));
    }
    return cols;
  }, [trendingAlbums]);

  const artistColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < topArtists.length; i = i + 2) {
      cols.push(topArtists.slice(i, i + 2));
    }
    return cols;
  }, [topArtists]);

  async function fetchHomePageData(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }
      const Languages = await GetLanguageValue();
      const data = await getHomePageData(Languages);

      setData(data);

      // Fetch Top Artists filtered by language
      try {
        const artists = await getTopArtists();
        
        // Filter artists by language if specific language(s) selected
        if (Languages && Languages !== 'All' && Languages !== '') {
          const langList = Languages.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
          // Fetch songs for each artist to check language match
          const artistsWithLanguage = await Promise.all(
            artists.slice(0, 15).map(async (artist) => {
              try {
                const { getArtistTopSongs } = require('../../Api/Artists');
                const artistData = await getArtistTopSongs(artist.id, 3);
                const hasMatchingLanguage = artistData?.songs?.some(
                  song => {
                    const sLang = (song.language || '').toLowerCase();
                    return sLang && langList.includes(sLang);
                  }
                );
                return hasMatchingLanguage ? artist : null;
              } catch (error) {
                console.warn(`Failed to check artist ${artist.name}:`, error.message);
                return null;
              }
            })
          );
          const filteredArtists = artistsWithLanguage.filter(a => a !== null);
          setTopArtists(filteredArtists.slice(0, 12));
        } else {
          setTopArtists((artists || []).slice(0, 12));
        }
      } catch (err) {
        console.warn("Home: Failed to fetch top artists", err);
      }

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
    if (!chart) { return null; }

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
      }, 30000);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isFocused]);

  // Auto-refresh artists when available
  useEffect(() => {
    if (Data?.data && !Loading) {
      // Trigger artists fetch when home data is loaded
      const refreshArtists = async () => {
        try {
          const Languages = await GetLanguageValue();
          const artists = await getTopArtists();
          
          if (Languages && Languages !== 'All' && Languages !== '') {
            const langList = Languages.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
            const artistsWithLanguage = await Promise.all(
              artists.slice(0, 15).map(async (artist) => {
                try {
                  const { getArtistTopSongs } = require('../../Api/Artists');
                  const artistData = await getArtistTopSongs(artist.id, 3);
                  const hasMatchingLanguage = artistData?.songs?.some(
                    song => {
                      const sLang = (song.language || '').toLowerCase();
                      return sLang && langList.includes(sLang);
                    }
                  );
                  return hasMatchingLanguage ? artist : null;
                } catch (error) {
                  return null;
                }
              })
            );
            const filteredArtists = artistsWithLanguage.filter(a => a !== null);
            setTopArtists(filteredArtists.slice(0, 12));
          } else {
            setTopArtists((artists || []).slice(0, 12));
          }
        } catch (err) {
          console.warn("Failed to auto-refresh artists", err);
        }
      };
      
      refreshArtists();
    }
  }, [Data, Loading]);

  // Refresh when app comes to foreground to keep feed up-to-date
  useEffect(() => {
    const handleAppStateChange = (next) => {
      if (next === 'active') {
        fetchHomePageData(true);
      }
    };

    // RN AppState API may return a subscription object
    const sub = AppState.addEventListener ? AppState.addEventListener('change', handleAppStateChange) : null;
    if (!sub) {
      // Fallback for older RN versions
      AppState.addEventListener('change', handleAppStateChange);
    }

    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      } else {
        AppState.removeEventListener('change', handleAppStateChange);
      }
    };
  }, []);

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
              <Heading text={"Top Songs"} />
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
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Trending Albums"} />
            </PaddingConatiner>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trendingAlbumColumns}
              keyExtractor={(item, index) => `trending-album-col-${index}`}
              contentContainerStyle={{ paddingHorizontal: 10 }}
              renderItem={({ item }) => (
                <View style={{ marginRight: 12 }}>
                  {(item || []).map((album, idx) => (
                    <View key={album?.id ?? `trending-album-${idx}`} style={{ marginBottom: idx === 0 ? 12 : 0 }}>
                      <EachAlbumCard
                        image={album.image?.[2]?.url || album.image?.[2]?.link || album.image?.[0]?.url || ''}
                        artists={album.artists}
                        name={album.name}
                        id={album.id}
                      />
                    </View>
                  ))}
                </View>
              )}
            />
            
            {/* Top Artists Section */}
            {topArtists.length > 0 && (
              <>
                    <PaddingConatiner>
                      <Heading text={"Top Artists"} />
                    </PaddingConatiner>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={artistColumns}
                      keyExtractor={(item, index) => `artist-col-${index}`}
                      contentContainerStyle={{ paddingHorizontal: 6 }}
                      renderItem={({ item }) => (
                        <View style={{ marginRight: 8, alignItems: 'center' }}>
                          {(item || []).map((artist, idx) => (
                            <View key={artist?.id ?? `artist-${idx}`} style={{ marginBottom: idx === 0 ? 6 : 0 }}>
                              <EachArtistChip
                                id={artist.id}
                                name={artist.name}
                                image={artist.image}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                    />
                    <PaddingConatiner>
                      <Heading text={"Recommended Playlists"} />
                    </PaddingConatiner>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={playlistColumns}
                      keyExtractor={(item, index) => `playlist-col-${index}`}
                      contentContainerStyle={{ paddingHorizontal: 10 }}
                      renderItem={({ item }) => (
                        <View style={{ marginRight: 12 }}>
                          {(item || []).map((pl, idx) => (
                            <View key={pl?.id ?? `playlist-${idx}`} style={{ marginBottom: idx === 0 ? 12 : 0 }}>
                              <EachPlaylistCard
                                name={pl.title}
                                follower={pl.subtitle}
                                image={pl.image?.[2]?.url || pl.image?.[2]?.link || pl.image?.[0]?.url || ''}
                                id={pl.id}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                    />
              </>
            )}
            
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
