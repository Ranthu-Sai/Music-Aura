export * from './Saavn/Playlist';
import axios from 'axios';
import {getYTMusicPlaylistData as getYTMusicPlaylistDataFromService} from './YTMusic';
import YTArtworkUtils from '../Utils/YTMusicArtworkUtils';

// JioSaavn API Fallback URLs
const JIOSAAVN_API_FALLBACKS = [
  'https://jiosaavn-api-2.vercel.app', // Primary (currently used)
  'https://saavn-api.vercel.app', // Secondary fallback
  'https://jio-savan-api-sigma.vercel.app', // Tertiary fallback
];

async function getPlaylistData(id) {
  // Check if it's a user-created local playlist
  if (typeof id === 'string' && id.startsWith('playlist_')) {
    const {GetUserPlaylists} = require('../LocalStorage/StoreUserPlaylists');
    const playlists = await GetUserPlaylists();
    const playlist = playlists.find(p => p.id === id);
    if (playlist) {
      return {
        data: {
          id: playlist.id,
          name: playlist.name,
          image: playlist.image,
          songs: playlist.songs.map(s => ({
            ...s,
            name: s.title,
            artists: {primary: [{name: s.artist}]},
          })),
          source: 'local',
        },
      };
    }
  }

  // Check if it's a YouTube Music playlist (starts with VL, RDAMPL, OLAK, or other YTM playlist IDs)
  // Use the YouTubeMusicService-based implementation (Api/YTMusic.js) because it reliably returns tracks.
  if (
    id.startsWith('VL') ||
    id.startsWith('RDAMPL') ||
    id.startsWith('OLAK') ||
    id.startsWith('PL')
  ) {
    const normalizedId =
      typeof id === 'string' && id.startsWith('VL') ? id.slice(2) : id;
    const ytm = await getYTMusicPlaylistDataFromService(normalizedId);

    // The Playlist screen expects `{ data: { songs: [] } }`.
    // Api/YTMusic.js returns `{ status, data: playlistObj }`.
    if (ytm?.data) {
      return {data: {...ytm.data, songs: ytm.data.songs || []}};
    }
    return {data: {id: normalizedId, songs: []}};
  }

  if (id.startsWith('/')) {
    // Regular YouTube playlist - try InnerTube API first, then Piped as fallback
    const listId = id.split('list=')[1];

    // STRATEGY 1: Try YouTube InnerTube API (primary)
    try {
      const innerTubeResponse = await fetch(
        'https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20241204.01.00',
              },
            },
            browseId: `VL${listId}`,
          }),
          timeout: 15000,
        },
      );

      if (innerTubeResponse.ok) {
        const data = await innerTubeResponse.json();

        // Extract playlist metadata
        const header = data?.header?.playlistHeaderRenderer;
        const playlistName = header?.title?.simpleText || 'Unknown Playlist';

        let thumbnail =
          header?.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.slice(
            -1,
          )[0]?.url || '';
        if (!thumbnail) {
          thumbnail =
            data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails?.slice(
              -1,
            )[0]?.url || '';
        }

        // Extract songs
        const songs = [];
        const contents =
          data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
            ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
            ?.contents?.[0]?.playlistVideoListRenderer?.contents;

        if (contents) {
          for (const item of contents) {
            const video = item.playlistVideoRenderer;
            if (!video) {
              continue;
            }

            const videoId = video.videoId;
            if (!videoId) {
              continue;
            }

            const title =
              video.title?.runs?.[0]?.text ||
              video.title?.simpleText ||
              'Unknown';
            const artist = video.shortBylineText?.runs?.[0]?.text || 'Unknown';
            const thumbnails = video.thumbnail?.thumbnails || [];
            const videoThumbnail =
              thumbnails.find(t => t?.width >= 1280)?.url ||
              thumbnails[thumbnails.length - 1]?.url ||
              `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            const durationText = video.lengthText?.simpleText;
            const duration = parseDuration(durationText) || 0;

            songs.push({
              id: videoId,
              name: title,
              image: [{}, {}, {url: videoThumbnail}],
              artists: {primary: [{name: artist}]},
              downloadUrl: videoId,
              duration: duration,
              language: 'en',
            });
          }
        }

        return {
          data: {
            name: playlistName,
            image: [{}, {}, {url: thumbnail}],
            songs: songs,
          },
        };
      }
    } catch (error) {}

    throw new Error('Failed to fetch YouTube playlist from InnerTube');
  } else {
    // Saavn playlist
    const baseUrl = 'https://www.jiosaavn.com/api.php';
    const defaultParams = {
      ctx: 'wap6dot0',
      api_version: 4,
      _format: 'json',
      _marker: 0,
    };
    const sources = {
      playlist_detail:
        '__call=webapi.get&type=playlist&p=1&n=50&includeMetaTags=0',
    };

    const urls = [
      `https://jiosavan-api-with-playlist.vercel.app/api/playlists?id=${id}&limit=100000`,
      `${baseUrl}?${Object.keys(defaultParams)
        .map(k => `${k}=${defaultParams[k]}`)
        .join('&')}&${sources.playlist_detail}&id=${id}`,
    ];

    for (let url of urls) {
      try {
        let config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: url,
          headers: {},
        };
        const response = await axios.request(config);
        return response.data;
      } catch (error) {
        continue;
      }
    }
    throw new Error('All playlist data API instances failed');
  }
}

async function getSearchPlaylistData(searchText, page, limit) {
  const baseUrl = 'https://www.jiosaavn.com/api.php';
  const defaultParams = {
    ctx: 'wap6dot0',
    api_version: 4,
    _format: 'json',
    _marker: 0,
  };
  const sources = {
    playlist_search: '__call=search.getPlaylistResults&n=' + limit,
  };

  const urls = [
    `https://jio-savan-api-sigma.vercel.app/search/playlists?query=${searchText}&page=${page}&limit=${limit}`,
    `${baseUrl}?${Object.keys(defaultParams)
      .map(k => `${k}=${defaultParams[k]}`)
      .join('&')}&${sources.playlist_search}&q=${encodeURIComponent(
      searchText,
    )}&p=${page}`,
  ];

  // Add fallback API URLs with /search/playlists endpoint
  JIOSAAVN_API_FALLBACKS.forEach(apiBase => {
    urls.push(
      `${apiBase}/search/playlists?query=${encodeURIComponent(
        searchText,
      )}&page=${page}&limit=${limit}`,
    );
  });

  for (let url of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: url,
        headers: {},
      };
      const response = await axios.request(config);
      return response.data;
    } catch (error) {
      continue;
    }
  }
  throw new Error('All playlist search API instances failed');
}

async function getAllPlaylists(language) {
  const urls = [
    'https://jiosaavn-c451wwyru-sumit-kolhes-projects-94a4846a.vercel.app',
    'https://nepotuneapi.vercel.app',
    'https://saavn.sumit.co',
    'https://jio-savan-api-sigma.vercel.app',
  ];
  for (let baseUrl of urls) {
    try {
      const pages = [1, 2, 3, 4, 5];
      const promises = pages.map(page =>
        axios.get(
          `${baseUrl}/api/search/playlists?query=${language}&page=${page}&limit=100`,
        ),
      );
      const responses = await Promise.all(promises);
      let allResults = [];
      for (let response of responses) {
        if (response.data?.data?.results) {
          allResults = allResults.concat(response.data.data.results);
        }
      }
      // Remove duplicates based on id
      const uniqueResults = allResults.filter(
        (item, index, self) => self.findIndex(i => i.id === item.id) === index,
      );
      return {data: {results: uniqueResults.slice(0, 500)}};
    } catch (error) {
      continue;
    }
  }
  throw new Error('Failed to fetch all playlists');
}

async function getYTMusicPlaylistData(browseId) {
  try {
    // YTMusic playlist browseIds often come as "VL{playlistId}".
    // The music.youtube.com browse endpoint expects the raw playlist id ("PL..."/"RDAMPL..."/"OLAK...")
    // for many playlist types. Normalize here to avoid empty/failed song lists.
    const normalizedBrowseId =
      typeof browseId === 'string' && browseId.startsWith('VL')
        ? browseId.slice(2)
        : browseId;

    const response = await fetch(
      'https://music.youtube.com/youtubei/v1/browse?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20241204.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
          browseId: normalizedBrowseId,
        }),
        timeout: 15000,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.header) {
    }
    if (data.contents) {
    }

    // Try multiple possible header locations
    const header =
      data?.header?.musicDetailHeaderRenderer ||
      data?.header?.musicImmersiveHeaderRenderer ||
      data?.header?.musicHeaderRenderer ||
      data?.header?.musicEditablePlaylistDetailHeaderRenderer ||
      data?.header?.musicVisualHeaderRenderer;

    const playlistName =
      header?.title?.runs?.[0]?.text ||
      header?.title?.text ||
      'Unknown Playlist';

    // Extract thumbnail - Try multiple possible paths for robustness
    let thumbnail =
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(
        -1,
      )[0]?.url ||
      header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(
        -1,
      )[0]?.url ||
      header?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
      '';

    // If thumbnail is still empty, look in a common alternative location
    if (
      !thumbnail &&
      data?.header?.musicVisualHeaderRenderer?.thumbnail?.musicThumbnailRenderer
        ?.thumbnail?.thumbnails
    ) {
      const visualThumbs =
        data.header.musicVisualHeaderRenderer.thumbnail.musicThumbnailRenderer
          .thumbnail.thumbnails;
      thumbnail = visualThumbs[visualThumbs.length - 1]?.url;
    }

    if (
      thumbnail &&
      (thumbnail.includes('googleusercontent.com') ||
        thumbnail.includes('ggpht.com'))
    ) {
      thumbnail = thumbnail.split('=')[0] + '=w544-h544-l90-rj';
    }

    // Extract songs - try multiple possible content paths
    const songs = [];
    let contents =
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents;

    if (!contents) {
      contents =
        data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
          ?.sectionListRenderer?.contents;
    }

    if (!contents) {
      contents =
        data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents;
    }

    if (contents && contents.length > 0) {
    }

    if (contents) {
      for (const section of contents) {
        const musicShelf =
          section.musicPlaylistShelfRenderer || section.musicShelfRenderer;
        if (!musicShelf || !musicShelf.contents) {
          continue;
        }

        for (const item of musicShelf.contents) {
          const musicItem = item.musicResponsiveListItemRenderer;
          if (!musicItem) {
            continue;
          }

          // Extract video ID
          const videoId =
            musicItem.playlistItemData?.videoId ||
            musicItem.overlay?.musicItemThumbnailOverlayRenderer?.content
              ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
              ?.videoId;

          if (!videoId) {
            continue;
          }

          // Extract title
          const title =
            musicItem.flexColumns?.[0]
              ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
              ?.text || 'Unknown';

          // Extract artist
          const artistRuns =
            musicItem.flexColumns?.[1]
              ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          const artist =
            artistRuns
              ?.filter(r => r.text !== ' • ')
              .map(r => r.text)
              .join('') || 'Unknown';

          // Extract thumbnail - try multiple paths for robustness
          const itemThumbs =
            musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails || [];
          let songThumbnail =
            itemThumbs[itemThumbs.length - 1]?.url ||
            thumbnail ||
            `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

          // Upgrade thumbnail quality
          songThumbnail = YTArtworkUtils.upgradeArtworkQuality(songThumbnail);
          songThumbnail = YTArtworkUtils.upgradeYtimgQuality(songThumbnail);

          // Extract duration
          const durationText =
            musicItem.fixedColumns?.[0]
              ?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]
              ?.text;
          const duration = parseDuration(durationText) || 0;

          // Detect language from title/artist
          const detectLanguage = text => {
            if (!text) {
              return 'en';
            }
            if (/[\u0C00-\u0C7F]/.test(text)) {
              return 'telugu';
            }
            if (/[\u0900-\u097F]/.test(text)) {
              return 'hindi';
            }
            if (/[\u0B80-\u0BFF]/.test(text)) {
              return 'tamil';
            }
            if (/[\u0C80-\u0CFF]/.test(text)) {
              return 'kannada';
            }
            if (/[\u0D00-\u0D7F]/.test(text)) {
              return 'malayalam';
            }
            if (/[\u0980-\u09FF]/.test(text)) {
              return 'bengali';
            }
            if (/[\u0A00-\u0A7F]/.test(text)) {
              return 'punjabi';
            }
            if (/[\u0A80-\u0AFF]/.test(text)) {
              return 'gujarati';
            }
            return 'en';
          };

          songs.push({
            id: videoId,
            name: title,
            image: [
              {url: songThumbnail},
              {url: songThumbnail},
              {url: songThumbnail},
            ],
            duration: duration,
            language: detectLanguage(title + ' ' + artist),
            artists: {primary: [{name: artist}]},
            downloadUrl: videoId,
            url: videoId,
          });
        }
      }
    }

    const playlistData = {
      data: {
        id: normalizedBrowseId,
        name: playlistName,
        image: [{}, {}, {url: thumbnail}],
        songs: songs,
        type: 'playlist',
        source: 'ytmusic',
      },
    };
    return playlistData;
  } catch (error) {
    throw error;
  }
}

// Helper function to parse duration
function parseDuration(durationText) {
  if (!durationText) {
    return 0;
  }
  const parts = durationText.split(':').map(p => parseInt(p, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return 0;
}

export {getPlaylistData, getSearchPlaylistData, getAllPlaylists, getYTMusicPlaylistData};
