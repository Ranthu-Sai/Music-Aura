import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {useNavigation, useRoute, useTheme} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';

import {MainWrapper} from '../../Layout/MainWrapper';
import {Heading} from '../../Component/Global/Heading';
import {EachSongCard} from '../../Component/Global/EachSongCard';
import {EachArtistCard} from '../../Component/Global/EachArtistCard';
import YouTubeMusicService from '../../Utils/YouTubeMusicService';
import {AddPlaylist} from '../../MusicPlayerFunctions';

const formatYear = year => {
  if (!year) {
    return '';
  }

  if (typeof year === 'number' && Number.isFinite(year)) {
    return String(year);
  }

  const text = String(year).trim();
  return /^\d{4}$/.test(text) ? text : '';
};

const getThumbnailUrl = item => {
  if (!item) {
    return '';
  }

  const thumbnails = item.thumbnails || item.thumbnail || item.image;

  if (typeof thumbnails === 'string') {
    return thumbnails;
  }

  if (Array.isArray(thumbnails)) {
    for (let index = thumbnails.length - 1; index >= 0; index -= 1) {
      const thumb = thumbnails[index];
      if (typeof thumb === 'string') {
        return thumb;
      }
      if (thumb?.url) {
        return thumb.url;
      }
      if (thumb?.link) {
        return thumb.link;
      }
    }
  }

  if (thumbnails?.url) {
    return thumbnails.url;
  }

  if (thumbnails?.link) {
    return thumbnails.link;
  }

  return '';
};

const isSongSection = section => {
  const title = (section?.title || '').toLowerCase();
  const firstItem = section?.items?.[0];

  return (
    section?.type === 'songs' ||
    title.includes('song') ||
    (!!firstItem?.videoId && !title.includes('video') && !title.includes('live')) ||
    !!firstItem?.musicVideoType
  );
};

const isVideoSection = section => {
  const title = (section?.title || '').toLowerCase();
  const type = (section?.type || '').toLowerCase();

  return (
    type === 'videos' ||
    type === 'video' ||
    type === 'live' ||
    title.includes('video') ||
    title.includes('live')
  );
};

const isArtistSection = section => {
  const title = (section?.title || '').toLowerCase();

  return (
    section?.type === 'artists' ||
    title.includes('artist') ||
    section?.items?.every(
      item => item?.type === 'artist' || item?.browseId?.startsWith('UC'),
    )
  );
};

const isAlbumSection = section => {
  const title = (section?.title || '').toLowerCase();

  return (
    section?.type === 'albums' ||
    title.includes('album') ||
    section?.items?.some(
      item =>
        item?.browseId?.startsWith('MPRE') ||
        item?.browseId?.startsWith('OLAK'),
    )
  );
};

const SectionGridCard = ({item}) => {
  const thumbnail = getThumbnailUrl(item);
  const title = item?.title || item?.name || 'Unknown Item';
  const subtitle =
    item?.subtitle ||
    item?.author ||
    item?.artists?.map(artistItem => artistItem?.name).filter(Boolean).join(', ') ||
    formatYear(item?.year);

  return (
    <View style={styles.gridCard}>
      {thumbnail ? (
        <FastImage
          source={{uri: thumbnail}}
          style={styles.gridImage}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={[styles.gridImage, {backgroundColor: '#2a2a2a'}]} />
      )}
      <Text style={styles.gridTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.gridSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const VideoSectionCard = ({item, onPress}) => {
  const thumbnail = getThumbnailUrl(item);
  const title = item?.title || item?.name || 'Unknown Video';
  const subtitle =
    item?.subtitle ||
    item?.author ||
    item?.artists?.map(artistItem => artistItem?.name).filter(Boolean).join(', ') ||
    '';

  return (
    <Pressable style={styles.videoCard} onPress={onPress}>
      {thumbnail ? (
        <FastImage
          source={{uri: thumbnail}}
          style={styles.videoImage}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={[styles.videoImage, {backgroundColor: '#2a2a2a'}]} />
      )}
      <Text style={styles.videoTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.videoSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
};

export const ArtistPage = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const {colors} = useTheme();
  const routeParams = route.params || {};
  const artistId =
    routeParams.artistId || routeParams.browseId || routeParams.id;
  const artistName = routeParams.artistName || routeParams.name || 'Artist';
  const artistImage = routeParams.artistImage || routeParams.image;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [artistData, setArtistData] = useState(null);

  const loadArtist = useCallback(async () => {
    if (!artistId) {
      setArtistData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await YouTubeMusicService.getArtist(artistId);
      setArtistData(data || null);
    } catch (error) {
      console.error('Failed to load YTMusic artist page:', error);
      setArtistData(null);
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    loadArtist();
  }, [loadArtist]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadArtist();
    setRefreshing(false);
  }, [loadArtist]);

  const sections = useMemo(() => {
    const parsedSections = Array.isArray(artistData?.sections)
      ? artistData.sections
      : [];

    if (parsedSections.length > 0) {
      return parsedSections.filter(
        section => Array.isArray(section.items) && section.items.length > 0,
      );
    }

    const fallbackSections = [];

    if (Array.isArray(artistData?.songs) && artistData.songs.length > 0) {
      fallbackSections.push({title: 'Top Songs', type: 'songs', items: artistData.songs});
    }

    if (Array.isArray(artistData?.albums) && artistData.albums.length > 0) {
      fallbackSections.push({title: 'Albums', type: 'albums', items: artistData.albums});
    }

    if (
      Array.isArray(artistData?.relatedArtists) &&
      artistData.relatedArtists.length > 0
    ) {
      fallbackSections.push({
        title: 'Related Artists',
        type: 'artists',
        items: artistData.relatedArtists,
      });
    }

    return fallbackSections;
  }, [artistData]);

  const displayName =
    artistData?.artist?.title || artistData?.name || artistName || 'Unknown Artist';
  const displayImage =
    artistData?.artist?.thumbnail || artistData?.thumbnails?.[0]?.url || artistImage || '';
  const description = artistData?.description || '';
  const artistYear = formatYear(artistData?.year);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  if (!artistId) {
    return (
      <MainWrapper>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, {color: colors.text}]}>Missing artist information</Text>
          <Button mode="contained" onPress={goBack} style={{marginTop: 16}}>
            Go Back
          </Button>
        </View>
      </MainWrapper>
    );
  }

  if (loading) {
    return (
      <MainWrapper>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </MainWrapper>
    );
  }

  return (
    <MainWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.contentContainer}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />

        <View style={styles.heroContainer}>
          {displayImage ? (
            <FastImage
              source={{uri: displayImage}}
              style={styles.heroImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.heroImage, {backgroundColor: colors.card}]} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.65)', colors.background]}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <Text style={[styles.artistName, {color: colors.text}]} numberOfLines={2}>
              {displayName}
            </Text>
            {artistYear ? (
              <Text style={[styles.artistYear, {color: colors.text}]}>Year: {artistYear}</Text>
            ) : null}
            {description ? (
              <Text
                style={[styles.artistDescription, {color: colors.text}]}
                numberOfLines={4}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>

        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, {color: colors.text}]}>No artist sections available</Text>
          </View>
        ) : null}

        {sections.map((section, index) => {
          const title = section?.title || 'Section';
          const items = Array.isArray(section?.items) ? section.items : [];

          if (!items.length) {
            return null;
          }

          if (isVideoSection(section)) {
            return (
              <View key={`${title}-${index}`} style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Heading text={title} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.videoList}>
                  {items.map((item, itemIndex) => {
                    const videoId = item?.videoId || item?.id;

                    return (
                      <VideoSectionCard
                        key={`${videoId || itemIndex}`}
                        item={item}
                        onPress={async () => {
                          if (!videoId) {
                            return;
                          }
                          await AddPlaylist([
                            {
                              id: videoId,
                              title: item?.title || item?.name || 'Unknown Video',
                              artist:
                                item?.author ||
                                item?.subtitle ||
                                item?.artists
                                  ?.map(artistItem => artistItem?.name)
                                  .filter(Boolean)
                                  .join(', ') ||
                                'Unknown Artist',
                              artwork: getThumbnailUrl(item),
                              url: videoId,
                              source: 'ytmusic',
                              duration: item?.duration || 0,
                            },
                          ]);
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            );
          }

          if (isSongSection(section)) {
            return (
              <View key={`${title}-${index}`} style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Heading text={title} />
                </View>
                <View style={styles.songList}>
                  {items.slice(0, 10).map((song, songIndex) => {
                    const songId = song?.videoId || song?.id;

                    if (!songId) {
                      return null;
                    }

                    return (
                      <EachSongCard
                        key={`${songId}-${songIndex}`}
                        title={song?.title || song?.name || 'Unknown Title'}
                        artist={
                          song?.artist ||
                          song?.artists
                            ?.map(artistItem => artistItem?.name)
                            .filter(Boolean)
                            .join(', ') ||
                          ''
                        }
                        image={getThumbnailUrl(song)}
                        id={songId}
                        url={songId}
                        duration={song?.duration}
                        source="ytmusic"
                        Data={{data: {songs: items}}}
                        index={songIndex}
                        isFromPlaylist={true}
                      />
                    );
                  })}
                </View>
              </View>
            );
          }

          if (isArtistSection(section)) {
            return (
              <View key={`${title}-${index}`} style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Heading text={title} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}>
                  {items.map((item, itemIndex) => (
                    <EachArtistCard
                      key={`${item?.browseId || item?.id || itemIndex}`}
                      name={item?.title || item?.name || 'Unknown Artist'}
                      subtitle={item?.subtitle || ''}
                      image={getThumbnailUrl(item)}
                      id={item?.browseId || item?.id}
                      browseId={item?.browseId}
                      source="ytmusic"
                      width={150}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          }

          if (isAlbumSection(section)) {
            return (
              <View key={`${title}-${index}`} style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Heading text={title} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}>
                  {items.map((item, itemIndex) => (
                    <View key={`${item?.browseId || item?.id || itemIndex}`} style={styles.gridCardWrap}>
                      <SectionGridCard item={item} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            );
          }

          return (
            <View key={`${title}-${index}`} style={styles.section}>
              <View style={styles.sectionHeading}>
                <Heading text={title} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}>
                {items.map((item, itemIndex) => {
                  const contentId = item?.playlistId || item?.browseId || item?.id;

                  if (item?.type === 'artist' || item?.browseId?.startsWith('UC')) {
                    return (
                      <EachArtistCard
                        key={`${contentId || itemIndex}`}
                        name={item?.title || item?.name || 'Unknown Artist'}
                        subtitle={item?.subtitle || ''}
                        image={getThumbnailUrl(item)}
                        id={contentId}
                        browseId={item?.browseId}
                        source="ytmusic"
                        width={150}
                      />
                    );
                  }

                  return (
                    <View key={`${contentId || itemIndex}`} style={styles.gridCardWrap}>
                      <SectionGridCard item={item} />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 120,
  },
  loadingState: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  heroContainer: {
    height: 340,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  artistName: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  artistDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.82,
  },
  artistYear: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  section: {
    marginTop: 14,
  },
  sectionHeading: {
    paddingLeft: 12,
    paddingRight: 8,
  },
  songList: {
    marginTop: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  horizontalList: {
    paddingLeft: 10,
    paddingRight: 8,
    gap: 8,
  },
  videoList: {
    paddingLeft: 10,
    paddingRight: 8,
    gap: 10,
  },
  videoCard: {
    width: 250,
    marginRight: 2,
  },
  videoImage: {
    width: 250,
    height: 140,
    borderRadius: 10,
  },
  videoTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  videoSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
  },
  gridCardWrap: {
    marginRight: 8,
  },
  gridCard: {
    width: 180,
  },
  gridImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gridTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  gridSubtitle: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
  },
});
