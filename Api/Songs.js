export * from './Saavn/Songs';
import axios from 'axios';
import YTArtworkUtils from '../Utils/YTMusicArtworkUtils';
import {getCachedData} from '../Utils/CacheManager';

// Configure axios for better Android compatibility
// No global timeout: allow requests to finish on slow networks
axios.defaults.headers.common['User-Agent'] =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Helper function to parse duration strings like "3:45" to seconds
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

// Normalize timed lyrics array to ensure each line has id, start_time (ms), and end_time (ms)
function normalizeTimedLyrics(timed) {
  if (!Array.isArray(timed)) {
    return timed;
  }

  const normalized = timed.map((line, idx) => {
    let start = line?.start_time != null ? Number(line.start_time) : null;
    // Convert seconds->milliseconds if unit ambiguous (most providers give seconds)
    if (start != null && start < 1000) {
      // treat as seconds (e.g., 12.34 -> 12340 ms)
      start = Math.round(start * 1000);
    }
    const text = (line?.text ?? line?.lyric ?? line?.line ?? '').toString().trim();
    return {
      id: line?.id ?? `${start ?? 'n'}_${idx}`,
      start_time: start,
      end_time: null,
      text,
    };
  });

  for (let i = 0; i < normalized.length; i++) {
    if (i + 1 < normalized.length && normalized[i + 1].start_time != null) {
      normalized[i].end_time = normalized[i + 1].start_time - 1;
    } else {
      // If no next line, give a reasonable default end_time (15s window) if start_time exists
      normalized[i].end_time = normalized[i].start_time != null ? normalized[i].start_time + 15000 : null;
    }
  }

  return normalized;
}

async function getSaavnSuggestions(query) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&ctx=wap6dot0&api_version=4&query=${encodeURIComponent(
      query,
    )}`;
    const response = await axios.get(url);
    const suggestions = [];

    if (response.data) {
      if (response.data.albums && response.data.albums.data) {
        response.data.albums.data
          .slice(0, 5)
          .forEach(album => suggestions.push(album.title));
      }
      if (response.data.songs && response.data.songs.data) {
        response.data.songs.data
          .slice(0, 15)
          .forEach(song => suggestions.push(song.title));
      }
    }
    return {suggestions, quickResults: []};
  } catch (error) {
    return {suggestions: [], quickResults: []};
  }
}

async function getYTMusicSuggestions(query) {
  try {
    const response = await axios.post(
      'https://music.youtube.com/youtubei/v1/music/get_search_suggestions?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      {
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241204.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        input: query,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://music.youtube.com',
        },
      },
    );

    const suggestions = [];
    if (response.status === 200 && response.data) {
      const items =
        response.data?.contents?.[0]?.searchSuggestionsSectionRenderer
          ?.contents || [];
      items.forEach(item => {
        // Use the full query from navigationEndpoint (most accurate),
        // or concatenate all runs to get the complete suggestion text
        const renderer = item?.searchSuggestionRenderer;
        const text =
          renderer?.navigationEndpoint?.searchEndpoint?.query ||
          renderer?.suggestion?.runs?.map(r => r.text).join('') ||
          '';
        if (text) {
          suggestions.push(text);
        }
      });
      return {suggestions, quickResults: []};
    }

    // Non-200 status — fallback
    console.warn(
      `YTMusic suggestions API returned status ${response.status}. Falling back to YouTube suggestions for query: "${query}"`,
    );
    try {
      const fallback = await getYoutubeSuggestions(query);
      return {suggestions: fallback.suggestions || [], quickResults: []};
    } catch (e) {
      return {suggestions: [], quickResults: []};
    }
  } catch (error) {
    // Fail silently for unreliable YT Music endpoint — return empty suggestions.
    // Don't fallback to YouTube suggestions; we want each engine to run independently.

    return {suggestions: [], quickResults: []};
  }
}

async function getYoutubeSuggestions(query) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(
      query,
    )}`;
    const suggestionsResponse = await axios.get(url);
    const suggestions = suggestionsResponse.data?.[1] || [];
    return {suggestions, quickResults: []};
  } catch (error) {
    return {suggestions: [], quickResults: []};
  }
}

const suggestionCache = new Map();

async function getSearchSuggestions(query) {
  if (!query) {
    return {suggestions: [], quickResults: []};
  }

  const cacheKey = query.trim().toLowerCase();
  if (suggestionCache.has(cacheKey)) {
    return suggestionCache.get(cacheKey);
  }

  try {
    // Allow suggestion engines to take their time on slow networks — don't short-circuit
    const results = await Promise.allSettled([
      getSaavnSuggestions(query),
      getYTMusicSuggestions(query),
      getYoutubeSuggestions(query),
    ]);

    const saavn =
      results[0].status === 'fulfilled'
        ? results[0].value
        : {suggestions: [], quickResults: []};
    const ytMusic =
      results[1].status === 'fulfilled'
        ? results[1].value
        : {suggestions: [], quickResults: []};
    const youtube =
      results[2].status === 'fulfilled'
        ? results[2].value
        : {suggestions: [], quickResults: []};

    // Log any engines that rejected for debugging
    const failedEngines = [];
    if (results[0].status !== 'fulfilled') {
      failedEngines.push('Saavn');
    }
    if (results[1].status !== 'fulfilled') {
      failedEngines.push('YTMusic');
    }
    if (results[2].status !== 'fulfilled') {
      failedEngines.push('YouTube');
    }
    if (failedEngines.length) {
      // Not fatal; surface information to logs at info level so we can monitor engine availability

    }

    // Combine suggestions with a prioritized round-robin approach
    const combinedSuggestions = [];
    const seenLower = new Set();
    const maxSuggestions = 40;
    const suggestionSources = [
      saavn.suggestions,
      ytMusic.suggestions,
      youtube.suggestions,
    ];

    let j = 0;
    while (combinedSuggestions.length < maxSuggestions) {
      let addedInThisRound = false;
      for (const source of suggestionSources) {
        if (source[j]) {
          const lower = source[j].trim().toLowerCase();
          if (lower && !seenLower.has(lower)) {
            seenLower.add(lower);
            combinedSuggestions.push(source[j].trim());
          }
          addedInThisRound = true;
        }
        if (combinedSuggestions.length >= maxSuggestions) {
          break;
        }
      }
      if (!addedInThisRound) {
        break;
      }
      j++;
    }

    const finalResult = {
      suggestions: combinedSuggestions,
      quickResults: [],
    };

    // Keep cache size manageable (max 100 entries)
    if (suggestionCache.size > 100) {
      const firstKey = suggestionCache.keys().next().value;
      suggestionCache.delete(firstKey);
    }
    suggestionCache.set(cacheKey, finalResult);

    return finalResult;
  } catch (error) {
    return {suggestions: [], quickResults: []};
  }
}

async function getSearchSongData(searchText, page, limit) {
  const baseUrl = 'https://www.jiosaavn.com/api.php';
  const defaultParams = {
    ctx: 'wap6dot0',
    api_version: 4,
    _format: 'json',
    _marker: 0,
  };
  const sources = {
    song_search: '__call=search.getResults&n=' + limit,
  };

  const urls = [
    `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${searchText}&page=${page}&limit=${limit}`,
    `https://jio-saavan-api.vercel.app/search/songs?query=${searchText}&page=${page}&limit=${limit}`,
    `${baseUrl}?${Object.keys(defaultParams)
      .map(k => `${k}=${defaultParams[k]}`)
      .join('&')}&${sources.song_search}&q=${encodeURIComponent(
      searchText,
    )}&p=${page}`,
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
  throw new Error('All search API instances failed');
}

async function getYTSearchSongData(searchText, page, limit) {
  // STRATEGY 1: Try YouTube Music InnerTube API (actual YT Music content)
  // This is the API used by music.youtube.com - returns actual music, not random videos
  try {
    const response = await axios.post(
      'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      {
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241204.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        query: searchText,
        params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ==', // Filter for songs
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com/search',
        },
      },
    );

    if (response.status === 200) {
      const data = response.data;

      // Parse YouTube Music response structure
      const contents =
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const songs = [];

        for (const section of contents) {
          const musicShelf = section.musicShelfRenderer;
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

            // Extract artist - collect all artists from runs until separator
            const artistRuns =
              musicItem.flexColumns?.[1]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            let artists = [];
            let artistString = '';
            if (artistRuns && artistRuns.length > 0) {
              for (const run of artistRuns) {
                const text = run.text || '';
                // Stop at separators like "•" or other non-artist text
                if (
                  text.includes('•') ||
                  text.includes('·') ||
                  text.includes('•') ||
                  text.trim() === ''
                ) {
                  break;
                }
                if (text.trim()) {
                  artists.push({name: text.trim()});
                  artistString += (artistString ? ', ' : '') + text.trim();
                }
              }
              // Fallback to first run if no artists found
              if (artists.length === 0) {
                artists = [{name: artistRuns[0]?.text || 'Unknown'}];
                artistString = artistRuns[0]?.text || 'Unknown';
              }
            } else {
              artists = [{name: 'Unknown'}];
              artistString = 'Unknown';
            }

            // Extract thumbnail - try multiple possible paths for robustness
            const thumbnails =
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail
                ?.thumbnails ||
              musicItem.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
                ?.thumbnails ||
              musicItem.thumbnail?.thumbnail?.thumbnails ||
              musicItem.thumbnail?.thumbnails ||
              musicItem.thumbnailRenderer?.thumbnail?.thumbnails ||
              musicItem.thumbnails ||
              [];

            let thumbnail =
              thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url;

            // Handle missing thumbnails with a reliable construct
            if (!thumbnail && videoId) {
              thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            } else if (!thumbnail) {
              thumbnail =
                'https://via.placeholder.com/544x544/cccccc/000000?text=No+Img';
            }

            // Ensure protocol
            if (thumbnail.startsWith('//')) {
              thumbnail = 'https:' + thumbnail;
            }

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            // Extract duration
            const durationText =
              musicItem.flexColumns?.[musicItem.flexColumns.length - 1]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
                ?.text;
            const duration = parseDuration(durationText) || 0;

            // Detect language
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

            const detectedLanguage = detectLanguage(title + ' ' + artistString);

            // Extract album info
            const albumRun =
              musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.find(
                r =>
                  r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith(
                    'MPREb_',
                  ),
              );
            const albumName = albumRun?.text || '';
            const albumId =
              albumRun?.navigationEndpoint?.browseEndpoint?.browseId || '';

            songs.push({
              id: videoId,
              name: title,
              title: title,
              image: [{url: thumbnail}, {url: thumbnail}, {url: thumbnail}],
              artist: artistString,
              artists: {primary: artists},
              album: {
                name: albumName,
                id: albumId,
              },
              url: videoId,
              downloadUrl: videoId,
              duration: duration,
              language: detectedLanguage,
              source: 'ytmusic',
            });

            if (songs.length >= limit) {
              break;
            }
          }

          if (songs.length >= limit) {
            break;
          }
        }

        if (songs.length > 0) {
          return {data: {results: songs}};
        }
      }
    }
  } catch (error) {
    // YouTube Music API failed
  }

  // Fallback: If no results found with strict filter, try a broader search
  try {
    const broadSearch = await axios.post(
      'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      {
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241204.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        query: searchText,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://music.youtube.com',
        },
      },
    );

    if (broadSearch.status === 200) {
      const data = broadSearch.data;
      const songs = [];
      const contents =
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents || [];

      for (const section of contents) {
        const musicShelf = section.musicShelfRenderer;
        if (musicShelf && musicShelf.contents) {
          for (const item of musicShelf.contents) {
            const musicItem = item.musicResponsiveListItemRenderer;
            const videoId =
              musicItem?.playlistItemData?.videoId ||
              musicItem?.overlay?.musicItemThumbnailOverlayRenderer?.content
                ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
                ?.videoId;
            if (!videoId) {
              continue;
            }
            const title =
              musicItem.flexColumns?.[0]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
                ?.text;
            const artist =
              musicItem.flexColumns?.[1]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
                ?.text;
            const thumbnail =
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail
                ?.thumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            songs.push({
              id: videoId,
              name: title,
              title: title,
              image: [{url: thumbnail}, {url: thumbnail}, {url: thumbnail}],
              artist: artist || 'Unknown',
              artists: {primary: [{name: artist || 'Unknown'}]},
              url: videoId,
              downloadUrl: videoId,
              source: 'ytmusic',
            });
            if (songs.length >= limit) {
              break;
            }
          }
        }
        if (songs.length >= limit) {
          break;
        }
      }
      if (songs.length > 0) {
        return {data: {results: songs}};
      }
    }
  } catch (e) {}

  return {data: {results: []}};
}

async function getYTSearchAlbumData(searchText, page, limit) {
  // STRATEGY 1: Try YouTube Music InnerTube API for actual albums
  try {
    const innerTubeResponse = await fetch(
      'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com/search',
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
          query: searchText,
          params: 'EgWKAQIYAWoKEAMQBBAJEAoQBQ==', // Filter for albums
        }),
        timeout: 15000,
      },
    );

    if (innerTubeResponse.ok) {
      const data = await innerTubeResponse.json();
      const contents =
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const albums = [];

        for (const section of contents) {
          const musicShelf = section.musicShelfRenderer;
          if (!musicShelf || !musicShelf.contents) {
            continue;
          }

          for (const item of musicShelf.contents) {
            const musicItem = item.musicResponsiveListItemRenderer;
            if (!musicItem) {
              continue;
            }

            // Extract browse ID for album
            const browseId =
              musicItem.navigationEndpoint?.browseEndpoint?.browseId;
            if (!browseId) {
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

            // Extract thumbnail
            let thumbnail =
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(
                -1,
              )[0]?.url ||
              'https://via.placeholder.com/544x544/cccccc/000000?text=No+Img';

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            albums.push({
              id: browseId,
              name: title,
              image: [{url: thumbnail}, {url: thumbnail}, {url: thumbnail}],
              artists: {primary: [{name: artist}]},
              source: 'ytmusic',
            });

            if (albums.length >= limit) {
              break;
            }
          }

          if (albums.length >= limit) {
            break;
          }
        }

        if (albums.length > 0) {
          return {data: {results: albums}};
        }
      }
    }
  } catch (error) {}

  // No fallback to Invidious - use InnerTube only
  return {data: {results: []}};
}

async function getYTSearchPlaylistData(searchText, page, limit) {
  // STRATEGY 1: Try YouTube Music InnerTube API for curated playlists
  // IMPORTANT: UI components expect a Saavn-like shape for playlists:
  //   - title/name
  //   - image[] entries with `.link`
  //   - songCount (optional, used to detect Saavn shape)
  // Also playlist browseId is usually like "VL...". Our getPlaylistData routes VL/RDAMPL/OLAK/PL to YTMusic browse.
  try {
    const innerTubeResponse = await fetch(
      'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com/search',
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
          query: searchText,
          params: 'EgWKAQIoAWoKEAMQBBAJEAoQBQ==', // Filter for playlists
        }),
        timeout: 15000,
      },
    );

    if (innerTubeResponse.ok) {
      const data = await innerTubeResponse.json();
      const contents =
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const playlists = [];

        for (const section of contents) {
          const musicShelf = section.musicShelfRenderer;
          if (!musicShelf || !musicShelf.contents) {
            continue;
          }

          for (const item of musicShelf.contents) {
            const musicItem = item.musicResponsiveListItemRenderer;
            if (!musicItem) {
              continue;
            }

            // Extract browse ID for playlist
            const browseId =
              musicItem.navigationEndpoint?.browseEndpoint?.browseId;
            if (!browseId) {
              continue;
            }

            // Extract title
            const title =
              musicItem.flexColumns?.[0]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
                ?.text || 'Unknown';

            // Extract song count (if present)
            const metaRuns =
              musicItem.flexColumns?.[1]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            const metaText = Array.isArray(metaRuns)
              ? metaRuns.map(r => r.text).join('')
              : '';
            const songCountMatch = metaText.match(/(\d+)\s*(song|songs)/i);
            const songCount = songCountMatch
              ? parseInt(songCountMatch[1], 10)
              : undefined;

            // Extract thumbnail
            let thumbnail =
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(
                -1,
              )[0]?.url ||
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail
                ?.thumbnails?.[0]?.url ||
              'https://via.placeholder.com/544x544/cccccc/000000?text=No+Img';

            if (thumbnail && thumbnail.startsWith('//')) {
              thumbnail = 'https:' + thumbnail;
            }

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            // Return in Saavn-compatible shape (so existing UI doesn't show empty)
            const imageArr = [
              {quality: '50x50', link: thumbnail, url: thumbnail},
              {quality: '150x150', link: thumbnail, url: thumbnail},
              {quality: '500x500', link: thumbnail, url: thumbnail},
            ];

            playlists.push({
              id: browseId,
              // provide both name and title for safety across components
              name: title,
              title: title,
              image: imageArr,
              // make PlaylistDisplay treat it like Saavn (so it uses playlist.name and playlist.songCount)
              songCount: songCount,
              follower: songCount ? `Total ${songCount} Songs` : '',
              source: 'ytmusic',
              type: 'playlist',
            });

            if (playlists.length >= limit) {
              break;
            }
          }

          if (playlists.length >= limit) {
            break;
          }
        }

        if (playlists.length > 0) {
          return {data: {results: playlists}};
        }
      }
    }
  } catch (error) {
    // ignore; return empty below
  }

  // No fallback to Invidious - use InnerTube only
  return {data: {results: []}};
}

async function getLyricsSongData(id) {
  const urls = [
    `https://jiosaavn-api-privatecvc2.vercel.app/lyrics?id=${id}`,
    `https://jio-saavan-api.vercel.app/lyrics?id=${id}`,
  ];
  // Note: removed the direct jiosaavn.com lyrics.php endpoint — it requires a lyrics_id and
  // does not work with the song id. Use the wrapper endpoint above which is reliable when
  // lyrics are available.


  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: baseUrl,
        headers: {},
      };
      const response = await axios.request(config);
      return response.data;
    } catch (e) {
      continue;
    }
  }
  throw new Error('All lyrics API instances failed');
}

// Global fetch lock for lyrics to prevent redundant/parallel requests
const lyricsFetchLock = new Map();

async function getYTLyricsSongData(
  artist,
  title,
  preferredLanguage,
  isYouTubeMusic = false,
  requestedSource = 'All',
) {
  if (!artist || !title) {
    return {success: false, data: {lyrics: 'Missing Info'}};
  }

  const persistentKey =
    `lyrics_${artist}_${title}_${requestedSource}_${preferredLanguage}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');

  // Check if there's an existing request, but don't return it if it's too old (hung)
  if (lyricsFetchLock.has(persistentKey)) {
    const existing = lyricsFetchLock.get(persistentKey);
    if (existing && existing.timestamp && Date.now() - existing.timestamp < 30000) {
      // Return existing promise if it's not too old
      return existing.promise;
    } else {
      // Remove old/stuck promise
      lyricsFetchLock.delete(persistentKey);
    }
  }

  const fetchPromise = (async () => {
    try {
      const cacheOptions = {type: 'lyrics', expiration: 60 * 24 * 7};
      if (requestedSource === 'RenderAPI') {
        // Force a fresh fetch when the user explicitly requests RenderAPI to avoid stale/partial cache
        cacheOptions.forceRefresh = true;
      }

      return await getCachedData(
        persistentKey,
        async () => {

            const apis = [
            // NOTE: RenderAPI is deprecated but available on-demand. When a user
            // explicitly selects 'RenderAPI' we will try other providers first and
            // fall back to RenderAPI (appended last) so it acts as a last-resort.
            {
              name: 'RenderAPI',
              url: `https://test-0k.onrender.com/lyrics/?artist=${encodeURIComponent(
                artist,
              )}&song=${encodeURIComponent(
                title,
              )}&timestamps=true&pass=false`,
              timeout: 20000, // Add 20 second timeout for RenderAPI
              transform: async data => {
                if (data.data?.lyrics) {
                  const lyricsText = data.data.lyrics;

                  // Check if lyrics contain timestamps
                  const hasTimestamps = /\[\d+:\d+\.\d+\]/.test(lyricsText);

                  if (hasTimestamps) {
                    // Parse timed lyrics from the lyrics string
                    const lines = lyricsText.split(/\r?\n/).filter(l => l.trim());
                    const timed_lyrics = [];
                    let plainLyrics = '';

                    for (const line of lines) {
                      const m = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
                      if (m) {
                        const minutes = parseInt(m[1], 10);
                        const seconds = parseFloat(m[2]);
                        const start_time = Math.round((minutes * 60 + seconds) * 1000);
                        const text = m[3].trim();
                        if (text) {
                          timed_lyrics.push({start_time, text});
                          plainLyrics += text + '\n';
                        }
                      } else if (line.trim()) {
                        // Line without timestamp
                        timed_lyrics.push({start_time: null, text: line.trim()});
                        plainLyrics += line.trim() + '\n';
                      }
                    }

                    return {
                      success: true,
                      data: {
                        lyrics: plainLyrics.trim() || null,
                        timed_lyrics,
                      },
                    };
                  } else {
                    // Plain lyrics without timestamps
                    return {
                      success: true,
                      data: {
                        lyrics: lyricsText,
                        timed_lyrics: data.data.timed_lyrics || [],
                      },
                    };
                  }
                }
                if (data.data?.timestamped) {
                  // Legacy format with separate timestamped field
                  const lines = data.data.timestamped.split(/\r?\n/).filter(l => l.trim());
                  const timed_lyrics = [];
                  for (const line of lines) {
                    const m = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
                    if (m) {
                      const minutes = parseInt(m[1], 10);
                      const seconds = parseFloat(m[2]);
                      const start_time = Math.round((minutes * 60 + seconds) * 1000);
                      const text = m[3].trim();
                      if (text) {
                        timed_lyrics.push({start_time, text});
                      }
                    } else {
                      timed_lyrics.push({start_time: null, text: line.trim()});
                    }
                  }
                  const plain = data.data.timestamped.replace(/\[\d+:\d+\.\d+\]\s*/g, '').trim();
                  return { success: true, data: { lyrics: plain || null, timed_lyrics } };
                }
                return null;
              },
            },


            {
              name: 'LRCLib',
              url: `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
              // No timeout set per user request
              transform: async data => {
                try {
                  // Preferred LRCLib structured response: { plainLyrics, syncedLyrics }
                  if (data?.plainLyrics || data?.syncedLyrics) {
                    const lyrics = data.plainLyrics ? String(data.plainLyrics).trim() : null;
                    const synced = data.syncedLyrics ? String(data.syncedLyrics) : null;

                    const timed_lyrics = [];
                    if (synced) {
                      const lines = synced.split(/\r?\n/).filter(l => l.trim());
                      for (const line of lines) {
                        const m = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
                        if (m) {
                          const minutes = parseInt(m[1], 10);
                          const seconds = parseFloat(m[2]);
                          const start_time = Math.round((minutes * 60 + seconds) * 1000);
                          timed_lyrics.push({start_time, text: m[3].trim()});
                        } else {
                          timed_lyrics.push({start_time: null, text: line.trim()});
                        }
                      }
                    } else if (lyrics) {
                      // attempt to parse timestamps embedded in plainLyrics
                      const lines = lyrics.split(/\r?\n/).filter(l => l.trim());
                      let foundTimestamp = false;
                      for (const line of lines) {
                        const m = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
                        if (m) {
                          foundTimestamp = true;
                          const minutes = parseInt(m[1], 10);
                          const seconds = parseFloat(m[2]);
                          const start_time = Math.round((minutes * 60 + seconds) * 1000);
                          timed_lyrics.push({start_time, text: m[3].trim()});
                        } else {
                          timed_lyrics.push({start_time: null, text: line.trim()});
                        }
                      }
                      if (!foundTimestamp) {
                        // no timestamps found - clear timed_lyrics
                        timed_lyrics.length = 0;
                      }
                    }

                    return {
                      success: true,
                      data: {
                        lyrics: lyrics || null,
                        timed_lyrics: timed_lyrics,
                      },
                    };
                  }

                  // Backwards compatibility: handle raw string responses or {lyrics}
                  const raw = data?.result || data?.lyrics || data;
                  if (!raw) {
                    return null;
                  }

                  if (typeof raw === 'string') {
                    const lines = raw.split(/\r?\n/).filter(l => l.trim());
                    const timed_lyrics = [];
                    let foundTimestamp = false;
                    for (const line of lines) {
                      const m = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
                      if (m) {
                        foundTimestamp = true;
                        const minutes = parseInt(m[1], 10);
                        const seconds = parseFloat(m[2]);
                        const start_time = Math.round((minutes * 60 + seconds) * 1000);
                        timed_lyrics.push({start_time, text: m[3].trim()});
                      } else {
                        timed_lyrics.push({start_time: null, text: line.trim()});
                      }
                    }
                    return {
                      success: true,
                      data: {
                        lyrics: raw.replace(/\[(\d+):(\d+\.\d+)\]\s*/g, '').trim() || null,
                        timed_lyrics: foundTimestamp ? timed_lyrics : [],
                      },
                    };
                  }

                  if (data?.lyrics) {
                    return { success: true, data: { lyrics: data.lyrics } };
                  }
                } catch (e) {}
                return null;
              },
            },

            {
              name: 'JioSaavn',
              url: null,
              transform: async () => {
                try {
                  // Use the reliable wrapper which provides /api/search and /api/songs/{id}/lyrics
                  const search = await axios.get(
                    `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(
                      artist + ' ' + title,
                    )}&limit=5`,
                  );
                  const songs = search.data?.data?.results || search.data?.results || [];
                  if (songs && songs.length > 0) {
                    // Prefer same-language match when available
                    let selected = songs[0];
                    const langLower = (preferredLanguage || '').toLowerCase();
                    if (langLower) {
                      const match = songs.find(s => (s.language || '').toLowerCase() === langLower);
                      if (match) {
                        selected = match;
                      }
                    }
                    const songId = selected?.id;
                    if (songId) {
                      try {
                        const lyricsResponse = await axios.get(
                          `https://jiosaavn-api-privatecvc2.vercel.app/lyrics?id=${songId}`,
                        );
                        const lyricsData = lyricsResponse.data;
                        if (lyricsData?.data?.lyrics || lyricsData?.lyrics) {
                          return {success: true, data: {lyrics: lyricsData.data?.lyrics || lyricsData.lyrics}};
                        }
                      } catch (e) {
                        // continue to other providers
                      }
                    }
                  }
                } catch (e) {}
                return null;
              },
            },
          ];

          const filteredApis =
            requestedSource === 'All'
              ? apis
              : apis.filter(api => api.name === requestedSource);

          // If requested specific source is not available, return gracefully
          if (requestedSource !== 'All' && filteredApis.length === 0) {

            return {success: false, data: {lyrics: 'Requested source unavailable'}};
          }

          // If All, run sources in parallel and pick best result; otherwise run only the selected source(s)
          if (requestedSource === 'All') {
            const workers = filteredApis.map(api =>
              (async () => {
                try {
                  if (!api.url) {
                    // API has its own internal calls
                    const res = await api.transform(null);
                    if (res) {
                      return {api: api.name, res};
                    }
                    return null;
                  }
                  // In 'All' mode we intentionally do not set a timeout so provider
                  // endpoints can take their time and succeed on slow networks.
                  const response = await axios.get(api.url, {
                    timeout: 15000,
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                      'Accept': 'application/json, text/plain, */*',
                      'Accept-Language': 'en-US,en;q=0.9',
                    },
                  });
                  const result = await api.transform(response.data);
                  if (result) {
                    return {api: api.name, res: result};
                  }
                  return null;
                } catch (e) {
                  return null;
                }
              })(),
            );

            const settled = await Promise.all(workers);
            const successes = settled.filter(Boolean);

            // Choose the best provider among successes by scoring completeness.
            // Prefer providers with timed_lyrics (more lines preferred), otherwise prefer
            // the provider with the longest plain lyrics string. This reduces cases where
            // a fast-but-truncated provider wins over a slower but complete provider.
            let chosen = null;
            let bestScore = -1;
            for (const s of successes) {
              const res = s.res;
              let score = 0;

              // Prefer timed lyrics; give higher base score so it's always chosen over plain text
              if (res?.data?.timed_lyrics && Array.isArray(res.data.timed_lyrics)) {
                const length = res.data.timed_lyrics.length;
                score = 1000 + length;
              } else if (Array.isArray(res?.timed_lyrics)) {
                score = 1000 + res.timed_lyrics.length;
              } else if (res?.data?.lyrics) {
                score = String(res.data.lyrics).length;
              } else if (res?.lyrics) {
                score = String(res.lyrics).length;
              }

              if (score > bestScore) {
                bestScore = score;
                chosen = s;
              }
            }

            if (chosen) {
              // annotate returned result with source name for telemetry and UI debugging
              try { chosen.res.source = chosen.api; } catch (e) {}
              // Also embed the source into the data object so callers that only use data
              // (e.g., refreshLyrics returns Lyrics.data) can still see which provider was used.
              try { if (chosen.res?.data) {chosen.res.data.source = chosen.api;} } catch (e) {}
              try {
                if (chosen.res?.data?.timed_lyrics) {
                  chosen.res.data.timed_lyrics = normalizeTimedLyrics(chosen.res.data.timed_lyrics);
                } else if (chosen.res?.timed_lyrics) {
                  chosen.res.timed_lyrics = normalizeTimedLyrics(chosen.res.timed_lyrics);
                }
              } catch (e) {}

              return chosen.res;
            }
          } else {
            const attemptedSources = [];
            const errorsBySource = {};
            // For single-source requests, retry the selected provider a couple of times
            const maxAttempts = 2;

            for (const api of filteredApis) {
              attemptedSources.push(api.name || api.url || 'unknown');

              // APIs without URLs are internal transforms
              if (!api.url) {
                try {
                  const res = await api.transform(null);
                  if (res) {
                    try { res.source = api.name; } catch (e) {}
                    try { if (res?.data) {res.data.source = api.name;} } catch (e) {}
                    try {
                      if (res?.data?.timed_lyrics) {
                        res.data.timed_lyrics = normalizeTimedLyrics(res.data.timed_lyrics);
                      } else if (res?.timed_lyrics) {
                        res.timed_lyrics = normalizeTimedLyrics(res.timed_lyrics);
                      }
                    } catch (e) {}
                    res.attemptedSources = attemptedSources;
                    return res;
                  }
                  continue;
                } catch (e) {
                  errorsBySource[api.name || api.url || 'unknown'] = e && (e.message || String(e));
                  continue;
                }
              }

              // Try with retries for network robustness (useful for selected provider)
              let lastError = null;
              for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {

                  const response = await axios.get(api.url, {
                    timeout: api.timeout || 10000,
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                      'Accept': 'application/json, text/plain, */*',
                      'Accept-Language': 'en-US,en;q=0.9',
                    },
                  });
                  const result = await api.transform(response.data);
                  if (result) {
                    try { result.source = api.name; } catch (e) {}
                    try { if (result?.data) {result.data.source = api.name;} } catch (e) {}
                    try {
                      if (result?.data?.timed_lyrics) {
                        result.data.timed_lyrics = normalizeTimedLyrics(result.data.timed_lyrics);
                      } else if (result?.timed_lyrics) {
                        result.timed_lyrics = normalizeTimedLyrics(result.timed_lyrics);
                      }
                    } catch (e) {}

                    result.attemptedSources = attemptedSources;
                    return result;
                  }
                  // If no result, break and record
                  lastError = new Error('No result from transform');
                  break;
                } catch (err) {
                  lastError = err;
                  const status = err?.response?.status;
                  const statusText = err?.response?.statusText || err.message;
                  errorsBySource[api.name || api.url || 'unknown'] = status ? `HTTP ${status} ${statusText}` : (err.message || String(err));
                  // Small backoff before retry
                  if (attempt < maxAttempts) {
                    await new Promise(res => setTimeout(res, 250 * attempt));
                    continue;
                  }
                }
              }

              // If we exhausted attempts and no result, continue to next api (for specific-source it's usually a single api)
              if (lastError) {
                continue;
              }
            }

            // Nothing returned - include information about attempted sources for UX
            return {
              success: false,
              data: {
                lyrics: 'No Lyrics Found',
                attemptedSources: attemptedSources,
                errorsBySource: errorsBySource,
              },
            };
          }

          if (
            preferredLanguage &&
            !['en', 'english'].includes(preferredLanguage.toLowerCase())
          ) {
            const fallback = await getYTLyricsSongData(
              artist,
              title,
              'en',
              isYouTubeMusic,
              requestedSource,
            );
            if (fallback?.success) {
              return fallback;
            }
          }

          return {success: false, data: {lyrics: 'No Lyrics Found'}};
        },
        {type: 'lyrics', expiration: 60 * 24 * 7},
      );
    } catch (err) {
      return {success: false, data: {lyrics: 'No Lyrics Found'}};
    } finally {
      lyricsFetchLock.delete(persistentKey);
    }
  })();

  lyricsFetchLock.set(persistentKey, {promise: fetchPromise, timestamp: Date.now()});
  return fetchPromise;
}

async function getYTSearchVideoData(searchText, page, limit) {
  // Use YouTube InnerTube API (primary)
  try {
    const response = await axios.post(
      'https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20241204.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        query: searchText,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://www.youtube.com',
          Referer: 'https://www.youtube.com/results',
        },
      },
    );

    if (response.status === 200) {
      const data = response.data;

      // Parse YouTube InnerTube response structure
      const contents =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
          ?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const videos = [];

        for (const section of contents) {
          const itemSection = section.itemSectionRenderer;
          if (!itemSection || !itemSection.contents) {
            continue;
          }

          for (const item of itemSection.contents) {
            const videoRenderer = item.videoRenderer;
            if (!videoRenderer) {
              continue;
            }

            const videoId = videoRenderer.videoId;
            if (!videoId) {
              continue;
            }

            // Extract title
            const title = videoRenderer.title?.runs?.[0]?.text || 'Unknown';

            // Extract channel name
            const channelName =
              videoRenderer.ownerText?.runs?.[0]?.text || 'Unknown';

            // Extract thumbnail - try multiple paths for robustness
            const thumbnails =
              videoRenderer.thumbnail?.thumbnails ||
              videoRenderer.thumbnails ||
              [];
            let thumbnail =
              thumbnails[thumbnails.length - 1]?.url ||
              thumbnails[0]?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            // Ensure protocol
            if (thumbnail.startsWith('//')) {
              thumbnail = 'https:' + thumbnail;
            }

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            // Use hqdefault for YouTube search results instead of maxresdefault for better compatibility
            if (thumbnail.includes('i.ytimg.com/vi/')) {
              thumbnail = thumbnail.replace(
                /(maxresdefault|sddefault|mqdefault)\.jpg/,
                'hqdefault.jpg',
              );
            }

            // Extract duration from lengthText
            const durationText = videoRenderer.lengthText?.simpleText;
            const duration = parseDuration(durationText) || 0;

            videos.push({
              id: videoId,
              name: title,
              image: [{url: thumbnail}, {url: thumbnail}, {url: thumbnail}],
              artists: {primary: [{name: channelName}]},
              downloadUrl: videoId,
              duration: duration,
              language: 'en',
              source: 'youtube',
            });

            if (videos.length >= limit) {
              break;
            }
          }

          if (videos.length >= limit) {
            break;
          }
        }

        if (videos.length > 0) {
          return {data: {results: videos}};
        }
      }
    }
  } catch (error) {
    // InnerTube API also failed
  }

  throw new Error('All YouTube API instances failed');
}

async function getSongData(id) {
  const baseUrl = 'https://www.jiosaavn.com/api.php';
  const defaultParams = {
    ctx: 'wap6dot0',
    api_version: 4,
    _format: 'json',
    _marker: 0,
  };
  const sources = {
    song_detail: '__call=webapi.get&type=song&includeMetaTags=0',
  };

  const urls = [
    `https://jiosaavn-api-privatecvc2.vercel.app/songs?id=${id}`,
    `https://jio-saavan-api.vercel.app/songs?id=${id}`,
    `${baseUrl}?${Object.keys(defaultParams)
      .map(k => `${k}=${defaultParams[k]}`)
      .join('&')}&${sources.song_detail}&id=${id}`,
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
  throw new Error('All song data API instances failed');
}

export {
  getSearchSongData,
  getLyricsSongData,
  getYTSearchSongData,
  getYTSearchVideoData,
  getSongData,
  getYTLyricsSongData,
  getYTSearchAlbumData,
  getYTSearchPlaylistData,
  getSearchSuggestions,
};
