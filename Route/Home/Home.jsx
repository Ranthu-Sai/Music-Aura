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
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
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

// JioSaavn API Fallback URLs (for future use if primary API fails)
const JIOSAAVN_API_FALLBACKS = [
  'https://jiosaavn-api-2.vercel.app',     // Primary (currently used)
  'https://saavn-api.vercel.app',          // Secondary fallback
  'https://jio-savan-api-sigma.vercel.app', // Tertiary fallback
];

// Skeleton loading component
const SkeletonLoader = ({ width, height, style }) => (
  <View style={[{
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    width: width || 100,
    height: height || 20,
    opacity: 0.5,
  }, style]} />
);

// Skeleton for horizontal lists
const HorizontalSkeletonList = ({ itemCount = 5, itemWidth = 120, itemHeight = 120 }) => (
  <View style={{ flexDirection: 'row', paddingHorizontal: 15, marginVertical: 10 }}>
    {Array.from({ length: itemCount }).map((_, index) => (
      <SkeletonLoader
        key={index}
        width={itemWidth}
        height={itemHeight}
        style={{ marginRight: 15 }}
      />
    ))}
  </View>
);

// Skeleton for vertical lists
const VerticalSkeletonList = ({ itemCount = 3, itemHeight = 60 }) => (
  <View style={{ paddingHorizontal: 15, marginVertical: 10 }}>
    {Array.from({ length: itemCount }).map((_, index) => (
      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
        <SkeletonLoader width={itemHeight} height={itemHeight} style={{ borderRadius: itemHeight / 2, marginRight: 15 }} />
        <View style={{ flex: 1 }}>
          <SkeletonLoader width="80%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="60%" height={14} />
        </View>
      </View>
    ))}
  </View>
);

export const Home = () => {
  const [Loading, setLoading] = useState(true);
  const [LoadingSecondary, setLoadingSecondary] = useState(true);
  const [Data, setData] = useState({});
  const [showHeader, setShowHeader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [viralHitsId, setViralHitsId] = useState(null);
  const [trendingLangId, setTrendingLangId] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('All');
  const [secondaryDataLoaded, setSecondaryDataLoaded] = useState(false);
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

  // Fetch India Superhits playlists from working API
  const [indiaSuperhitsPlaylists, setIndiaSuperhitsPlaylists] = useState([]);

  const fetchIndiaSuperhitsPlaylists = useCallback(async () => {
    const playlistIds = ['1134543272', '1134548194', '1134643225', '1134768973']; // Hindi, General, Telugu, Bhojpuri
    const playlists = [];

    for (const id of playlistIds) {
      let success = false;

      // Try each API fallback in order
      for (const apiBase of JIOSAAVN_API_FALLBACKS) {
        if (success) {break;}

        try {
          const response = await fetch(`${apiBase}/playlists?id=${id}`);
          const data = await response.json();

          if (data.status === 'SUCCESS' && data.results) {
            const playlist = data.results;
            // Transform API response to match our chart format
            playlists.push({
              id: playlist.id,
              title: playlist.name,
              subtitle: `${playlist.songCount} songs`,
              language: playlist.name.toLowerCase().includes('hindi') ? 'hindi' :
                       playlist.name.toLowerCase().includes('telugu') ? 'telugu' :
                       playlist.name.toLowerCase().includes('bhojpuri') ? 'bhojpuri' : 'all',
              image: playlist.image ? [
                { url: playlist.image[0]?.link || playlist.image[0] },
                { url: playlist.image[1]?.link || playlist.image[1] },
                { url: playlist.image[2]?.link || playlist.image[2] },
              ] : [
                { url: 'https://via.placeholder.com/300x300?text=No+Image' },
                { url: 'https://via.placeholder.com/300x300?text=No+Image' },
                { url: 'https://via.placeholder.com/300x300?text=No+Image' },
              ],
              followerCount: playlist.followerCount,
              type: 'playlist',
            });
            success = true;
          }
        } catch (error) {
          console.warn(`Failed to fetch playlist ${id} from ${apiBase}:`, error);
          // Continue to next API fallback
        }
      }

      if (!success) {
        console.warn(`All API fallbacks failed for playlist ${id}`);
      }
    }

    setIndiaSuperhitsPlaylists(playlists);
  }, []);

  // Enhanced charts with India Superhits playlists
  const enhancedCharts = useMemo(() => {
    // Filter playlists based on current language
    const filteredIndiaSuperhitsPlaylists = indiaSuperhitsPlaylists.filter(playlist => {
      if (currentLanguage === 'All' || !currentLanguage) {
        return playlist.language === 'all'; // Only show general playlist when all languages selected
      }
      // Show both language-specific playlist and general playlist
      return playlist.language === currentLanguage.toLowerCase() || playlist.language === 'all';
    });

    const apiCharts = Data?.data?.charts ?? [];
    return [...filteredIndiaSuperhitsPlaylists, ...apiCharts];
  }, [Data?.data?.charts, currentLanguage, indiaSuperhitsPlaylists]);

  const fetchHomePageData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const Languages = await GetLanguageValue();
      setCurrentLanguage(Languages || 'All');

      // PRIORITY FETCH: Load critical top content first and show immediately
      const priorityData = await getHomePageData(Languages);

      // Show priority content immediately
      if (priorityData) {
        setData(priorityData);
      } else {
        setData({ data: { albums: [], playlists: [], trending: { songs: [], albums: [] }, charts: [] } });
      }

      // Stop main loading - show the feed now
      if (!silent) {
        setLoading(false);
      }

      // Load secondary content asynchronously with delay to prevent overwhelming the API
      setTimeout(() => {
        loadSecondaryContent(Languages);
      }, 500); // Small delay to let UI settle

    } catch (e) {
      console.error("Home: Critical error in fetchHomePageData", e);
      setData({ data: { albums: [], playlists: [], trending: { songs: [], albums: [] }, charts: [] } });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [setLoading, setData, setCurrentLanguage, loadSecondaryContent]);

  // Separate function for loading secondary content
  const loadSecondaryContent = useCallback(async (Languages) => {
    if (secondaryDataLoaded && !refreshing) {return;} // Don't reload if already loaded and not refreshing

    try {
      setLoadingSecondary(true);

      // Load artists first (most important secondary content)
      try {
        const artists = await getTopArtists(Languages);
        if (artists) {
          const artistsList = artists || [];
          setTopArtists(artistsList.slice(0, 15));
        }
      } catch (err) {
        console.warn("Home: Failed to fetch artists", err);
      }

      // Small delay before loading playlist IDs
      setTimeout(async () => {
        const [viralSearch, trendingSearch] = await Promise.allSettled([
          Languages && Languages !== 'All'
            ? getSearchPlaylistData(`Viral hits ${Languages}`, 1, 1)
            : Promise.resolve(null),
          Languages && Languages !== 'All'
            ? getSearchPlaylistData(`Trending ${Languages}`, 1, 1)
            : Promise.resolve(null),
        ]);

        // Set viral hits ID
        if (viralSearch.status === 'fulfilled' && viralSearch.value?.data?.results?.[0]?.id) {
          setViralHitsId(viralSearch.value.data.results[0].id);
        }

        // Set trending ID
        if (trendingSearch.status === 'fulfilled' && trendingSearch.value?.data?.results?.[0]?.id) {
          setTrendingLangId(trendingSearch.value.data.results[0].id);
        }

        setSecondaryDataLoaded(true);
        setLoadingSecondary(false);
      }, 300);

    } catch (e) {
      console.warn("Home: Error loading secondary content", e);
      setLoadingSecondary(false);
    }
  }, [secondaryDataLoaded, refreshing, setLoadingSecondary, setTopArtists, setViralHitsId, setTrendingLangId, setSecondaryDataLoaded]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomePageData();
    setRefreshing(false);
  };

  const getChartId = (index) => {
    const chart = Data?.data?.charts?.[index];
    if (!chart) { return null; }

    const title = (chart.title || chart.name || '').toLowerCase();
    // Skip decade/compilation charts like "2000s" to avoid duplicate Selected Language sections
    if (title.includes('2000s')) {
      return null;
    }

    return chart.id;
  };

  useEffect(() => {
    fetchHomePageData();
    fetchIndiaSuperhitsPlaylists(); // Fetch India Superhits playlists

    // Load current language on mount
    GetLanguageValue().then(language => {
      setCurrentLanguage(language || 'All');
    });
  }, [fetchHomePageData, fetchIndiaSuperhitsPlaylists]);

  // Refresh on focus and every 10 minutes while focused (reduced frequency)
  useEffect(() => {
    if (isFocused) {
      refreshTimerRef.current = setInterval(() => {
        fetchHomePageData(true); // Silent refresh
      }, 600000); // 10 minutes instead of 5
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isFocused, fetchHomePageData]);

  // Removed duplicate artist fetching - now handled in main fetchHomePageData

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
              <Heading text={"Latest Top Songs"} />
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
            {LoadingSecondary ? (
              <>
                <PaddingConatiner>
                  <SkeletonLoader width={120} height={24} style={{ marginBottom: 10 }} />
                </PaddingConatiner>
                <HorizontalSkeletonList itemCount={6} itemWidth={80} itemHeight={80} />
              </>
            ) : topArtists.length > 0 && (
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
              <RenderTopCharts playlist={enhancedCharts} />
            </ScrollView>
            {/* Viral Hits moved here under Top Charts */}
            {LoadingSecondary ? (
              <>
                <HorizontalSkeletonList itemCount={4} itemWidth={140} itemHeight={140} />
              </>
            ) : viralHitsId && (
              <>
                <PaddingConatiner>
                  <HorizontalScrollSongs id={viralHitsId} />
                </PaddingConatiner>
              </>
            )}
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


            {/* Trending Section */}
            {LoadingSecondary ? (
              <>
                <HorizontalSkeletonList itemCount={4} itemWidth={140} itemHeight={140} />
              </>
            ) : trendingLangId && (
              <>
                <PaddingConatiner>
                  <HorizontalScrollSongs id={trendingLangId} />
                </PaddingConatiner>
              </>
            )}
          </ScrollView>
          <TopHeader showHeader={showHeader} />
        </Animated.View>
      )}
    </MainWrapper>
  );
};
