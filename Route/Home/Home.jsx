import {MainWrapper} from '../../Layout/MainWrapper';
import {
  ScrollView,
  View,
  RefreshControl,
  FlatList,
  Dimensions,
} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {Heading} from '../../Component/Global/Heading';
import {HorizontalScrollSongs} from '../../Component/Global/HorizontalScrollSongs';
import {RouteHeading} from '../../Component/Home/RouteHeading';
import {PaddingConatiner} from '../../Layout/PaddingConatiner';
import {EachAlbumCard} from '../../Component/Global/EachAlbumCard';
import {RenderTopCharts} from '../../Component/Home/RenderTopCharts';
import React, {useEffect, useState, useRef, useMemo, useCallback} from 'react';
import {useIsFocused, useTheme} from '@react-navigation/native';
import {getHomePageData} from '../../Api/HomePage';
import {getSearchPlaylistData} from '../../Api/Playlist';
import {EachPlaylistCard} from '../../Component/Global/EachPlaylistCard';
import {EachTrendingSongCard} from '../../Component/Global/EachTrendingSongCard';
import {GetLanguageValue} from '../../LocalStorage/Languages';
import {GetHomeFeedSource} from '../../LocalStorage/AppSettings';
import {TopHeader} from '../../Component/Home/TopHeader';
import {DisplayTopGenres} from '../../Component/Home/DisplayTopGenres';
import {useActiveTrack} from 'react-native-track-player';
import {EachArtistChip} from '../../Component/Global/EachArtistChip';
import {getLanguageTopArtists} from '../../Api/Artists';
import LinearGradient from 'react-native-linear-gradient';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  ShimmerEffect,
  ShimmerAlbumCard,
  ShimmerHorizontalList,
  ShimmerTrendingSongsList,
  ShimmerArtistChips,
  ShimmerHorizontalSongList,
} from '../../Component/Global/ShimmerEffect';
import {ErrorBoundary} from '../../Component/Global/ErrorBoundary';
import {Spacer} from '../../Component/Global/Spacer';
import {YTMusicHomeFeed} from '../../Component/Home/YTMusicHomeFeed';

// JioSaavn API Fallback URLs (only hosts that support /modules endpoint)
const JIOSAAVN_API_FALLBACKS = [
  'https://jiosaavn-api-privatecvc2.vercel.app', // Primary fallback
  'https://jio-saavan-api.vercel.app', // Secondary fallback
];

async function parseJsonResponseSafely(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  const bodyText = await response.text();

  if (!bodyText) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(bodyText);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
  }
}

const SectionLoadingBlock = ({titleWidth = 180, children}) => (
  <View style={{marginBottom: 10}}>
    <View style={{paddingHorizontal: 13, marginBottom: 12, marginTop: 8}}>
      <ShimmerEffect width={titleWidth} height={28} borderRadius={6} />
    </View>
    {children}
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
  const [cricketFeverPlaylists, setCricketFeverPlaylists] = useState([]);
  const [isCricketFeverLoading, setIsCricketFeverLoading] = useState(true);
  const [languageTopArtists, setLanguageTopArtists] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('All');
  const [homeFeedSource, setHomeFeedSource] = useState('Saavn');
  const isFocused = useIsFocused();
  const refreshTimerRef = useRef(null);
  const ytMusicFeedRef = useRef(null);
  const ytLoadMoreCooldownRef = useRef(0);
  const activeTrack = useActiveTrack();
  const {height, width} = Dimensions.get('window');
  const scrollThreshold = height * 0.05;
  const hasHandledInitialFocusRef = useRef(false);
  const hasRunInitialLoadRef = useRef(false);

  const {dark} = useTheme();
  const auraValue = useSharedValue(0);

  useEffect(() => {
    auraValue.value = withRepeat(
      withTiming(1, {duration: 6000, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [auraValue]);

  const auraStyle1 = useAnimatedStyle(() => ({
    opacity: interpolate(auraValue.value, [0, 1], [0.15, 0.3]),
    transform: [
      {scale: interpolate(auraValue.value, [0, 1], [1, 1.3])},
      {translateX: interpolate(auraValue.value, [0, 1], [0, 50])},
      {translateY: interpolate(auraValue.value, [0, 1], [0, -30])},
    ],
  }));

  const auraStyle2 = useAnimatedStyle(() => ({
    opacity: interpolate(auraValue.value, [0, 1], [0.1, 0.25]),
    transform: [
      {scale: interpolate(auraValue.value, [0, 1], [1.2, 1])},
      {translateX: interpolate(auraValue.value, [0, 1], [0, -40])},
      {translateY: interpolate(auraValue.value, [0, 1], [0, 60])},
    ],
  }));

  // Filter out podcast / non-music entries heuristically before grouping
  const rawAlbums = useMemo(() => {
    return (Data?.data?.albums ?? []).filter(a => {
      const name = (a?.name || a?.title || '').toLowerCase();
      const type = (a?.type || '').toLowerCase();
      if (type.includes('podcast') || type.includes('show')) {
        return false;
      }
      if (name.includes('podcast') || name.includes('episode')) {
        return false;
      }
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

  const trendingSongs = useMemo(
    () => Data?.data?.trending?.songs ?? [],
    [Data],
  );
  const playlists = useMemo(() => Data?.data?.playlists ?? [], [Data]);
  const trendingAlbums = useMemo(
    () => Data?.data?.trending?.albums ?? [],
    [Data],
  );

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

  const cricketFeverColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < cricketFeverPlaylists.length; i = i + 2) {
      cols.push(cricketFeverPlaylists.slice(i, i + 2));
    }
    return cols;
  }, [cricketFeverPlaylists]);

  // Top artists removed from the Home page

  const languageTopArtistColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < languageTopArtists.length; i = i + 2) {
      cols.push(languageTopArtists.slice(i, i + 2));
    }
    return cols;
  }, [languageTopArtists]);

  // Fetch India Superhits playlists from working API
  const [indiaSuperhitsPlaylists, setIndiaSuperhitsPlaylists] = useState([]);

  const fetchIndiaSuperhitsPlaylists = useCallback(async () => {
    const playlistIds = [
      '1134543272',
      '1134548194',
      '1134643225',
      '1134768973',
    ]; // Hindi, General, Telugu, Bhojpuri
    const fetchedPlaylists = [];

    for (const id of playlistIds) {
      let success = false;

      // Try each API fallback in order
      for (const apiBase of JIOSAAVN_API_FALLBACKS) {
        if (success) {
          break;
        }

        try {
          const response = await fetch(`${apiBase}/playlists?id=${id}`);
          if (!response.ok) {
            continue;
          }

          const data = await parseJsonResponseSafely(response);
          if (!data) {
            continue;
          }

          // Support multiple response shapes: { status, results } or { status, data }
          let playlist = null;
          if (data && data.status === 'SUCCESS') {
            if (data.results) {
              playlist = data.results;
            } else if (data.data) {
              playlist = data.data;
            }
          }

          // Some APIs return an array or slightly different structure; normalize defensively
          if (!playlist && Array.isArray(data) && data.length > 0) {
            playlist = data[0];
          }

          if (playlist && playlist.id) {
            // Transform API response to match our chart format
            fetchedPlaylists.push({
              id: playlist.id,
              title: playlist.name || playlist.title || '',
              subtitle: `${playlist.songCount || playlist.songs?.length || 0} songs`,
              language: (playlist.name || '').toLowerCase().includes('hindi')
                ? 'hindi'
                : (playlist.name || '').toLowerCase().includes('telugu')
                ? 'telugu'
                : (playlist.name || '').toLowerCase().includes('bhojpuri')
                ? 'bhojpuri'
                : 'all',
              image: playlist.image
                ? [
                    {url: playlist.image[0]?.link || playlist.image[0]},
                    {url: playlist.image[1]?.link || playlist.image[1]},
                    {url: playlist.image[2]?.link || playlist.image[2]},
                  ]
                : [
                    {url: 'https://via.placeholder.com/300x300?text=No+Image'},
                    {url: 'https://via.placeholder.com/300x300?text=No+Image'},
                    {url: 'https://via.placeholder.com/300x300?text=No+Image'},
                  ],
              followerCount: playlist.followerCount || 0,
              type: 'playlist',
            });
            success = true;
          }
        } catch (error) {
          const isExpectedParseFallbackError =
            error instanceof SyntaxError ||
            String(error?.message || error).includes('JSON Parse error');

          if (!isExpectedParseFallbackError) {
            console.warn(
              `Failed to fetch playlist ${id} from ${apiBase}:`,
              error,
            );
          }
          // Continue to next API fallback
        }
      }

      if (!success) {
        console.warn(`All API fallbacks failed for playlist ${id}`);
      }
    }

    setIndiaSuperhitsPlaylists(fetchedPlaylists);
  }, []);

  // Enhanced charts with India Superhits playlists
  const enhancedCharts = useMemo(() => {
    // Filter playlists based on current language
    const filteredIndiaSuperhitsPlaylists = indiaSuperhitsPlaylists.filter(
      playlist => {
        if (currentLanguage === 'All' || !currentLanguage) {
          return playlist.language === 'all'; // Only show general playlist when all languages selected
        }
        // Show both language-specific playlist and general playlist
        return (
          playlist.language === currentLanguage.toLowerCase() ||
          playlist.language === 'all'
        );
      },
    );

    const apiCharts = Data?.data?.charts ?? [];
    return [...filteredIndiaSuperhitsPlaylists, ...apiCharts];
  }, [Data?.data?.charts, currentLanguage, indiaSuperhitsPlaylists]);

  // Separate function for loading secondary content
  const loadSecondaryContent = useCallback(
    async Languages => {
      try {
        setLoadingSecondary(true);
        setIsCricketFeverLoading(true);

        // Load artists (only language-specific latest artists retained)
        try {
          const languageTop = Languages && Languages !== 'All'
            ? await getLanguageTopArtists(Languages)
            : [];
          if (languageTop && languageTop.length > 0) {
            setLanguageTopArtists(languageTop.slice(0, 16));
          } else {
            setLanguageTopArtists([]);
          }
        } catch (err) {
          console.warn('Home: Failed to fetch artists', err);
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
          if (
            viralSearch.status === 'fulfilled' &&
            viralSearch.value?.data?.results?.[0]?.id
          ) {
            setViralHitsId(viralSearch.value.data.results[0].id);
          }

          // Set trending ID
          if (
            trendingSearch.status === 'fulfilled' &&
            trendingSearch.value?.data?.results?.[0]?.id
          ) {
            setTrendingLangId(trendingSearch.value.data.results[0].id);
          }

          try {
            const [iplSearch, cricketSearch] = await Promise.all([
              getSearchPlaylistData('Indian Party League', 1, 50),
              getSearchPlaylistData('cricket', 1, 16),
            ]);

            const iplResults =
              (iplSearch?.data?.results || iplSearch?.results || []).filter(item =>
                String(item?.name || item?.title || '')
                  .toLowerCase()
                  .includes('indian party league'),
              );
            const cricketResults =
              cricketSearch?.data?.results || cricketSearch?.results || [];

            const mergedResults = [...iplResults, ...cricketResults].filter(
              (item, index, arr) =>
                item?.id && arr.findIndex(x => x?.id === item.id) === index,
            );

            const mappedCricketPlaylists = mergedResults
              .filter(item => item?.id)
              .map(item => ({
                id: item.id,
                title: item.name || item.title || 'Cricket Fever',
                subtitle: `Total ${item.songCount || item.songs?.length || 0} Songs`,
                image: item.image
                  ? [
                      {url: item.image[0]?.link || item.image[0]},
                      {url: item.image[1]?.link || item.image[1]},
                      {url: item.image[2]?.link || item.image[2]},
                    ]
                  : [
                      {url: 'https://via.placeholder.com/300x300?text=No+Image'},
                      {url: 'https://via.placeholder.com/300x300?text=No+Image'},
                      {url: 'https://via.placeholder.com/300x300?text=No+Image'},
                    ],
                type: 'playlist',
              }));

            if (mappedCricketPlaylists.length > 0) {
              setCricketFeverPlaylists(mappedCricketPlaylists);
            }
          } catch (e) {
            console.warn('Home: Failed to fetch Cricket Fever playlists', e);
          } finally {
            setIsCricketFeverLoading(false);
          }

          setLoadingSecondary(false);
        }, 300);
      } catch (e) {
        console.warn('Home: Error loading secondary content', e);
        setIsCricketFeverLoading(false);
        setLoadingSecondary(false);
      }
    },
    [
      setIsCricketFeverLoading,
      setLoadingSecondary,
      setLanguageTopArtists,
      setViralHitsId,
      setTrendingLangId,
      setCricketFeverPlaylists,
    ],
  );

  const fetchHomePageData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const savedHomeFeedSource = await GetHomeFeedSource();
        const activeHomeFeedSource = savedHomeFeedSource || 'Saavn';
        setHomeFeedSource(activeHomeFeedSource);

        if (activeHomeFeedSource === 'YTMusic') {
          setLoading(false);
          setLoadingSecondary(false);
          setIsCricketFeverLoading(false);
          setLanguageTopArtists([]);
          return;
        }

        setLoadingSecondary(true);
        setIsCricketFeverLoading(true);
        setViralHitsId(null);
        setTrendingLangId(null);
        setCricketFeverPlaylists([]);
        setLanguageTopArtists([]);

        const Languages = await GetLanguageValue();
        setCurrentLanguage(Languages || 'All');

        // PRIORITY FETCH: Load critical top content first and show immediately
        const priorityData = await getHomePageData(Languages);

        // Show priority content immediately
        if (priorityData) {
          setData(priorityData);
        } else {
          setData({
            data: {
              albums: [],
              playlists: [],
              trending: {songs: [], albums: []},
              charts: [],
            },
          });
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
        console.error('Home: Critical error in fetchHomePageData', e);
        setData({
          data: {
            albums: [],
            playlists: [],
            trending: {songs: [], albums: []},
            charts: [],
          },
        });
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      setLoading,
      setData,
      setCurrentLanguage,
      loadSecondaryContent,
      setLanguageTopArtists,
      setHomeFeedSource,
      setViralHitsId,
      setTrendingLangId,
      setCricketFeverPlaylists,
      setIsCricketFeverLoading,
    ],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (homeFeedSource === 'YTMusic' && ytMusicFeedRef.current?.refresh) {
      await ytMusicFeedRef.current.refresh();
      setRefreshing(false);
      return;
    }
    await fetchHomePageData();
    setRefreshing(false);
  };

  const getChartId = index => {
    const chart = Data?.data?.charts?.[index];
    if (!chart) {
      return null;
    }

    const title = (chart.title || chart.name || '').toLowerCase();
    // Skip decade/compilation charts like "2000s" to avoid duplicate Selected Language sections
    if (title.includes('2000s')) {
      return null;
    }

    return chart.id;
  };

  useEffect(() => {
    if (hasRunInitialLoadRef.current) {
      return;
    }
    hasRunInitialLoadRef.current = true;

    fetchHomePageData();

    // Load current language on mount
    GetLanguageValue().then(language => {
      setCurrentLanguage(language || 'All');
    });

    GetHomeFeedSource().then(source => {
      const activeSource = source || 'Saavn';
      setHomeFeedSource(activeSource);
      if (activeSource !== 'YTMusic') {
        fetchIndiaSuperhitsPlaylists();
      }
    });
  }, [fetchHomePageData, fetchIndiaSuperhitsPlaylists]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (!hasHandledInitialFocusRef.current) {
      hasHandledInitialFocusRef.current = true;
      return;
    }

    GetHomeFeedSource().then(source => {
      const activeSource = source || 'Saavn';
      if (activeSource !== homeFeedSource) {
        setHomeFeedSource(activeSource);
        if (activeSource !== 'YTMusic') {
          fetchIndiaSuperhitsPlaylists();
          fetchHomePageData(true);
        } else if (ytMusicFeedRef.current?.refresh) {
          ytMusicFeedRef.current.refresh();
        }
      }
    });
  }, [
    isFocused,
    homeFeedSource,
    fetchHomePageData,
    fetchIndiaSuperhitsPlaylists,
  ]);

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

  if (homeFeedSource === 'YTMusic') {
    return (
      <MainWrapper>
        {/* Beautiful Aura Background */}
        <View style={{position: 'absolute', top: 0, left: 0, right: 0, height: height, zIndex: -1}}>
          <LinearGradient
            colors={[dark ? '#0a0a0a' : '#f8f8f8', dark ? '#000000' : '#ffffff']}
            style={{flex: 1}}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -50,
                right: -50,
                width: width * 0.8,
                height: width * 0.8,
                borderRadius: width * 0.4,
                backgroundColor: dark ? 'rgba(29, 185, 84, 0.4)' : 'rgba(29, 185, 84, 0.2)',
              },
              auraStyle1,
            ]}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                bottom: 100,
                left: -100,
                width: width * 0.9,
                height: width * 0.9,
                borderRadius: width * 0.45,
                backgroundColor: dark ? 'rgba(64, 224, 208, 0.3)' : 'rgba(64, 224, 208, 0.15)',
              },
              auraStyle2,
            ]}
          />
        </View>

        <Animated.View entering={FadeIn.duration(400)} style={{flex: 1}}>
          <ErrorBoundary name="HomeContent">
            <View style={{flex: 1}}>
              <ScrollView
                onScroll={e => {
                  const {contentOffset, layoutMeasurement, contentSize} = e.nativeEvent;

                  if (contentOffset.y > scrollThreshold && !showHeader) {
                    setShowHeader(true);
                  } else if (contentOffset.y < scrollThreshold && showHeader) {
                    setShowHeader(false);
                  }

                  const scrollProgress =
                    (contentOffset.y + layoutMeasurement.height) /
                    Math.max(contentSize.height, 1);
                  const canLoadMore =
                    contentSize.height > layoutMeasurement.height + 160 &&
                    contentOffset.y > 120 &&
                    scrollProgress > 0.70;

                  if (canLoadMore && ytMusicFeedRef.current?.loadMore) {
                    const now = Date.now();
                    if (now - ytLoadMoreCooldownRef.current > 500) {
                      ytLoadMoreCooldownRef.current = now;
                      ytMusicFeedRef.current.loadMore();
                    }
                  }
                }}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: activeTrack ? 120 : 80,
                }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#1DB954']}
                    tintColor={'#1DB954'}
                  />
                }>
                <RouteHeading showSearch={true} showSettings={true} />
                <DisplayTopGenres />
                <YTMusicHomeFeed
                  ref={ytMusicFeedRef}
                  refreshing={refreshing}
                  onRefreshComplete={() => setRefreshing(false)}
                />
              </ScrollView>
              <TopHeader showHeader={showHeader} />
            </View>
          </ErrorBoundary>
        </Animated.View>
      </MainWrapper>
    );
  }

  return (
    <MainWrapper>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: height,
          zIndex: -1,
        }}>
        <LinearGradient
          colors={[dark ? '#0a0a0a' : '#f8f8f8', dark ? '#000000' : '#ffffff']}
          style={{flex: 1}}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -50,
              right: -50,
              width: width * 0.8,
              height: width * 0.8,
              borderRadius: width * 0.4,
              backgroundColor: dark
                ? 'rgba(29, 185, 84, 0.4)'
                : 'rgba(29, 185, 84, 0.2)',
            },
            auraStyle1,
          ]}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 100,
              left: -100,
              width: width * 0.9,
              height: width * 0.9,
              borderRadius: width * 0.45,
              backgroundColor: dark
                ? 'rgba(64, 224, 208, 0.3)'
                : 'rgba(64, 224, 208, 0.15)',
            },
            auraStyle2,
          ]}
        />
      </View>
      <Animated.View entering={FadeIn.duration(400)}>
        <ErrorBoundary name="HomeContent">
          <ScrollView
            onScroll={e => {
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }>
            <RouteHeading showSearch={false} showSettings={true} />
            <DisplayTopGenres />
            {Loading ? (
              <>
                <SectionLoadingBlock titleWidth={180}>
                  <ShimmerTrendingSongsList itemCount={6} />
                </SectionLoadingBlock>

                <SectionLoadingBlock titleWidth={200}>
                  <ShimmerHorizontalSongList />
                </SectionLoadingBlock>

                <SectionLoadingBlock titleWidth={190}>
                  <ShimmerHorizontalList itemCount={6} />
                </SectionLoadingBlock>

                <SectionLoadingBlock titleWidth={160}>
                  <ShimmerArtistChips itemCount={8} />
                </SectionLoadingBlock>

                <SectionLoadingBlock titleWidth={240}>
                  <ShimmerHorizontalList itemCount={6} />
                </SectionLoadingBlock>

                <SectionLoadingBlock titleWidth={200}>
                  <ShimmerHorizontalSongList />
                </SectionLoadingBlock>
              </>
            ) : (
              <>
            <PaddingConatiner>
              <Heading text={'Latest Top Songs'} />
            </PaddingConatiner>
            {trendingSongs && trendingSongs.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={trendingSongs}
                keyExtractor={(item, index) =>
                  item?.id?.toString() ?? `trending-song-${index}`
                }
                contentContainerStyle={{paddingHorizontal: 10}}
                renderItem={({item}) => (
                  <View style={{marginRight: 12}}>
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
                        'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png'
                      }
                      name={item.name}
                      artists={item.primaryArtists}
                      id={item.id}
                      url={item.downloadUrl}
                      duration={item.duration}
                      language={item.language}
                      artistID={item.primary_artists_id || item.primaryArtistsId}
                    />
                  </View>
                )}
              />
            ) : (
              <ShimmerTrendingSongsList itemCount={6} />
            )}
            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(0)} />
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={'Trending Albums'} />
            </PaddingConatiner>
            {trendingAlbumColumns && trendingAlbumColumns.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={trendingAlbumColumns}
                keyExtractor={(item, index) => `trending-album-col-${index}`}
                contentContainerStyle={{paddingHorizontal: 10}}
                renderItem={({item}) => (
                  <View style={{marginRight: 12}}>
                    {(item || []).map((album, idx) => (
                      <View
                        key={album?.id ?? `trending-album-${idx}`}
                        style={{marginBottom: idx === 0 ? 12 : 0}}>
                        <EachAlbumCard
                          image={
                            album.image?.[2]?.url ||
                            album.image?.[2]?.link ||
                            album.image?.[0]?.url ||
                            ''
                          }
                          artists={album.artists}
                          name={album.name}
                          id={album.id}
                        />
                      </View>
                    ))}
                  </View>
                )}
              />
            ) : (
              <ShimmerHorizontalList itemCount={6} />
            )}

            {/* Latest Artists (language-specific) + Recommended Playlists remain here */}
            {currentLanguage !== 'All' &&
              (LoadingSecondary || languageTopArtists.length === 0 ? (
                <>
                  <PaddingConatiner>
                    <Heading text={'Latest Artists'} />
                  </PaddingConatiner>
                  <ShimmerArtistChips itemCount={8} />
                </>
              ) : (
                <>
                  <PaddingConatiner>
                    <Heading text={'Latest Artists'} />
                  </PaddingConatiner>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={languageTopArtistColumns}
                    keyExtractor={(item, index) => `lang-artist-col-${index}`}
                    contentContainerStyle={{paddingHorizontal: 6}}
                    renderItem={({item}) => (
                      <View style={{marginRight: 8, alignItems: 'center'}}>
                        {(item || []).map((artist, idx) => (
                          <View
                            key={artist?.id ?? `lang-artist-${idx}`}
                            style={{marginBottom: idx === 0 ? 6 : 0}}>
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
                </>
              ))}

            <PaddingConatiner>
              <Heading text={'Recommended Playlists'} />
            </PaddingConatiner>
            {playlistColumns && playlistColumns.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={playlistColumns}
                keyExtractor={(item, index) => `playlist-col-${index}`}
                contentContainerStyle={{paddingHorizontal: 10}}
                renderItem={({item}) => (
                  <View style={{marginRight: 12}}>
                    {(item || []).map((pl, idx) => (
                      <View
                        key={pl?.id ?? `playlist-${idx}`}
                        style={{marginBottom: idx === 0 ? 12 : 0}}>
                        <EachPlaylistCard
                          name={pl.title}
                          follower={pl.subtitle}
                          image={
                            pl.image?.[2]?.url ||
                            pl.image?.[2]?.link ||
                            pl.image?.[0]?.url ||
                            ''
                          }
                          id={pl.id}
                        />
                      </View>
                    ))}
                  </View>
                )}
              />
            ) : (
              <ShimmerHorizontalList itemCount={6} />
            )}

            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(1)} />
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={'Top Charts'} />
            </PaddingConatiner>
            {enhancedCharts && enhancedCharts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingLeft: 10,
                }}>
                <RenderTopCharts playlist={enhancedCharts} />
              </ScrollView>
            ) : (
              <ShimmerHorizontalList itemCount={6} />
            )}
            {LoadingSecondary ? (
              <>
                <PaddingConatiner>
                  <Spacer />
                  <Spacer />
                  <Heading text="Viral Hits" nospace={true} />
                  <Spacer />
                </PaddingConatiner>
                <ShimmerHorizontalSongList />
              </>
            ) : viralHitsId ? (
                <PaddingConatiner>
                  <HorizontalScrollSongs id={viralHitsId} />
                </PaddingConatiner>
            ) : (
              <>
                <PaddingConatiner>
                  <Spacer />
                  <Spacer />
                  <Heading text="Viral Hits" nospace={true} />
                  <Spacer />
                </PaddingConatiner>
                <ShimmerHorizontalSongList />
              </>
            )}
            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(3)} />
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={'Recommended Albums'} />
            </PaddingConatiner>
            {albumData && albumData.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={albumData}
                keyExtractor={(e, i) => `album-row-${i}`}
                contentContainerStyle={{paddingHorizontal: 10}}
                renderItem={({item: e, index: i}) => (
                  <View
                    style={{
                      gap: 15,
                      marginRight: 12,
                    }}>
                    {e.map((item, index) => (
                      <View key={item?.id ?? `album-col-${i}-${index}`}>
                        <EachAlbumCard
                          image={
                            item?.image[2]?.url || item?.image[2]?.link || ''
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
            ) : (
              <ShimmerHorizontalList itemCount={6} />
            )}
            <PaddingConatiner>
              <HorizontalScrollSongs id={getChartId(2)} />
            </PaddingConatiner>
            {LoadingSecondary ? (
              <>
                <PaddingConatiner>
                  <Spacer />
                  <Spacer />
                  <Heading text={`Trending ${currentLanguage !== 'All' ? currentLanguage + ' ' : ''}Songs`} nospace={true} />
                  <Spacer />
                </PaddingConatiner>
                <ShimmerHorizontalSongList />
              </>
            ) : trendingLangId ? (
                <PaddingConatiner>
                  <HorizontalScrollSongs id={trendingLangId} />
                </PaddingConatiner>
            ) : (
              <>
                <PaddingConatiner>
                  <Spacer />
                  <Spacer />
                  <Heading text={`Trending ${currentLanguage !== 'All' ? currentLanguage + ' ' : ''}Songs`} nospace={true} />
                  <Spacer />
                </PaddingConatiner>
                <ShimmerHorizontalSongList />
              </>
            )}
            {LoadingSecondary || isCricketFeverLoading ? (
              <>
                <PaddingConatiner>
                  <Heading text={'Cricket Fever'} />
                </PaddingConatiner>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={[0, 1, 2, 3]}
                  keyExtractor={item => `cricket-fever-shimmer-${item}`}
                  contentContainerStyle={{paddingHorizontal: 10}}
                  renderItem={() => (
                    <View
                      style={{
                        gap: 15,
                        marginRight: 12,
                      }}>
                      <ShimmerAlbumCard />
                      <ShimmerAlbumCard />
                    </View>
                  )}
                />
              </>
            ) : cricketFeverColumns.length > 0 ? (
                <>
                  <PaddingConatiner>
                    <Heading text={'Cricket Fever'} />
                  </PaddingConatiner>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={cricketFeverColumns}
                    keyExtractor={(item, index) => `cricket-fever-row-${index}`}
                    contentContainerStyle={{paddingHorizontal: 10}}
                    renderItem={({item, index}) => (
                      <View
                        style={{
                          gap: 15,
                          marginRight: 12,
                        }}>
                        {item.map((playlist, playlistIndex) => (
                          <View
                            key={playlist?.id ?? `cricket-fever-${index}-${playlistIndex}`}>
                            <EachPlaylistCard
                              name={playlist.title}
                              follower={playlist.subtitle}
                              image={
                                playlist.image?.[2]?.url ||
                                playlist.image?.[2]?.link ||
                                playlist.image?.[0]?.url ||
                                ''
                              }
                              id={playlist.id}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  />
                </>
            ) : (
              <>
                <PaddingConatiner>
                  <Heading text={'Cricket Fever'} />
                </PaddingConatiner>
                <ShimmerHorizontalList itemCount={4} />
              </>
            )}
              </>
            )}
          </ScrollView>
        </ErrorBoundary>
        <TopHeader showHeader={showHeader} />
      </Animated.View>
    </MainWrapper>
  );
};
