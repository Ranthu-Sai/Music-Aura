/**
 * InnerTubeClient.js
 *
 * Pure JavaScript implementation of YouTube Music InnerTube API.
 * Pure JavaScript implementation for YouTube Music InnerTube API.
 */

import {enhanceYTMusicArtwork} from '../Utils/ArtworkEnhancer';

const INNERTUBE_API_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const INNERTUBE_API_URL = 'https://music.youtube.com/youtubei/v1';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Content-Type': 'application/json',
  Origin: 'https://music.youtube.com',
};

const WEB_REMIX_CONTEXT = {
  context: {
    client: {
      clientName: 'WEB_REMIX',
      clientVersion: '1.20241204.01.00',
      originalUrl: 'https://music.youtube.com',
      hl: 'en',
      gl: 'US',
    },
  },
};

class InnerTubeClient {
  /**
   * Helper to make API requests
   */
  static async request(endpoint, body) {
    try {
      const url = `${INNERTUBE_API_URL}/${endpoint}?key=${INNERTUBE_API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          ...WEB_REMIX_CONTEXT,
          ...body,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`InnerTube request failed for ${endpoint}:`, error);
      return null;
    }
  }

  /**
   * Parse time string (e.g., "3:45", "1:23:45") to seconds
   * Matches OuterTune's parseTime function
   */
  static parseTime(timeString) {
    if (!timeString) {
      return null;
    }

    const parts = timeString.split(':').map(p => parseInt(p, 10));
    if (parts.some(isNaN)) {
      return null;
    }

    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return null;
  }

  /**
   * Get Home Feed
   */
  static async getHome() {
    const data = await this.request('browse', {browseId: 'FEmusic_home'});
    return this.parseHome(data);
  }

  /**
   * Get Search Results
   */
  static async search(query, filter = null) {
    // OuterTune's exact filter params
    let params = null;
    if (filter === 'songs') {
      params = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';
    }
    if (filter === 'videos') {
      params = 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D';
    }
    if (filter === 'albums') {
      params = 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D';
    }
    if (filter === 'artists') {
      params = 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D';
    }
    if (filter === 'playlists') {
      params = 'EgeKAQQoAEABagoQAxAEEAoQCRAF';
    }

    const data = await this.request('search', {query, params});
    return this.parseSearch(data, filter);
  }

  static async getArtist(browseId) {
    const data = await this.request('browse', {browseId});

    return this.parseArtist(data);
  }

  static async getAlbum(browseId) {
    const data = await this.request('browse', {browseId});
    return this.parseAlbum(data);
  }

  static async getPlaylist(browseId) {
    const data = await this.request('browse', {
      browseId: browseId.startsWith('VL') ? browseId : `VL${browseId}`,
    });
    return this.parsePlaylist(data);
  }

  static async getRelated(browseId) {
    const data = await this.request('next', {videoId: browseId});
    return this.parseRelated(data);
  }

  /**
   * Get Next/Recommendations for a video (YouTube Music Radio)
   * This is similar to OuterTune's YouTube.next() function
   */
  static async getNext(videoId, playlistId = null, continuation = null) {
    const body = {
      videoId,
      isAudioOnly: true,
    };

    if (playlistId) {
      body.playlistId = playlistId;
    }

    if (continuation) {
      body.continuation = continuation;
    }

    const data = await this.request('next', body);
    const result = this.parseNext(data);

    // If we got an automix playlist endpoint, fetch the radio playlist
    if (result.automixPlaylistId) {
      const radioResult = await this.getNextWithPlaylist(
        videoId,
        result.automixPlaylistId,
      );
      if (radioResult && radioResult.items && radioResult.items.length > 0) {
        // Combine current items with radio items
        return {
          items: [...result.items, ...radioResult.items],
          continuation: radioResult.continuation,
          title: result.title || radioResult.title,
          automixPlaylistId: null, // Already processed
        };
      }
    }

    return result;
  }

  /**
   * Get Section Items (See All)
   * Supports lazy loading via continuation
   */
  static async getSection(browseId, params = null, continuation = null) {
    if (continuation) {
      const data = await this.request('browse', {continuation});
      return this.parseSection(data);
    }

    const data = await this.request('browse', {browseId, params});
    return this.parseSection(data);
  }

  /**
   * Get Next with a specific playlist ID (for automix/radio)
   */
  static async getNextWithPlaylist(videoId, playlistId) {
    const body = {
      videoId,
      playlistId,
      isAudioOnly: true,
      enablePersistentPlaylistPanel: true,
      tunerSettingValue: 'AUTOMIX_SETTING_NORMAL',
    };

    const data = await this.request('next', body);
    return this.parseNext(data);
  }

  // --- Parsers ---

  static parseHome(data) {
    const sections = [];
    try {
      // Home Feed logic
      const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
      if (!tabs) {
        return [];
      }
      const content =
        tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

      content?.forEach(section => {
        if (section.musicCarouselShelfRenderer) {
          const shelf = section.musicCarouselShelfRenderer;
          const items =
            shelf.contents?.map(item => this.parseItem(item)).filter(i => i) ||
            [];
          if (items.length > 0) {
            sections.push({
              title:
                shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title
                  ?.runs?.[0]?.text || '',
              contents: items, // 'contents' matches YTMusic.js expectations
            });
          }
        }
      });
    } catch (e) {
      console.error('Parse Home Error', e);
    }
    return sections;
  }

  static parseSearch(data, filter) {
    const results = [];
    try {
      // Dump entire response for debugging

      const contents =
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents;
      if (!contents) {

        return [];
      }

      // Extract results from all relevant shelves (musicShelfRenderer, musicCardShelfRenderer)
      for (const section of contents) {
        // Handle musicShelfRenderer (normal list results)
        if (section.musicShelfRenderer) {

          section.musicShelfRenderer.contents?.forEach(item => {
            const parsed = this.parseItem(item);
            if (parsed) {
              results.push(parsed);
            }
          });
        }

        // Handle musicCardShelfRenderer (Top Result)
        if (section.musicCardShelfRenderer) {

          const cardShelf = section.musicCardShelfRenderer;

          // Top result can have sub-items (buttons, links) but we want the main item
          // Construct a pseudo itemWrapper for parseItem
          const parsed = this.parseItem({
            musicResponsiveListItemRenderer: {
              ...cardShelf,
              // Card shelf has different title path
              title: cardShelf.title,
              // Card shelf has different thumbnail path
              thumbnail: cardShelf.thumbnail,
            },
          });
          if (parsed) {
            // Prepend top result
            results.unshift(parsed);
          }
        }

        // Check inside itemSectionRenderer wrapper (sometimes used for no results or specific groupings)
        if (section.itemSectionRenderer?.contents) {

          for (const item of section.itemSectionRenderer.contents) {
            if (item.musicShelfRenderer) {
              item.musicShelfRenderer.contents?.forEach(shelfItem => {
                const parsed = this.parseItem(shelfItem);
                if (parsed) {
                  results.push(parsed);
                }
              });
            }
          }
        }
      }

      // Deduplicate by ID
      const seenIds = new Set();
      const finalResults = results.filter(item => {
        const id = item.videoId || item.browseId || item.id;
        if (!id || seenIds.has(id)) {
          return false;
        }
        seenIds.add(id);
        return true;
      });

      return finalResults;
    } catch (e) {
      console.error('Parse Search Error', e);
    }
    return results;
  }

  /**
   * Parse Artist Page - Full implementation matching OuterTune's ArtistPage
   * Returns: { artist, sections, description }
   */
  static parseArtist(data) {
    try {
      // Get artist header - try multiple possible renderers (OuterTune style)
      const immersiveHeader = data?.header?.musicImmersiveHeaderRenderer;
      const visualHeader = data?.header?.musicVisualHeaderRenderer;
      const detailHeader = data?.header?.musicDetailHeaderRenderer;
      const headerRenderer = data?.header?.musicHeaderRenderer;

      // Extract artist name from various header types
      const artistName =
        immersiveHeader?.title?.runs?.[0]?.text ||
        visualHeader?.title?.runs?.[0]?.text ||
        headerRenderer?.title?.runs?.[0]?.text ||
        detailHeader?.title?.runs?.[0]?.text;

      // Extract thumbnail - try all possible paths (OuterTune exact paths)
      const immersiveThumbs =
        immersiveHeader?.thumbnail?.musicThumbnailRenderer?.thumbnail
          ?.thumbnails;
      const visualThumbs =
        visualHeader?.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail
          ?.thumbnails;
      const detailThumbs =
        detailHeader?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;

      // Get highest quality thumbnail
      const thumbnail =
        (immersiveThumbs?.length > 0
          ? immersiveThumbs[immersiveThumbs.length - 1]?.url
          : null) ||
        (visualThumbs?.length > 0
          ? visualThumbs[visualThumbs.length - 1]?.url
          : null) ||
        (detailThumbs?.length > 0
          ? detailThumbs[detailThumbs.length - 1]?.url
          : null);

      // Extract channel ID for subscription
      const channelId =
        immersiveHeader?.subscriptionButton?.subscribeButtonRenderer?.channelId;

      // Extract play/shuffle/radio endpoints from header
      const playEndpoint =
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
          ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
          ?.musicShelfRenderer?.contents?.[0]?.musicResponsiveListItemRenderer
          ?.overlay?.musicItemThumbnailOverlayRenderer?.content
          ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint;

      const shuffleEndpoint =
        immersiveHeader?.playButton?.buttonRenderer?.navigationEndpoint
          ?.watchEndpoint ||
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
          ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
          ?.musicShelfRenderer?.contents?.[0]?.musicResponsiveListItemRenderer
          ?.navigationEndpoint?.watchPlaylistEndpoint;

      const radioEndpoint =
        immersiveHeader?.startRadioButton?.buttonRenderer?.navigationEndpoint
          ?.watchEndpoint;

      // Extract share link
      const shareLink = `https://music.youtube.com/channel/${channelId || ''}`;

      // Extract description
      const description = immersiveHeader?.description?.runs?.[0]?.text;

      // Build artist object (matching OuterTune's ArtistItem structure)
      const artist = {
        id: channelId,
        title: artistName,
        thumbnail,
        channelId,
        playEndpoint,
        shuffleEndpoint,
        radioEndpoint,
        shareLink,
      };

      // Parse all sections dynamically (matching OuterTune's approach)
      const sectionContents =
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
          ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

      const sections = [];

      for (const section of sectionContents) {
        const parsedSection = this.parseArtistSection(section);
        if (parsedSection && parsedSection.items.length > 0) {
          // Deduplicate items by id
          const seenIds = new Set();
          parsedSection.items = parsedSection.items.filter(item => {
            const id = item.videoId || item.id || item.browseId;
            if (!id || seenIds.has(id)) {
              return false;
            }
            seenIds.add(id);
            return true;
          });
          sections.push(parsedSection);
        }
      }

      // Legacy support: also return flat arrays for backward compatibility
      const songs = [];
      const albums = [];
      const singles = [];
      const videos = [];
      const playlists = [];
      const relatedArtists = [];
      const seenSongIds = new Set();

      for (const sec of sections) {
        const titleLower = sec.title.toLowerCase();
        if (titleLower === 'songs' || titleLower.includes('song')) {
          // Deduplicate songs
          for (const item of sec.items) {
            const id = item.videoId || item.id;
            if (id && !seenSongIds.has(id)) {
              seenSongIds.add(id);
              songs.push(item);
            }
          }
        } else if (titleLower === 'albums') {
          albums.push(...sec.items);
        } else if (
          titleLower === 'singles' ||
          titleLower.includes('single') ||
          titleLower.includes('ep')
        ) {
          singles.push(...sec.items);
        } else if (titleLower === 'videos' || titleLower.includes('video')) {
          videos.push(...sec.items);
        } else if (titleLower.includes('playlist')) {
          playlists.push(...sec.items);
        } else if (
          titleLower.includes('fans might') ||
          titleLower.includes('similar') ||
          titleLower.includes('like')
        ) {
          relatedArtists.push(...sec.items);
        }
      }

      return {
        artist,
        sections,
        description,
        // Legacy flat arrays for backward compatibility
        name: artistName,
        songs,
        albums,
        singles,
        videos,
        playlists,
        relatedArtists,
        thumbnails: thumbnail ? [{url: thumbnail}] : [],
      };
    } catch (e) {
      console.error('parseArtist error:', e);
      return null;
    }
  }

  /**
   * Parse individual artist section (musicShelfRenderer or musicCarouselShelfRenderer)
   * Matching OuterTune's ArtistPage.fromSectionListRendererContent
   */
  static parseArtistSection(section) {
    try {
      // Handle musicShelfRenderer (songs displayed as list)
      if (section.musicShelfRenderer) {
        const renderer = section.musicShelfRenderer;
        const title = renderer.title?.runs?.[0]?.text || '';

        // OuterTune uses getItems() which handles continuationItemRenderer
        const rawContents = renderer.contents || [];

        const items =
          rawContents.map(i => this.parseArtistSongItem(i)).filter(i => i) ||
          [];
        const moreEndpoint =
          renderer.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint;

        return {
          title,
          items,
          moreEndpoint: moreEndpoint
            ? {
                browseId: moreEndpoint.browseId,
                params: moreEndpoint.params,
              }
            : null,
          type: 'songs',
        };
      }

      // Handle musicCarouselShelfRenderer (albums, playlists, artists as horizontal scroll)
      if (section.musicCarouselShelfRenderer) {
        const renderer = section.musicCarouselShelfRenderer;
        const headerRenderer =
          renderer.header?.musicCarouselShelfBasicHeaderRenderer;
        const title = headerRenderer?.title?.runs?.[0]?.text || '';
        const moreEndpoint =
          headerRenderer?.moreContentButton?.buttonRenderer?.navigationEndpoint
            ?.browseEndpoint;

        const rawContents = renderer.contents || [];

        const items =
          rawContents
            .map(i => {
              if (i.musicTwoRowItemRenderer) {
                return this.parseMusicTwoRowItem(i.musicTwoRowItemRenderer);
              }
              if (i.musicResponsiveListItemRenderer) {
                return this.parseArtistSongItem(i);
              }
              return this.parseItem(i);
            })
            .filter(i => i) || [];

        // Determine section type based on first item's type OR title
        let type = 'carousel';
        const firstItem = items[0];
        if (firstItem?.type === 'artist') {
          type = 'artists';
        } else if (firstItem?.type === 'album') {
          type = 'albums';
        } else if (firstItem?.type === 'playlist') {
          type = 'playlists';
        } else if (firstItem?.type === 'song') {
          type = 'songs';
        } else {
          // Fallback to title-based detection
          const titleLower = title.toLowerCase();
          if (titleLower.includes('album')) {
            type = 'albums';
          } else if (
            titleLower.includes('single') ||
            titleLower.includes('ep')
          ) {
            type = 'singles';
          } else if (titleLower.includes('video')) {
            type = 'videos';
          } else if (titleLower.includes('playlist')) {
            type = 'playlists';
          } else if (
            titleLower.includes('fan') ||
            titleLower.includes('like') ||
            titleLower.includes('similar')
          ) {
            type = 'artists';
          } else if (titleLower.includes('featured')) {
            type = 'featured';
          } else if (titleLower.includes('live')) {
            type = 'live';
          }
        }

        return {
          title,
          items,
          moreEndpoint: moreEndpoint
            ? {
                browseId: moreEndpoint.browseId,
                params: moreEndpoint.params,
              }
            : null,
          type,
        };
      }

      // Unknown section type
      return null;
    } catch (e) {
      console.error('parseArtistSection error:', e);
      return null;
    }
  }

  /**
   * Parse song item from artist's songs section (musicResponsiveListItemRenderer)
   * Matches OuterTune's fromMusicResponsiveListItemRenderer in ArtistPage.kt
   */
  static parseArtistSongItem(itemWrapper) {
    try {
      const renderer = itemWrapper.musicResponsiveListItemRenderer;
      if (!renderer) {
        return this.parseItem(itemWrapper);
      }

      // OuterTune: id = renderer.playlistItemData?.videoId ?: return null
      const videoId = renderer.playlistItemData?.videoId;
      if (!videoId) {
        return null;
      }

      // OuterTune: title = renderer.flexColumns.firstOrNull()?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.firstOrNull()?.text
      const title =
        renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
          ?.text?.runs?.[0]?.text;
      if (!title) {
        return null;
      }

      // OuterTune: artists = PageHelper.extractRuns(renderer.flexColumns, "MUSIC_PAGE_TYPE_ARTIST").oddElements()
      // Simplified: get artists from second column, odd indices are artist names
      const artistRuns =
        renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
          ?.text?.runs || [];
      const artists = artistRuns
        .filter((_, idx) => idx % 2 === 0)
        .map(run => ({
          name: run.text,
          id: run.navigationEndpoint?.browseEndpoint?.browseId,
        }));

      // OuterTune: album = from flexColumns using MUSIC_PAGE_TYPE_ALBUM
      const albumRuns =
        renderer.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer
          ?.text?.runs ||
        renderer.flexColumns?.[3]?.musicResponsiveListItemFlexColumnRenderer
          ?.text?.runs;
      const album = albumRuns?.[0]
        ? {
            name: albumRuns[0].text,
            id: albumRuns[0].navigationEndpoint?.browseEndpoint?.browseId,
          }
        : null;

      // OuterTune: thumbnail = renderer.thumbnail?.musicThumbnailRenderer?.getThumbnailUrl()
      const thumbnails =
        renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
      const thumbnail =
        thumbnails?.length > 0 ? thumbnails[thumbnails.length - 1]?.url : null;

      const explicit = renderer.badges?.some(
        b =>
          b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE',
      );
      const endpoint =
        renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
          ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint;

      return {
        videoId,
        id: videoId,
        title,
        name: title,
        artists,
        artist: artists.map(a => a.name).join(', '),
        album,
        thumbnail,
        thumbnails: thumbnails || [],
        explicit,
        endpoint,
        type: 'song',
        image: [{url: thumbnail, quality: 'hd'}],
        artwork: thumbnail,
      };
    } catch (e) {
      console.error('parseArtistSongItem error:', e);
      return this.parseItem(itemWrapper);
    }
  }

  /**
   * Parse musicTwoRowItemRenderer (albums, playlists, artists in carousel)
   * Uses pageType from browseEndpointContextSupportedConfigs like OuterTune
   */
  static parseMusicTwoRowItem(renderer) {
    try {
      const title = renderer.title?.runs?.[0]?.text;
      const thumbnails =
        renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
          ?.thumbnails ||
        renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        renderer.thumbnailRenderer?.thumbnail?.thumbnails ||
        renderer.thumbnail?.thumbnails ||
        [];
      let thumbnail =
        thumbnails?.length > 0 ? thumbnails[thumbnails.length - 1]?.url : null;
      const subtitle = renderer.subtitle?.runs?.map(r => r.text).join('') || '';

      const browseEndpoint = renderer.navigationEndpoint?.browseEndpoint;
      const watchEndpoint = renderer.navigationEndpoint?.watchEndpoint;
      const browseId = browseEndpoint?.browseId;

      // Song fallback thumbnail
      if (!thumbnail && watchEndpoint?.videoId) {
        thumbnail = `https://i.ytimg.com/vi/${watchEndpoint.videoId}/hqdefault.jpg`;
      }

      // Get pageType from browseEndpointContextSupportedConfigs (OuterTune method)
      const pageType =
        browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType;

      // Song (has watchEndpoint with videoId) - OuterTune: isSong = navigationEndpoint.endpoint is WatchEndpoint
      if (watchEndpoint?.videoId) {
        const artistRun = renderer.subtitle?.runs?.[0];
        return {
          videoId: watchEndpoint.videoId,
          id: watchEndpoint.videoId,
          title,
          name: title,
          artists: artistRun
            ? [
                {
                  name: artistRun.text,
                  id: artistRun.navigationEndpoint?.browseEndpoint?.browseId,
                },
              ]
            : [],
          artist: artistRun?.text || 'Unknown',
          thumbnail,
          thumbnails: thumbnails || [],
          explicit: renderer.subtitleBadges?.some(
            b =>
              b.musicInlineBadgeRenderer?.icon?.iconType ===
              'MUSIC_EXPLICIT_BADGE',
          ),
          type: 'song',
          image: [{url: thumbnail}],
          artwork: thumbnail,
        };
      }

      // Album - OuterTune: isAlbum = pageType == MUSIC_PAGE_TYPE_ALBUM || MUSIC_PAGE_TYPE_AUDIOBOOK
      if (
        pageType === 'MUSIC_PAGE_TYPE_ALBUM' ||
        pageType === 'MUSIC_PAGE_TYPE_AUDIOBOOK' ||
        browseId?.startsWith('MPRE') ||
        browseId?.startsWith('OLAK')
      ) {
        const playlistId =
          renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.anyWatchEndpoint
            ?.playlistId ||
          renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint
            ?.watchPlaylistEndpoint?.playlistId;

        const yearRun = renderer.subtitle?.runs?.slice(-1)[0];
        const year = yearRun?.text?.match(/^\d{4}$/)
          ? parseInt(yearRun.text, 10)
          : null;

        return {
          browseId,
          id: browseId,
          playlistId,
          title,
          name: title,
          thumbnail,
          thumbnails: thumbnails || [],
          year,
          subtitle,
          explicit: renderer.subtitleBadges?.some(
            b =>
              b.musicInlineBadgeRenderer?.icon?.iconType ===
              'MUSIC_EXPLICIT_BADGE',
          ),
          type: 'album',
          image: [{url: thumbnail}],
        };
      }

      // Playlist - OuterTune: isPlaylist = pageType == MUSIC_PAGE_TYPE_PLAYLIST
      if (
        pageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
        browseId?.startsWith('VL') ||
        browseId?.startsWith('PL') ||
        browseId?.startsWith('RDCLAK')
      ) {
        const playlistId = browseId?.startsWith('VL')
          ? browseId.substring(2)
          : browseId;
        const authorRun = renderer.subtitle?.runs?.slice(-1)[0];

        // Get play/shuffle/radio endpoints like OuterTune
        const playEndpoint =
          renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint
            ?.watchPlaylistEndpoint;
        const menuItems = renderer.menu?.menuRenderer?.items || [];
        const shuffleEndpoint = menuItems.find(
          i => i.menuNavigationItemRenderer?.icon?.iconType === 'MUSIC_SHUFFLE',
        )?.menuNavigationItemRenderer?.navigationEndpoint
          ?.watchPlaylistEndpoint;
        const radioEndpoint = menuItems.find(
          i => i.menuNavigationItemRenderer?.icon?.iconType === 'MIX',
        )?.menuNavigationItemRenderer?.navigationEndpoint
          ?.watchPlaylistEndpoint;

        return {
          id: playlistId,
          browseId,
          playlistId,
          title,
          name: title,
          thumbnail,
          thumbnails: thumbnails || [],
          author: authorRun?.text,
          subtitle,
          type: 'playlist',
          playEndpoint,
          shuffleEndpoint,
          radioEndpoint,
          image: [{url: thumbnail}],
        };
      }

      // Artist - OuterTune: isArtist = pageType == MUSIC_PAGE_TYPE_ARTIST
      if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || browseId?.startsWith('UC')) {
        const menuItems = renderer.menu?.menuRenderer?.items || [];
        const channelId = menuItems.find(
          i =>
            i.toggleMenuServiceItemRenderer?.defaultIcon?.iconType ===
            'SUBSCRIBE',
        )?.toggleMenuServiceItemRenderer?.defaultServiceEndpoint
          ?.subscribeEndpoint?.channelIds?.[0];
        const shuffleEndpoint = menuItems.find(
          i => i.menuNavigationItemRenderer?.icon?.iconType === 'MUSIC_SHUFFLE',
        )?.menuNavigationItemRenderer?.navigationEndpoint
          ?.watchPlaylistEndpoint;
        const radioEndpoint = menuItems.find(
          i => i.menuNavigationItemRenderer?.icon?.iconType === 'MIX',
        )?.menuNavigationItemRenderer?.navigationEndpoint
          ?.watchPlaylistEndpoint;

        return {
          id: browseId,
          browseId,
          channelId,
          title,
          name: title,
          thumbnail,
          thumbnails: thumbnails || [],
          subtitle,
          type: 'artist',
          shuffleEndpoint,
          radioEndpoint,
          image: [{url: thumbnail}],
        };
      }

      // Generic fallback
      return {
        id: browseId || watchEndpoint?.videoId,
        browseId,
        title,
        name: title,
        thumbnail,
        thumbnails: thumbnails || [],
        subtitle,
        type: 'unknown',
        image: [{url: thumbnail}],
      };
    } catch (e) {
      console.error('parseMusicTwoRowItem error:', e);
      return null;
    }
  }

  static parseAlbum(data) {
    try {
      // Try multiple possible structures for album header
      let header =
        data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents?.[0]
          ?.musicResponsiveHeaderRenderer;

      // Alternative structure: some albums use musicDetailHeaderRenderer
      if (!header) {
        header = data?.header?.musicDetailHeaderRenderer;
      }

      // Another alternative: singleColumnBrowseResultsRenderer for some album types
      if (!header) {
        header =
          data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
            ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
            ?.musicResponsiveHeaderRenderer;
      }

      // Try multiple possible structures for tracks
      let tracksContent =
        data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
          ?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer
          ?.contents;

      // Alternative: musicShelfRenderer
      if (!tracksContent) {
        tracksContent =
          data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
            ?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents;
      }

      // Another alternative for single column layout
      if (!tracksContent) {
        const sectionContents =
          data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
            ?.tabRenderer?.content?.sectionListRenderer?.contents;
        for (const section of sectionContents || []) {
          if (section.musicShelfRenderer?.contents) {
            tracksContent = section.musicShelfRenderer.contents;
            break;
          }
          if (section.musicPlaylistShelfRenderer?.contents) {
            tracksContent = section.musicPlaylistShelfRenderer.contents;
            break;
          }
        }
      }

      const title = header?.title?.runs?.[0]?.text || header?.title?.simpleText;

      // Artist can be in different places
      const artist =
        header?.straplineTextOne?.runs?.[0]?.text ||
        header?.subtitle?.runs?.[0]?.text ||
        header?.secondTitle?.runs?.[0]?.text;

      // Year extraction - try multiple positions
      let year = null;
      const subtitleRuns = header?.subtitle?.runs;
      if (subtitleRuns && Array.isArray(subtitleRuns)) {
        for (const run of subtitleRuns) {
          if (run.text && /^\d{4}$/.test(run.text)) {
            year = run.text;
            break;
          }
        }
      }

      // Get thumbnails array (not just single thumbnail)
      const thumbnailsData =
        header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail
          ?.thumbnails ||
        [];

      // Create thumbnails array in expected format
      const thumbnails = thumbnailsData.map(thumb => ({
        url: enhanceYTMusicArtwork(thumb.url, 'album-header'),
        link: enhanceYTMusicArtwork(thumb.url, 'album-header'),
        width: thumb.width,
        height: thumb.height,
      }));

      // Parse tracks
      const tracks =
        tracksContent?.map(t => this.parseItem(t)).filter(i => i) || [];

      // Get browseId from the data if available
      const browseId =
        data?.responseContext?.serviceTrackingParams?.[0]?.params?.find(
          p => p.key === 'browse_id',
        )?.value;



      // Return in format expected by getYTMusicAlbumData
      return {
        title,
        artist,
        artists: artist ? [{name: artist, id: null}] : [],
        year,
        thumbnails, // Array format expected by getYTMusicAlbumData
        thumbnail: thumbnails[thumbnails.length - 1]?.url, // Also include single for backward compat
        tracks, // 'tracks' expected by getYTMusicAlbumData
        songs: tracks, // Also include 'songs' for backward compat
        browseId,
      };
    } catch (e) {
      console.error('parseAlbum error:', e);
      return null;
    }
  }

  static parseSection(data) {
    try {
      const section =
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
          ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
          ?.gridRenderer ||
        data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
          ?.sectionListRenderer?.contents?.[0]?.gridRenderer ||
        data?.continuationContents?.gridContinuation ||
        data?.continuationContents?.musicShelfContinuation;

      const header = data?.header?.musicHeaderRenderer;
      const title = header?.title?.runs?.[0]?.text || '';

      const rawItems = section?.items || section?.contents || [];
      const items = rawItems
        .map(i => {
          if (i.musicTwoRowItemRenderer) {
            return this.parseMusicTwoRowItem(i.musicTwoRowItemRenderer);
          }
          if (i.musicResponsiveListItemRenderer) {
            return this.parseArtistSongItem(i);
          }
          return this.parseItem(i);
        })
        .filter(i => i);

      // Get continuation token
      const continuations = section?.continuations;
      const continuation =
        continuations?.[0]?.nextContinuationData?.continuation;

      return {
        title,
        items,
        continuation,
      };
    } catch (e) {
      console.error('parseSection error:', e);
      return {items: [], continuation: null};
    }
  }

  static parsePlaylist(data) {
    try {
      const header =
        data?.header?.musicDetailHeaderRenderer ||
        data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents?.[0]
          ?.musicResponsiveHeaderRenderer;
      const tracks =
        data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
          ?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer
          ?.contents;

      const title = header?.title?.runs?.[0]?.text;
      const songs = tracks?.map(t => this.parseItem(t)).filter(i => i) || [];

      // Extract additional metadata
      const thumbnails =
        header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
      const description =
        header?.description?.runs?.[0]?.text || header?.description?.simpleText;

      // Author/Subtitle typically in subtitle runs
      // "Playlist • YouTube Music • 2023" or "Username • 50 songs"
      const subtitleRuns = header?.subtitle?.runs;
      const author =
        subtitleRuns?.find(r =>
          r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'),
        )?.text ||
        subtitleRuns?.[0]?.text ||
        'YouTube Music';
      const year = subtitleRuns?.find(r => r.text.match(/\d{4}/))?.text;

      // Extract playlist thumbnail (skip enhancement - already high quality)
      const playlistThumbnail = thumbnails?.[thumbnails.length - 1]?.url;

      return {
        id: data?.header?.musicDetailHeaderRenderer?.menu?.menuRenderer
          ?.topLevelButtons?.[0]?.buttonRenderer?.navigationEndpoint
          ?.watchEndpoint?.playlistId,
        title,
        songs,
        thumbnails,
        thumbnail: playlistThumbnail, // Add main thumbnail field
        description,
        author,
        year,
        count: songs.length,
      };
    } catch (e) {
      console.error('Parse Playlist Error', e);
      return null;
    }
  }

  static parseRelated(data) {
    try {
      const panel =
        data?.contents?.singleColumnMusicWatchNextResultsRenderer
          ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]
          ?.tabRenderer?.content?.musicQueueRenderer?.content
          ?.playlistPanelRenderer;
      const items =
        panel?.contents?.map(i => this.parseItem(i)).filter(i => i) || [];
      return items;
    } catch (e) {
      return null;
    }
  }

  /**
   * Parse Next/Recommendations response
   * Returns an object with items (songs), continuation token, and automix playlist ID
   */
  static parseNext(data) {
    try {
      const panel =
        data?.contents?.singleColumnMusicWatchNextResultsRenderer
          ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]
          ?.tabRenderer?.content?.musicQueueRenderer?.content
          ?.playlistPanelRenderer;

      if (!panel) {
        const LOG_VERBOSE = false;
        const debugLog = (...args) => {
          if (LOG_VERBOSE) {

          }
        };
        debugLog('InnerTube parseNext: No panel found');
        return {items: [], continuation: null, automixPlaylistId: null};
      }

      // Parse all items (songs) - skip automix preview items for now
      const items = [];
      let automixPlaylistId = null;

      for (const item of panel.contents || []) {
        // Check for automix preview - extract the playlist endpoint
        if (item.automixPreviewVideoRenderer) {
          const watchEndpoint =
            item.automixPreviewVideoRenderer?.content
              ?.automixPlaylistVideoRenderer?.navigationEndpoint
              ?.watchPlaylistEndpoint;
          if (watchEndpoint?.playlistId) {
            automixPlaylistId = watchEndpoint.playlistId;
            const LOG_VERBOSE = false;
            const debugLog = (...args) => {
              if (LOG_VERBOSE) {

              }
            };
            debugLog(`🎵 Found automix playlist ID: ${automixPlaylistId}`);
          }
          continue;
        }

        const parsed = this.parseItem(item);
        if (parsed) {
          items.push(parsed);
        }
      }

      // Get continuation token for loading more recommendations
      const continuation =
        panel.continuations?.[0]?.nextContinuationData?.continuation || null;

      const LOG_VERBOSE = false;
      const debugLog = (...args) => {
        if (LOG_VERBOSE) {

        }
      };
      debugLog(
        `InnerTube parseNext: Found ${items.length} recommendations, automix: ${
          automixPlaylistId ? 'yes' : 'no'
        }, continuation: ${continuation ? 'yes' : 'no'}`,
      );

      return {
        items,
        continuation,
        automixPlaylistId,
        // Also return the title if available
        title:
          data?.contents?.singleColumnMusicWatchNextResultsRenderer
            ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]
            ?.tabRenderer?.content?.musicQueueRenderer?.header
            ?.musicQueueHeaderRenderer?.subtitle?.runs?.[0]?.text || null,
      };
    } catch (e) {
      console.error('Parse Next Error:', e);
      return {items: [], continuation: null, automixPlaylistId: null};
    }
  }

  // --- generic Item Parser ---
  static parseItem(itemWrapper) {
    try {
      // Handle cases where itemWrapper itself is the renderer, or it's wrapped
      const item =
        itemWrapper.musicResponsiveListItemRenderer ||
        itemWrapper.musicTwoRowItemRenderer ||
        itemWrapper.playlistPanelVideoRenderer ||
        itemWrapper.videoRenderer ||
        itemWrapper;

      if (
        !item ||
        (!item.videoId &&
          !item.browseId &&
          !item.playlistId &&
          !item.playlistItemData)
      ) {
        return null;
      }

      // CRITICAL: Search results store videoId in playlistItemData.videoId
      const videoId =
        item.playlistItemData?.videoId ||
        item.videoId ||
        item.onTap?.watchEndpoint?.videoId ||
        item.navigationEndpoint?.watchEndpoint?.videoId ||
        item.overlay?.musicItemThumbnailOverlayRenderer?.content
          ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
          ?.videoId;

      let browseId =
        item.navigationEndpoint?.browseEndpoint?.browseId ||
        item.onTap?.browseEndpoint?.browseId;

      // Try multiple paths for title
      let title =
        item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
          ?.runs?.[0]?.text ||
        item.title?.runs?.[0]?.text ||
        item.title?.simpleText ||
        item.name?.runs?.[0]?.text ||
        item.name?.simpleText;

      // Thumbnail extraction - be extremely aggressive finding the thumbnails array
      const thumbnails =
        item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        item.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        item.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
        item.thumbnail?.thumbnail?.thumbnails ||
        item.thumbnail?.thumbnails ||
        item.thumbnailRenderer?.thumbnail?.thumbnails ||
        item.thumbnails?.thumbnails ||
        item.thumbnails ||
        [];

      // Sort thumbnails by width (descending) to get highest quality
      const sortedThumbnails = Array.isArray(thumbnails)
        ? [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))
        : [];
      let thumbnail = sortedThumbnails[0]?.url;

      // Ensure protocol
      if (thumbnail && thumbnail.startsWith('//')) {
        thumbnail = 'https:' + thumbnail;
      }

      // Reliable fallback construct
      if (!thumbnail && videoId) {
        thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }

      // Use enhanced artwork logic to get the best possible thumbnail reliably
      thumbnail = enhanceYTMusicArtwork(thumbnail, 'card') || thumbnail;

      // Provide high-res version for player
      const highResThumbnail =
        enhanceYTMusicArtwork(thumbnail, 'playing') || thumbnail;

      // Type detection
      let type = 'song';
      let playlistId = item.playlistId;

      if (
        browseId &&
        (browseId.startsWith('MPRE') || browseId.startsWith('OLAK'))
      ) {
        type = 'album';
      }
      if (browseId && browseId.startsWith('VL')) {
        type = 'playlist';
        playlistId = browseId;
      } else if (browseId && browseId.startsWith('PL')) {
        playlistId = `VL${browseId}`;
        type = 'playlist';
      }
      if (browseId && browseId.startsWith('UC')) {
        type = 'artist';
      }

      if (
        (itemWrapper.musicTwoRowItemRenderer || item.type === 'album') &&
        !videoId &&
        type === 'song'
      ) {
        type = 'album/playlist';
      }

      // Artist extraction
      let artist = 'Unknown';
      let artistsList = [];

      const flexColumn1 =
        item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text
          ?.runs;
      const bylineRuns =
        item.longBylineText?.runs ||
        item.shortBylineText?.runs ||
        item.subtitle?.runs;

      if (flexColumn1 && Array.isArray(flexColumn1) && flexColumn1.length > 0) {
        const oddElements = flexColumn1.filter((_, index) => index % 2 === 0);
        artistsList = oddElements.map(run => ({
          name: run.text,
          id: run.navigationEndpoint?.browseEndpoint?.browseId,
        }));
        artist = oddElements.map(run => run.text).join(', ');
      } else if (bylineRuns && Array.isArray(bylineRuns)) {
        const oddElements = bylineRuns.filter((_, index) => index % 2 === 0);
        artistsList = oddElements.map(run => ({
          name: run.text,
          id: run.navigationEndpoint?.browseEndpoint?.browseId,
        }));
        artist = oddElements.map(run => run.text).join(', ');
      }

      if (!artist || artist === '') {
        artist = 'Unknown';
      }

      // Duration extraction
      let durationText =
        item.fixedColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
          ?.runs?.[0]?.text ||
        item.lengthText?.runs?.[0]?.text ||
        item.lengthText?.simpleText;
      const duration = durationText ? this.parseTime(durationText) : null;

      return {
        videoId,
        browseId,
        playlistId,
        title,
        artist,
        artists: artistsList,
        duration,
        thumbnail,
        highResThumbnail,
        thumbnails: sortedThumbnails,
        type,
        id: videoId || browseId || playlistId,
        name: title,
        subtitle:
          item.subtitle?.runs?.map(r => r.text).join('') ||
          item.longBylineText?.runs?.map(r => r.text).join('') ||
          item.shortBylineText?.runs?.map(r => r.text).join('') ||
          '',
        image: [
          {url: thumbnail, quality: 'default'},
          {url: highResThumbnail, quality: 'max'},
        ],
        artwork: highResThumbnail || thumbnail,
        year: item.subtitle?.runs?.[item.subtitle.runs.length - 1]?.text || '',
      };
    } catch (e) {
      console.error('parseItem error:', e);
      return null;
    }
  }

  // --- InnerTube Player API (Stream URL Resolution) ---

  /**
   * Cached visitorData (required by YouTube to avoid LOGIN_REQUIRED).
   * Fetched from sw.js_data endpoint like vivi-music.
   */
  static _visitorData = null;
  static _visitorDataTimestamp = 0;
  static _VISITOR_DATA_TTL = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Fetch visitorData from YouTube's sw.js_data endpoint.
   * vivi-music pattern: parse the JSON array and find a string matching /^Cg[ts]/
   */
  static async _fetchVisitorData() {
    // Return cached if still fresh
    if (
      this._visitorData &&
      Date.now() - this._visitorDataTimestamp < this._VISITOR_DATA_TTL
    ) {
      return this._visitorData;
    }

    try {
      const resp = await fetch('https://music.youtube.com/sw.js_data', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const text = await resp.text();
      // Response starts with ")]}'" then JSON array
      const jsonStr = text.replace(/^\)\]\}'?\s*/, '');
      const parsed = JSON.parse(jsonStr);
      // Walk the nested array to find visitorData matching /^Cg[ts]/
      const findVisitorData = arr => {
        if (typeof arr === 'string' && /^Cg[ts]/.test(arr)) {return arr;}
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const found = findVisitorData(item);
            if (found) {return found;}
          }
        }
        return null;
      };
      const vd = findVisitorData(parsed);
      if (vd) {
        this._visitorData = vd;
        this._visitorDataTimestamp = Date.now();
        return vd;
      }
    } catch (e) {
      console.warn('Failed to fetch visitorData:', e.message);
    }
    return this._visitorData; // return stale if fetch failed
  }

  /**
   * Client definitions for player requests (vivi-music pattern).
   */
  static ANDROID_VR_CONTEXT = {
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.43.32',
      androidSdkVersion: '32',
      osName: 'Android',
      osVersion: '12',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      hl: 'en',
      gl: 'US',
    },
  };

  static ANDROID_VR_USER_AGENT =
    'com.google.android.apps.youtube.vr.oculus/1.43.32 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/107.0.5284.2)';

  static IOS_CONTEXT = {
    client: {
      clientName: 'IOS',
      clientVersion: '21.03.1',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.2.22C152',
      hl: 'en',
      gl: 'US',
    },
  };

  static IOS_USER_AGENT =
    'com.google.ios.youtube/21.03.1 (iPhone16,2; U; CPU iOS 18_2 like Mac OS X;)';

  /**
   * List of clients to try in order (vivi-music fallback strategy).
   */
  static _PLAYER_CLIENTS = [
    {
      context: 'ANDROID_VR_CONTEXT',
      userAgent: 'ANDROID_VR_USER_AGENT',
      clientId: '28',
      clientVersion: '1.43.32',
    },
    {
      context: 'IOS_CONTEXT',
      userAgent: 'IOS_USER_AGENT',
      clientId: '5',
      clientVersion: '21.03.1',
    },
  ];

  /**
   * Fetch player response from InnerTube player API.
   * Tries ANDROID_VR first, then IOS fallback (vivi-music pattern).
   * Fetches visitorData to satisfy bot detection.
   *
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<{url: string, mimeType: string, bitrate: number, duration: number, title: string, author: string, thumbnail: string}|null>}
   */
  static async getPlayerResponse(videoId) {
    // Fetch visitorData (required to avoid LOGIN_REQUIRED)
    const visitorData = await this._fetchVisitorData();

    for (const clientDef of this._PLAYER_CLIENTS) {
      try {
        const clientContext = this[clientDef.context];
        const ua = this[clientDef.userAgent];

        const contextWithVisitor = {
          ...clientContext,
          client: {
            ...clientContext.client,
            ...(visitorData ? {visitorData} : {}),
          },
        };

        const body = {
          context: contextWithVisitor,
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        };

        const response = await fetch(
          `${INNERTUBE_API_URL}/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': ua,
              'X-Goog-Api-Format-Version': '1',
              'X-YouTube-Client-Name': clientDef.clientId,
              'X-YouTube-Client-Version': clientDef.clientVersion,
              'X-Origin': 'https://music.youtube.com',
              Referer: 'https://music.youtube.com/',
              ...(visitorData
                ? {'X-Goog-Visitor-Id': visitorData}
                : {}),
            },
            body: JSON.stringify(body),
          },
        );

        const data = await response.json();

        if (data?.playabilityStatus?.status !== 'OK') {
          console.warn(
            `⚠️ InnerTube player [${clientContext.client.clientName}]: ${data?.playabilityStatus?.status} - ${data?.playabilityStatus?.reason || ''}`,
          );
          continue; // Try next client
        }

        const result = this._extractBestAudio(data, videoId);
        if (result) {return result;}
      } catch (error) {
        console.warn(
          `⚠️ InnerTube player [${clientDef.context}] failed for ${videoId}:`,
          error.message,
        );
      }
    }

    return null; // All clients failed
  }

  /**
   * Extract the best audio stream URL from a player response.
   * @private
   */
  static _extractBestAudio(data, videoId) {
    const adaptiveFormats = data?.streamingData?.adaptiveFormats || [];

    const audioFormats = adaptiveFormats.filter(
      f => f.mimeType && f.mimeType.startsWith('audio/'),
    );

    if (audioFormats.length === 0) {
      console.warn(`⚠️ No audio formats in InnerTube response for ${videoId}`);
      return null;
    }

    // Prefer opus/webm, then sort by bitrate descending
    const bestFormat = audioFormats.sort((a, b) => {
      const aIsOpus = a.mimeType.includes('opus') ? 1 : 0;
      const bIsOpus = b.mimeType.includes('opus') ? 1 : 0;
      if (aIsOpus !== bIsOpus) {return bIsOpus - aIsOpus;}
      return (b.bitrate || 0) - (a.bitrate || 0);
    })[0];

    if (!bestFormat.url) {
      console.warn(`⚠️ Best audio format has no direct URL for ${videoId}`);
      return null;
    }

    const videoDetails = data?.videoDetails || {};
    const thumbnails = videoDetails?.thumbnail?.thumbnails || [];

    return {
      url: bestFormat.url,
      mimeType: bestFormat.mimeType,
      bitrate: bestFormat.bitrate,
      duration: parseInt(videoDetails.lengthSeconds || '0', 10),
      title: videoDetails.title,
      author: videoDetails.author || videoDetails.channelId,
      thumbnail:
        thumbnails.length > 0
          ? thumbnails[thumbnails.length - 1].url
          : null,
    };
  }
}

export default InnerTubeClient;
