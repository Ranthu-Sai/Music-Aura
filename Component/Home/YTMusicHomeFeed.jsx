import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Dimensions, FlatList, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {Heading} from '../Global/Heading';
import {EachPlaylistCard} from '../Global/EachPlaylistCard';
import {EachAlbumCard} from '../Global/EachAlbumCard';
import {EachSongCard} from '../Global/EachSongCard';
import {EachArtistCard} from '../Global/EachArtistCard';
import YouTubeMusicService from '../../Utils/YouTubeMusicService';
import ytAuthService from '../../Utils/YouTubeAuthService';
import {
  ShimmerEffect,
  ShimmerArtistChips,
  ShimmerHorizontalList,
  ShimmerHorizontalSongList,
  ShimmerTopCharts,
  ShimmerTrendingSongsList,
} from '../Global/ShimmerEffect';
import localRecommendationService from '../../Utils/LocalRecommendationService';
import {CacheManager} from '../../Utils/NavigationCacheManager';
import {CACHE_TTL, CACHE_KEYS, generateCacheKey} from '../../Utils/CacheConfig';
import InnertubeClient from '../../Api/InnertubeClient';

const INITIAL_SECTIONS = 3;
const SECTIONS_PER_LOAD = 2;
const {width: SCREEN_WIDTH} = Dimensions.get('window');

const VIDEO_SECTION_TITLES = [
  'shorts',
  'true crime',
  'religion',
  'motivation',
  'comedy',
  'gaming',
  'sports',
  'news',
  'education',
  'science & technology',
  'travel & events',
  'autos & vehicles',
  'pets & animals',
  'howto & style',
  'people & blogs',
  'entertainment',
  'film & animation',
  'nonprofits & activism',
];

const isVideoSection = section => {
  const title = (section?.title || '').toLowerCase().trim();
  if (VIDEO_SECTION_TITLES.some(videoTitle => title.includes(videoTitle))) {
    return true;
  }

  return false;
};

const shuffleArray = array => {
  if (!Array.isArray(array)) {
    return [];
  }

  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const getBestThumbnail = (thumbnails, videoId = null) => {
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  if (!thumbnails) {
    return null;
  }

  if (Array.isArray(thumbnails)) {
    const sorted = [...thumbnails].sort((a, b) => (b?.width || 0) - (a?.width || 0));
    return sorted[0]?.url || thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || null;
  }

  if (typeof thumbnails === 'string') {
    return thumbnails;
  }

  return thumbnails?.url || null;
};

const dedupeItems = items => {
  const seen = new Set();
  return (items || []).filter(item => {
    const key = item?.videoId || item?.playlistId || item?.browseId || item?.id;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildFallbackSectionsFromSeeds = async seedSongs => {
  if (!Array.isArray(seedSongs) || seedSongs.length === 0) {
    return [];
  }

  const gathered = [];
  const seeds = seedSongs.filter(song => song?.videoId).slice(0, 3);

  for (const seed of seeds) {
    try {
      const nextResult = await YouTubeMusicService.getNext(seed.videoId);
      if (Array.isArray(nextResult?.items)) {
        gathered.push(...nextResult.items);
      }
    } catch (e) {
    }
  }

  const uniqueItems = dedupeItems(gathered);
  if (uniqueItems.length === 0) {
    return [];
  }

  const playlists = uniqueItems.filter(
    item =>
      item?.playlistId ||
      (item?.browseId &&
        (item.browseId.startsWith('VL') ||
          item.browseId.startsWith('PL') ||
          item.browseId.startsWith('RDCLAK'))),
  );

  const albums = uniqueItems.filter(
    item =>
      item?.browseId &&
      (item.browseId.startsWith('MPRE') || item.browseId.startsWith('OLAK')),
  );

  const artists = uniqueItems.filter(
    item => item?.browseId && item.browseId.startsWith('UC'),
  );

  const songs = uniqueItems.filter(
    item => item?.videoId && !item?.playlistId && !item?.browseId?.startsWith('MPRE'),
  );

  const fallbackSections = [];

  if (playlists.length >= 5) {
    fallbackSections.push({
      title: 'Recommended Playlists',
      type: 'mixed',
      items: playlists.slice(0, 15),
      songs: [],
      playlists: playlists.slice(0, 15),
      albums: [],
      artists: [],
    });
  }

  if (albums.length >= 5) {
    fallbackSections.push({
      title: 'Albums For You',
      type: 'mixed',
      items: albums.slice(0, 15),
      songs: [],
      playlists: [],
      albums: albums.slice(0, 15),
      artists: [],
    });
  }

  if (artists.length >= 5) {
    fallbackSections.push({
      title: 'Artists To Explore',
      type: 'artist',
      items: artists.slice(0, 12),
      songs: [],
      playlists: [],
      albums: [],
      artists: artists.slice(0, 12),
    });
  }

  if (songs.length >= 8) {
    fallbackSections.push({
      title: 'More Like This',
      type: 'songs',
      items: songs.slice(0, 20),
      songs: songs.slice(0, 20),
      playlists: [],
      albums: [],
      artists: [],
    });
  }

  if (songs.length >= 16) {
    fallbackSections.push({
      title: 'Recommended Songs',
      type: 'songs',
      items: songs.slice(8, 28),
      songs: songs.slice(8, 28),
      playlists: [],
      albums: [],
      artists: [],
    });
  }

  if (songs.length >= 24) {
    fallbackSections.push({
      title: 'Up Next Mix',
      type: 'songs',
      items: songs.slice(16, 36),
      songs: songs.slice(16, 36),
      playlists: [],
      albums: [],
      artists: [],
    });
  }

  return fallbackSections;
};

const normalizeLanguage = value => String(value || '').toLowerCase().trim();

const QuickPicksSection = ({title, songs, activeLanguage, onSongPress}) => {
  if (!songs || songs.length === 0) {
    return null;
  }

  const selectedLanguage = normalizeLanguage(activeLanguage);
  const visibleSongs = selectedLanguage
    ? songs.filter(song => normalizeLanguage(song?.language) === selectedLanguage)
    : songs;

  if (visibleSongs.length === 0) {
    return null;
  }

  const songsPerColumn = 4;
  const columns = [];
  for (let index = 0; index < visibleSongs.length; index += songsPerColumn) {
    columns.push(visibleSongs.slice(index, index + songsPerColumn));
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headingContainer}>
        <Heading text={title} />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickPicksContainer}
        data={columns}
        keyExtractor={(_, index) => `quick-picks-col-${index}`}
        renderItem={({item: columnSongs}) => (
          <View style={styles.quickPicksColumn}>
            {columnSongs.map((song, index) => (
              <EachSongCard
                key={`${song?.videoId || song?.id}-${index}`}
                title={song?.title || song?.name}
                artist={song?.artist || song?.artists?.[0]?.name || song?.subtitle || ''}
                image={getBestThumbnail(song?.thumbnails, song?.videoId)}
                id={song?.videoId || song?.id}
                duration={song?.duration}
                language={song?.language}
                source="ytmusic"
                width={SCREEN_WIDTH * 0.85}
                titleandartistwidth={SCREEN_WIDTH * 0.55}
                onPress={() => onSongPress?.(song)}
              />
            ))}
          </View>
        )}
      />
    </View>
  );
};

const ContentSection = ({title, items, type}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headingContainer}>
        <Heading text={title} />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        data={items.slice(0, 15)}
        keyExtractor={(item, index) => `${type}-${item?.id || item?.browseId || item?.playlistId || index}`}
        renderItem={({item}) => {
          const thumbnail = getBestThumbnail(item?.thumbnails || item?.thumbnail, item?.videoId);
          const itemTitle = item?.title || item?.name || '';
          const subtitle = item?.subtitle || item?.author || item?.year || '';
          const browseId = item?.browseId || item?.id;
          const isAlbum = browseId && (browseId.startsWith('MPRE') || browseId.startsWith('OLAK'));

          // Get artists array for EachAlbumCard rendering
          let artistsArray = item?.artists;
          if (!artistsArray && subtitle) {
            artistsArray = [{name: subtitle}];
          }

          if (item?.videoId) {
            return (
              <EachSongCard
                title={itemTitle}
                artist={subtitle}
                image={thumbnail}
                id={item?.videoId || item?.id}
                url={item?.videoId || item?.id}
                source="ytmusic"
                item={item}
              />
            );
          }

          if (type === 'album' || isAlbum) {
            return (
              <EachAlbumCard
                image={thumbnail}
                name={itemTitle}
                artists={artistsArray}
                id={browseId}
                source="YTMusic"
                mainContainerStyle={{marginHorizontal: 4}}
              />
            );
          }

          return (
            <EachPlaylistCard
              image={thumbnail}
              name={itemTitle}
              follower={subtitle}
              id={item?.playlistId || browseId}
              source="YTMusic"
              MainContainerStyle={{marginHorizontal: 4}}
            />
          );
        }}
      />
    </View>
  );
};

const ArtistSection = ({title, items}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headingContainer}>
        <Heading text={title} />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        data={items.slice(0, 12)}
        keyExtractor={(item, index) => `artist-${item?.browseId || item?.id || index}`}
        renderItem={({item}) => (
          <EachPlaylistCard
            image={getBestThumbnail(item?.thumbnails || item?.thumbnail)}
            name={item?.title || item?.name || ''}
            follower={item?.subtitle || ''}
            id={item?.browseId || item?.id}
            source="ytmusic"
            isArtist={true}
            MainContainerStyle={{marginHorizontal: 4}}
          />
        )}
      />
    </View>
  );
};

const TopArtistsSection = ({title, items}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headingContainer}>
        <Heading text={title} />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        data={items.slice(0, 12)}
        keyExtractor={(item, index) => `top-artist-${item?.browseId || item?.id || index}`}
        renderItem={({item}) => (
          <EachArtistCard
            image={getBestThumbnail(item?.thumbnails || item?.thumbnail)}
            name={item?.title || item?.name || ''}
            browseId={item?.browseId || item?.id}
            id={item?.id}
            width={140}
            source="ytmusic"
            ringEffect={true}
          />
        )}
      />
    </View>
  );
};

const LoadMorePlaceholder = () => (
  <View style={styles.loadMoreContainer}>
    <View style={styles.loadMoreBarRow}>
      <ShimmerEffect width={140} height={20} borderRadius={6} />
    </View>
    <View style={styles.loadMoreBarRow}>
      <ShimmerEffect width={220} height={90} borderRadius={10} />
      <ShimmerEffect width={220} height={90} borderRadius={10} />
    </View>
  </View>
);

const SectionAwareLoadPlaceholder = ({upcomingSections}) => {
  const sectionsToPreview = Array.isArray(upcomingSections)
    ? upcomingSections.slice(0, SECTIONS_PER_LOAD)
    : [];

  if (sectionsToPreview.length === 0) {
    return <LoadMorePlaceholder />;
  }

  return (
    <View style={styles.loadMoreContainer}>
      {sectionsToPreview.map((section, index) => {
        const sectionType = String(section?.type || '').toLowerCase();
        const sectionTitle = String(section?.title || '').toLowerCase();

        return (
          <View key={`load-preview-${section?.title || 'section'}-${index}`}>
            <View style={styles.loadingHeadingBlock}>
              <ShimmerEffect
                width={150 + (index % 2 === 0 ? 40 : 10)}
                height={22}
                borderRadius={6}
              />
            </View>

            {sectionType === 'songs' && sectionTitle.includes('quick picks') ? (
              <ShimmerTrendingSongsList itemCount={4} />
            ) : sectionType === 'songs' ? (
              <ShimmerHorizontalSongList />
            ) : sectionType === 'artist' ? (
              <ShimmerArtistChips itemCount={6} />
            ) : sectionTitle.includes('chart') ? (
              <ShimmerTopCharts itemCount={3} />
            ) : (
              <ShimmerHorizontalList itemCount={3} />
            )}
          </View>
        );
      })}
    </View>
  );
};

const buildOrbitExtraSections = (chartsResult, newReleasesData) => {
  const sections = [];

  if (chartsResult && Array.isArray(chartsResult.charts) && chartsResult.charts.length > 0) {
    sections.push({
      title: 'Top Charts',
      type: 'mixed',
      items: chartsResult.charts.slice(0, 20),
      songs: chartsResult.charts.filter(item => item?.isChart),
      playlists: chartsResult.charts.slice(0, 20),
      albums: [],
      artists: [],
    });
  }

  if (chartsResult && Array.isArray(chartsResult.artists) && chartsResult.artists.length > 0) {
    sections.push({
      title: 'Popular Artists',
      type: 'artist',
      items: chartsResult.artists.slice(0, 12),
      songs: [],
      playlists: [],
      albums: [],
      artists: chartsResult.artists.slice(0, 12),
    });
  }

  if (Array.isArray(newReleasesData) && newReleasesData.length > 0) {
    sections.push({
      title: 'New Albums & Singles',
      type: 'mixed',
      items: newReleasesData.slice(0, 15),
      songs: [],
      playlists: [],
      albums: newReleasesData.slice(0, 15),
      artists: [],
    });
  }

  return sections;
};

const mergeExtraSections = (baseSections, extraSections) => {
  if (!Array.isArray(baseSections)) {
    return extraSections || [];
  }
  if (!Array.isArray(extraSections) || extraSections.length === 0) {
    return baseSections;
  }

  const upsertTitles = new Set(extraSections.map(section => section?.title));
  const baseWithoutUpserts = baseSections.filter(section => !upsertTitles.has(section?.title));
  const merged = [...baseWithoutUpserts, ...extraSections];

  // Keep Top Charts above the fallback song-mix sections when both exist.
  const topChartsIndex = merged.findIndex(section => section?.title === 'Top Charts');
  const moreLikeThisIndex = merged.findIndex(section => section?.title === 'More Like This');

  if (
    topChartsIndex !== -1 &&
    moreLikeThisIndex !== -1 &&
    topChartsIndex > moreLikeThisIndex
  ) {
    const [topChartsSection] = merged.splice(topChartsIndex, 1);
    const insertIndex = merged.findIndex(section => section?.title === 'More Like This');
    merged.splice(insertIndex, 0, topChartsSection);
  }

  // Keep Popular Artists above Recommended Songs when both exist.
  const popularArtistsIndex = merged.findIndex(
    section => section?.title === 'Popular Artists',
  );
  const recommendedSongsIndex = merged.findIndex(
    section => section?.title === 'Recommended Songs',
  );

  if (
    popularArtistsIndex !== -1 &&
    recommendedSongsIndex !== -1 &&
    popularArtistsIndex > recommendedSongsIndex
  ) {
    const [popularArtistsSection] = merged.splice(popularArtistsIndex, 1);
    const insertIndex = merged.findIndex(
      section => section?.title === 'Recommended Songs',
    );
    merged.splice(insertIndex, 0, popularArtistsSection);
  }

  // Keep New Albums & Singles above Up Next Mix when both exist.
  const newAlbumsIndex = merged.findIndex(
    section => section?.title === 'New Albums & Singles',
  );
  const upNextMixIndex = merged.findIndex(
    section => section?.title === 'Up Next Mix',
  );

  if (
    newAlbumsIndex !== -1 &&
    upNextMixIndex !== -1 &&
    newAlbumsIndex > upNextMixIndex
  ) {
    const [newAlbumsSection] = merged.splice(newAlbumsIndex, 1);
    const insertIndex = merged.findIndex(
      section => section?.title === 'Up Next Mix',
    );
    merged.splice(insertIndex, 0, newAlbumsSection);
  }

  return merged;
};

const stripQuickPicksSections = sections => {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.filter(
    section =>
      !String(section?.title || '')
        .toLowerCase()
        .includes('quick picks'),
  );
};

  const extractQuickPicksSection = sections => {
    if (!Array.isArray(sections)) {
      return null;
    }

    return sections.find(section =>
      String(section?.title || '')
        .toLowerCase()
        .includes('quick picks'),
    );
  };

const YTMUSIC_HOME_CACHE_KEY = generateCacheKey(CACHE_KEYS.HOME, 'ytmusic_sections');

const getInitialCachedSections = () => {
  try {
    const cachedSections = CacheManager.get(YTMUSIC_HOME_CACHE_KEY);
    if (!Array.isArray(cachedSections) || cachedSections.length === 0) {
      return [];
    }

    return stripQuickPicksSections(cachedSections);
  } catch (error) {
    return [];
  }
};

export const YTMusicHomeFeed = forwardRef(({refreshing, onRefreshComplete}, ref) => {
  const {colors} = useTheme();
  const initialCachedSections = getInitialCachedSections();
  const [sections, setSections] = useState(initialCachedSections);
  const [loading, setLoading] = useState(initialCachedSections.length === 0);
  const [hasResolvedFeed, setHasResolvedFeed] = useState(initialCachedSections.length > 0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [quickPicksLanguageFilter, setQuickPicksLanguageFilter] = useState('');
  const isMounted = useRef(true);
  const fetchInFlightRef = useRef(false);
  const cachedQuickPicksRef = useRef([]);
  const hydratedFromDiskRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SECTIONS);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchHomeData = useCallback(
    async (forceRefresh = false) => {
      if (fetchInFlightRef.current) {
        return;
      }

      fetchInFlightRef.current = true;
      if (isMounted.current) {
        setHasResolvedFeed(false);
      }
      try {
        const quickPicksPromise = localRecommendationService.getQuickPicks(forceRefresh);
        let extraSectionsPromise = null;
        let shouldApplyOnce = forceRefresh;

        let cachedSections = null;
        if (!forceRefresh) {
          cachedSections = CacheManager.get(YTMUSIC_HOME_CACHE_KEY);
          if (Array.isArray(cachedSections) && cachedSections.length === 0) {
            cachedSections = null;
          }
          if (!cachedSections && typeof CacheManager.getAsync === 'function') {
            cachedSections = await CacheManager.getAsync(YTMUSIC_HOME_CACHE_KEY);
            if (Array.isArray(cachedSections) && cachedSections.length === 0) {
              cachedSections = null;
            }
          }

          if (Array.isArray(cachedSections) && cachedSections.length > 0) {
            cachedSections = stripQuickPicksSections(cachedSections);
          }
        }

        if (forceRefresh) {
          CacheManager.invalidate(YTMUSIC_HOME_CACHE_KEY);
          await localRecommendationService.clearCache();
          if (isMounted.current) {
            setQuickPicksLanguageFilter('');
          }
        }

        let processedSections = cachedSections;
        const needsHomeFetch = forceRefresh || !processedSections;

        if (needsHomeFetch) {
          // Orbit-style fast path: fetch only home sections first for quicker first paint.
          const homeData = await YouTubeMusicService.getHomeFeed(60, forceRefresh).catch(err => {
            console.warn('Failed to fetch home feed:', err);
            return [];
          });

          // Process home feed data if available
          if (Array.isArray(homeData) && homeData.length > 0 && isMounted.current) {
            let filteredData = homeData.filter(section => !isVideoSection(section));
            if (!Array.isArray(filteredData) || filteredData.length === 0) {
              filteredData = homeData;
            }

            processedSections = filteredData
              .map(section => {
                const sectionTitle = section?.title || 'Music';
                const contents = section?.contents || section?.items || [];

                const songs = contents.filter(
                  item => item?.videoId && !item?.playlistId && !item?.browseId?.startsWith('MPRE'),
                );

                const playlists = contents.filter(
                  item => item?.playlistId || (item?.browseId && (item.browseId.startsWith('VL') || item.browseId.startsWith('RDCLAK'))),
                );

                const albums = contents.filter(
                  item => item?.browseId && (item.browseId.startsWith('MPRE') || item.browseId.startsWith('OLAK')),
                );

                const artists = contents.filter(
                  item => item?.browseId && item.browseId.startsWith('UC'),
                );

                let type = 'mixed';
                let items = contents;

                if (
                  songs.length > playlists.length + albums.length + artists.length ||
                  (songs.length > 0 && playlists.length === 0 && albums.length === 0 && artists.length === 0)
                ) {
                  type = 'songs';
                  items = songs;
                } else if (artists.length > songs.length + playlists.length + albums.length) {
                  type = 'artist';
                  items = artists;
                } else {
                  type = 'mixed';
                  items = contents;
                }

                return {
                  title: sectionTitle,
                  type,
                  items,
                  songs,
                  playlists,
                  albums,
                  artists,
                };
              })
              .filter(
                section =>
                  (Array.isArray(section.items) && section.items.length > 0) ||
                  (Array.isArray(section.songs) && section.songs.length > 0) ||
                  (Array.isArray(section.artists) && section.artists.length > 0),
              )
              .filter(
                section =>
                  !section.title.toLowerCase().includes('start radio') &&
                  !section.title.toLowerCase().includes('shorts') &&
                  !section.title.toLowerCase().includes('quick picks'),
              );

            if (forceRefresh) {
              processedSections = shuffleArray(processedSections).map(section => ({
                ...section,
                items: shuffleArray(section.items),
                songs: section.songs ? shuffleArray(section.songs) : [],
                playlists: section.playlists ? shuffleArray(section.playlists) : [],
                albums: section.albums ? shuffleArray(section.albums) : [],
                artists: section.artists ? shuffleArray(section.artists) : [],
              }));
            }

            if (processedSections && processedSections.length > 0) {
              CacheManager.set(YTMUSIC_HOME_CACHE_KEY, processedSections, CACHE_TTL.HOME_DATA);
            } else {
              CacheManager.invalidate(YTMUSIC_HOME_CACHE_KEY);
            }
          }
        }

        const missingOrbitSections = !Array.isArray(processedSections) || [
          'Top Charts',
          'Popular Artists',
          'New Albums & Singles',
        ].some(title => !processedSections.some(section => section?.title === title));

        if (missingOrbitSections || forceRefresh) {
          extraSectionsPromise = Promise.all([
            InnertubeClient.getCharts().catch(err => {
              console.warn('Failed to fetch charts:', err);
              return {charts: [], artists: []};
            }),
            InnertubeClient.getNewReleases(15).catch(err => {
              console.warn('Failed to fetch new releases:', err);
              return [];
            }),
          ]);
        }

        const localQuickPicks = await quickPicksPromise.catch(error => {
          console.error('[YTMusicHomeFeed] Quick Picks error:', error);
          return [];
        });

        const resolvedQuickPicks =
          Array.isArray(localQuickPicks) && localQuickPicks.length > 0
            ? localQuickPicks
            : cachedQuickPicksRef.current;

        if (processedSections && isMounted.current) {
          let finalSections = [...stripQuickPicksSections(processedSections)];

          if (finalSections.length < 2 && resolvedQuickPicks?.length > 0) {
            const fallbackSections = await buildFallbackSectionsFromSeeds(resolvedQuickPicks);
            if (fallbackSections.length > 0) {
              finalSections = [...finalSections, ...fallbackSections];
            }
          }

          if (resolvedQuickPicks && resolvedQuickPicks.length > 0) {
            finalSections.unshift({
              title: 'Quick Picks',
              type: 'songs',
              songs: resolvedQuickPicks,
              items: resolvedQuickPicks,
            });
          }

          if (!shouldApplyOnce) {
            setSections(finalSections);
          } else {
            processedSections = finalSections;
          }
        } else if (isMounted.current) {
          if (!shouldApplyOnce) {
            setSections([]);
          }
        }

        if (extraSectionsPromise && isMounted.current) {
          const [chartsResult, newReleasesData] = await extraSectionsPromise;
          const extraSections = buildOrbitExtraSections(chartsResult, newReleasesData);

          if (extraSections.length > 0) {
            if (shouldApplyOnce) {
              const currentSections = Array.isArray(processedSections)
                ? processedSections
                : [];
              const quickPicksSection = extractQuickPicksSection(currentSections);
              const merged = mergeExtraSections(
                stripQuickPicksSections(currentSections),
                extraSections,
              );
              const nextSections = quickPicksSection
                ? [quickPicksSection, ...merged]
                : merged;
              // Persist only non-Quick Picks sections; Quick Picks are injected per session.
              CacheManager.set(YTMUSIC_HOME_CACHE_KEY, stripQuickPicksSections(nextSections), CACHE_TTL.HOME_DATA);
              processedSections = nextSections;
            } else {
              setSections(prev => {
                const currentSections = Array.isArray(prev) ? prev : [];
                const quickPicksSection = extractQuickPicksSection(currentSections);
                const merged = mergeExtraSections(
                  stripQuickPicksSections(currentSections),
                  extraSections,
                );
                const nextSections = quickPicksSection
                  ? [quickPicksSection, ...merged]
                  : merged;
                // Persist only non-Quick Picks sections; Quick Picks are injected per session.
                CacheManager.set(YTMUSIC_HOME_CACHE_KEY, stripQuickPicksSections(nextSections), CACHE_TTL.HOME_DATA);
                return nextSections;
              });
            }
          }
        }

        if (shouldApplyOnce && isMounted.current) {
          const nextSections = Array.isArray(processedSections) ? processedSections : [];
          CacheManager.set(YTMUSIC_HOME_CACHE_KEY, stripQuickPicksSections(nextSections), CACHE_TTL.HOME_DATA);
          setSections(nextSections);
        }
      } catch (error) {
        console.error('[YTMusicHomeFeed] Fetch error:', error);
        if (isMounted.current) {
          if (!forceRefresh) {
            setSections([]);
          }
        }
      } finally {
        fetchInFlightRef.current = false;
        if (isMounted.current) {
          setHasResolvedFeed(true);
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    isMounted.current = true;

    const updateAuthState = () => {
      setIsLoggedIn(ytAuthService.isAuth());
    };

    const hydrateFromDisk = async () => {
      if (hydratedFromDiskRef.current) {
        return;
      }

      hydratedFromDiskRef.current = true;

      const [diskSections, diskQuickPicks] = await Promise.all([
        typeof CacheManager.getAsync === 'function'
          ? CacheManager.getAsync(YTMUSIC_HOME_CACHE_KEY)
          : Promise.resolve(CacheManager.get(YTMUSIC_HOME_CACHE_KEY)),
        localRecommendationService.getCachedQuickPicks(),
      ]);

      if (!isMounted.current) {
        return;
      }

      const cachedSections = Array.isArray(diskSections)
        ? stripQuickPicksSections(diskSections)
        : [];
      const cachedQuickPicks = Array.isArray(diskQuickPicks) ? diskQuickPicks : [];

      if (cachedQuickPicks.length > 0) {
        cachedQuickPicksRef.current = cachedQuickPicks;
      }

      if (cachedSections.length > 0 || cachedQuickPicks.length > 0) {
        const nextSections = [...cachedSections];

        if (
          cachedQuickPicks.length > 0 &&
          !nextSections.some(section => String(section?.title || '').toLowerCase().includes('quick picks'))
        ) {
          nextSections.unshift({
            title: 'Quick Picks',
            type: 'songs',
            songs: cachedQuickPicks,
            items: cachedQuickPicks,
          });
        }

        setSections(prev => (prev.length > 0 ? prev : nextSections));
        setLoading(false);
        setHasResolvedFeed(true);
      }
    };

    const hydrateCachedQuickPicks = async () => {
      const cachedQuickPicks = await localRecommendationService.getCachedQuickPicks();
      if (!isMounted.current || !Array.isArray(cachedQuickPicks) || cachedQuickPicks.length === 0) {
        return;
      }

      cachedQuickPicksRef.current = cachedQuickPicks;
      setSections(prev => {
        if (
          Array.isArray(prev) &&
          prev.some(section => String(section?.title || '').toLowerCase().includes('quick picks'))
        ) {
          return prev;
        }

        return [
          {
            title: 'Quick Picks',
            type: 'songs',
            songs: cachedQuickPicks,
            items: cachedQuickPicks,
          },
          ...(Array.isArray(prev) ? prev : []),
        ];
      });
    };

    updateAuthState();
    ytAuthService.addListener(updateAuthState);
    hydrateFromDisk();
    hydrateCachedQuickPicks();
    fetchHomeData(false);

    return () => {
      isMounted.current = false;
      ytAuthService.removeListener(updateAuthState);
    };
  }, [fetchHomeData]);

  useEffect(() => {
    if (refreshing) {
      const doRefresh = async () => {
        setVisibleCount(INITIAL_SECTIONS);
        if (!fetchInFlightRef.current) {
          await fetchHomeData(true);
        }
        if (onRefreshComplete) {
          onRefreshComplete();
        }
      };
      doRefresh();
    }
  }, [refreshing, fetchHomeData, onRefreshComplete]);

  const visibleSections = sections.slice(0, visibleCount);
  const hasMoreSections = visibleCount < sections.length;
  const upcomingSections = sections.slice(
    visibleCount,
    visibleCount + SECTIONS_PER_LOAD,
  );

  useImperativeHandle(
    ref,
    () => ({
      refresh: async () => {
        setVisibleCount(INITIAL_SECTIONS);
        setIsLoadingMore(false);
        await fetchHomeData(true);
      },
      loadMore: () => {
        if (!hasMoreSections || isLoadingMore) {
          return;
        }

        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleCount(prev =>
            Math.min(prev + SECTIONS_PER_LOAD, sections.length),
          );
          setIsLoadingMore(false);
        }, 260);
      },
    }),
    [fetchHomeData, hasMoreSections, isLoadingMore, sections.length],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingHeadingBlock}>
          <ShimmerEffect width={180} height={28} borderRadius={6} />
        </View>
        <ShimmerTrendingSongsList itemCount={6} />
        <View style={styles.loadingHeadingBlock}>
          <ShimmerEffect width={200} height={28} borderRadius={6} />
        </View>
        <ShimmerHorizontalSongList />

        <View style={styles.loadingHeadingBlock}>
          <ShimmerEffect width={190} height={28} borderRadius={6} />
        </View>
        <ShimmerHorizontalList itemCount={6} />

        <View style={styles.loadingHeadingBlock}>
          <ShimmerEffect width={160} height={28} borderRadius={6} />
        </View>
        <ShimmerArtistChips itemCount={8} />

        <View style={styles.loadingHeadingBlock}>
          <ShimmerEffect width={240} height={28} borderRadius={6} />
        </View>
        <ShimmerHorizontalList itemCount={6} />

        <View style={styles.loadingHeadingBlock}>
          <ShimmerEffect width={200} height={28} borderRadius={6} />
        </View>
        <ShimmerHorizontalSongList />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {visibleSections.map((section, index) => {
        if (section.type === 'songs' && section.songs?.length > 0) {
          return (
            <QuickPicksSection
              key={`section-${index}`}
              title={section.title}
              songs={section.songs}
              activeLanguage={quickPicksLanguageFilter}
              onSongPress={song => {
                const songLanguage = normalizeLanguage(song?.language);
                if (songLanguage) {
                  setQuickPicksLanguageFilter(songLanguage);
                }
              }}
            />
          );
        }

        if (section.type === 'artist' && section.artists?.length > 0) {
          // Use TopArtistsSection for "Popular Artists", ArtistSection for others
          if (section.title === 'Popular Artists') {
            return <TopArtistsSection key={`section-${index}`} title={section.title} items={section.artists} />;
          }
          return <ArtistSection key={`section-${index}`} title={section.title} items={section.artists} />;
        }

        return <ContentSection key={`section-${index}`} title={section.title} items={section.items} type={section.type} />;
      })}

      {hasMoreSections && isLoadingMore ? (
        <SectionAwareLoadPlaceholder upcomingSections={upcomingSections} />
      ) : null}

      {sections.length === 0 && !loading && hasResolvedFeed ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, {color: colors.text}]}>
            No content available from YouTube Music.{!isLoggedIn && '\n\nLog in for personalized recommendations.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  loadingHeadingBlock: {
    paddingHorizontal: 15,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionContainer: {
    marginTop: 12,
  },
  headingContainer: {
    paddingHorizontal: 13,
  },
  listContent: {
    paddingLeft: 10,
    paddingRight: 5,
    gap: 2,
  },
  quickPicksContainer: {
    paddingLeft: 0,
    paddingRight: 10,
  },
  quickPicksColumn: {
    width: SCREEN_WIDTH * 0.85,
    marginRight: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  loadMoreContainer: {
    marginTop: 12,
    paddingHorizontal: 13,
  },
  loadMoreBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
});
