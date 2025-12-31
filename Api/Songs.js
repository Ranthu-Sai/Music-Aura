export * from './Saavn/Songs';
import axios from "axios";
import YTArtworkUtils from "../Utils/YTMusicArtworkUtils";

// Configure axios for better Android compatibility
axios.defaults.timeout = 15000;
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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

async function getSaavnSuggestions(query) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&ctx=wap6dot0&api_version=4&query=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    const suggestions = [];

    if (response.data) {
      if (response.data.albums && response.data.albums.data) {
        response.data.albums.data.slice(0, 5).forEach(album => suggestions.push(album.title));
      }
      if (response.data.songs && response.data.songs.data) {
        response.data.songs.data.slice(0, 15).forEach(song => suggestions.push(song.title));
      }
    }
    return { suggestions, quickResults: [] };
  } catch (error) {
    return { suggestions: [], quickResults: [] };
  }
}

async function getYTMusicSuggestions(query) {
  try {
    const response = await axios.post('https://music.youtube.com/youtubei/v1/search/get_search_suggestions?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241204.01.00', hl: 'en', gl: 'US' } },
      input: query,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
      },
    });

    const suggestions = [];
    if (response.status === 200) {
      const items = response.data?.contents?.[0]?.searchSuggestionsSectionRenderer?.contents || [];
      items.forEach(item => {
        const text = item?.searchSuggestionRenderer?.suggestion?.runs?.[0]?.text;
        if (text) suggestions.push(text);
      });
    }

    return { suggestions, quickResults: [] };
  } catch (error) {
    return { suggestions: [], quickResults: [] };
  }
}

async function getYoutubeSuggestions(query) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    const suggestionsResponse = await axios.get(url);
    const suggestions = suggestionsResponse.data?.[1] || [];
    return { suggestions, quickResults: [] };
  } catch (error) {
    return { suggestions: [], quickResults: [] };
  }
}

const suggestionCache = new Map();

async function getSearchSuggestions(query) {
  if (!query) return { suggestions: [], quickResults: [] };

  const cacheKey = query.trim().toLowerCase();
  if (suggestionCache.has(cacheKey)) {
    return suggestionCache.get(cacheKey);
  }

  try {
    // Set a timeout for individual promises to ensure slow APIs don't hold up the results
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve({ suggestions: [], quickResults: [] }), ms))
    ]);

    const results = await Promise.allSettled([
      withTimeout(getSaavnSuggestions(query), 1800),
      withTimeout(getYTMusicSuggestions(query), 1800),
      withTimeout(getYoutubeSuggestions(query), 1800)
    ]);

    const saavn = results[0].status === 'fulfilled' ? results[0].value : { suggestions: [], quickResults: [] };
    const ytMusic = results[1].status === 'fulfilled' ? results[1].value : { suggestions: [], quickResults: [] };
    const youtube = results[2].status === 'fulfilled' ? results[2].value : { suggestions: [], quickResults: [] };

    // Combine suggestions with a prioritized approach
    const combinedSuggestions = [];
    const maxSuggestions = 40;
    const suggestionSources = [ytMusic.suggestions, youtube.suggestions, saavn.suggestions];

    let j = 0;
    while (combinedSuggestions.length < maxSuggestions) {
      let addedInThisRound = false;
      for (const source of suggestionSources) {
        if (source[j]) {
          if (!combinedSuggestions.includes(source[j])) {
            combinedSuggestions.push(source[j]);
          }
          addedInThisRound = true;
        }
        if (combinedSuggestions.length >= maxSuggestions) break;
      }
      if (!addedInThisRound) break;
      j++;
    }

    const finalResult = {
      suggestions: combinedSuggestions,
      quickResults: []
    };

    // Keep cache size manageable (max 100 entries)
    if (suggestionCache.size > 100) {
      const firstKey = suggestionCache.keys().next().value;
      suggestionCache.delete(firstKey);
    }
    suggestionCache.set(cacheKey, finalResult);

    return finalResult;
  } catch (error) {
    return { suggestions: [], quickResults: [] };
  }
}

async function getSearchSongData(searchText, page, limit) {
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    song_search: "__call=search.getResults&n=" + limit,
  };

  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/search/songs?query=${searchText}&page=${page}&limit=${limit}`,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.song_search}&q=${encodeURIComponent(searchText)}&p=${page}`,
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
      return response.data
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
    const response = await axios.post('https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241204.01.00', hl: 'en', gl: 'US' } },
      query: searchText,
      params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ==', // Filter for songs
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/search',
      },
    });

    if (response.status === 200) {
      const data = response.data;

      // Parse YouTube Music response structure
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const songs = [];

        for (const section of contents) {
          const musicShelf = section.musicShelfRenderer;
          if (!musicShelf || !musicShelf.contents) { continue; }

          for (const item of musicShelf.contents) {
            const musicItem = item.musicResponsiveListItemRenderer;
            if (!musicItem) { continue; }

            // Extract video ID
            const videoId = musicItem.playlistItemData?.videoId ||
              musicItem.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

            if (!videoId) { continue; }

            // Extract title
            const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';

            // Extract artist - collect all artists from runs until separator
            const artistRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            let artists = [];
            let artistString = '';
            if (artistRuns && artistRuns.length > 0) {
              for (const run of artistRuns) {
                const text = run.text || '';
                // Stop at separators like "•" or other non-artist text
                if (text.includes('•') || text.includes('·') || text.includes('•') || text.trim() === '') {
                  break;
                }
                if (text.trim()) {
                  artists.push({ name: text.trim() });
                  artistString += (artistString ? ', ' : '') + text.trim();
                }
              }
              // Fallback to first run if no artists found
              if (artists.length === 0) {
                artists = [{ name: artistRuns[0]?.text || 'Unknown' }];
                artistString = artistRuns[0]?.text || 'Unknown';
              }
            } else {
              artists = [{ name: 'Unknown' }];
              artistString = 'Unknown';
            }

            // Extract thumbnail - try multiple possible paths for robustness
            const thumbnails =
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
              musicItem.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
              musicItem.thumbnail?.thumbnail?.thumbnails ||
              musicItem.thumbnail?.thumbnails ||
              musicItem.thumbnailRenderer?.thumbnail?.thumbnails ||
              musicItem.thumbnails || [];

            let thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url;

            // Handle missing thumbnails with a reliable construct
            if (!thumbnail && videoId) {
              thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            } else if (!thumbnail) {
              thumbnail = 'https://via.placeholder.com/544x544/cccccc/000000?text=No+Img';
            }

            // Ensure protocol
            if (thumbnail.startsWith('//')) {
              thumbnail = 'https:' + thumbnail;
            }

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            // Extract duration
            const durationText = musicItem.flexColumns?.[musicItem.flexColumns.length - 1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            const duration = parseDuration(durationText) || 0;

            // Detect language
            const detectLanguage = (text) => {
              if (!text) { return 'en'; }
              if (/[\u0C00-\u0C7F]/.test(text)) { return 'telugu'; }
              if (/[\u0900-\u097F]/.test(text)) { return 'hindi'; }
              if (/[\u0B80-\u0BFF]/.test(text)) { return 'tamil'; }
              if (/[\u0C80-\u0CFF]/.test(text)) { return 'kannada'; }
              if (/[\u0D00-\u0D7F]/.test(text)) { return 'malayalam'; }
              if (/[\u0980-\u09FF]/.test(text)) { return 'bengali'; }
              if (/[\u0A00-\u0A7F]/.test(text)) { return 'punjabi'; }
              if (/[\u0A80-\u0AFF]/.test(text)) { return 'gujarati'; }
              return 'en';
            };

            const detectedLanguage = detectLanguage(title + ' ' + artistString);

            // Extract album info
            const albumRun = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.find(r => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb_'));
            const albumName = albumRun?.text || '';
            const albumId = albumRun?.navigationEndpoint?.browseEndpoint?.browseId || '';

            songs.push({
              id: videoId,
              name: title,
              title: title,
              image: [{ url: thumbnail }, { url: thumbnail }, { url: thumbnail }],
              artist: artistString,
              artists: { primary: artists },
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

            if (songs.length >= limit) { break; }
          }

          if (songs.length >= limit) { break; }
        }

        if (songs.length > 0) {
          return { data: { results: songs } };
        }
      }
    }
  } catch (error) {
    // YouTube Music API failed
  }

  // Fallback: If no results found with strict filter, try a broader search
  try {
    const broadSearch = await axios.post('https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241204.01.00', hl: 'en', gl: 'US' } },
      query: searchText,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
      },
    });

    if (broadSearch.status === 200) {
        const data = broadSearch.data;
        const songs = [];
        const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
        
        for (const section of contents) {
          const musicShelf = section.musicShelfRenderer;
          if (musicShelf && musicShelf.contents) {
            for (const item of musicShelf.contents) {
              const musicItem = item.musicResponsiveListItemRenderer;
              const videoId = musicItem?.playlistItemData?.videoId || musicItem?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
              if (!videoId) continue;
              const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
              const artist = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
              const thumbnail = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

              songs.push({
                id: videoId,
                name: title,
                title: title,
                image: [{ url: thumbnail }, { url: thumbnail }, { url: thumbnail }],
                artist: artist || 'Unknown',
                artists: { primary: [{name: artist || 'Unknown'}] },
                url: videoId,
                downloadUrl: videoId,
                source: 'ytmusic',
              });
              if (songs.length >= limit) break;
            }
          }
          if (songs.length >= limit) break;
        }
        if (songs.length > 0) return { data: { results: songs } };
    }
  } catch (e) {}

  return { data: { results: [] } };
}

async function getYTSearchAlbumData(searchText, page, limit) {
  // STRATEGY 1: Try YouTube Music InnerTube API for actual albums
  try {
    const innerTubeResponse = await fetch('https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/search',
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
    });

    if (innerTubeResponse.ok) {
      const data = await innerTubeResponse.json();
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const albums = [];

        for (const section of contents) {
          const musicShelf = section.musicShelfRenderer;
          if (!musicShelf || !musicShelf.contents) { continue; }

          for (const item of musicShelf.contents) {
            const musicItem = item.musicResponsiveListItemRenderer;
            if (!musicItem) { continue; }

            // Extract browse ID for album
            const browseId = musicItem.navigationEndpoint?.browseEndpoint?.browseId;
            if (!browseId) { continue; }

            // Extract title
            const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';

            // Extract artist
            const artistRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            const artist = artistRuns?.filter(r => r.text !== ' • ').map(r => r.text).join('') || 'Unknown';

            // Extract thumbnail
            let thumbnail = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || 'https://via.placeholder.com/544x544/cccccc/000000?text=No+Img';

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            albums.push({
              id: browseId,
              name: title,
              image: [{ url: thumbnail }, { url: thumbnail }, { url: thumbnail }],
              artists: { primary: [{ name: artist }] },
              source: 'ytmusic',
            });

            if (albums.length >= limit) { break; }
          }

          if (albums.length >= limit) { break; }
        }

        if (albums.length > 0) {
          return { data: { results: albums } };
        }
      }
    }
  } catch (error) {
  }

  // No fallback to Invidious - use InnerTube only
  return { data: { results: [] } };
}

async function getYTSearchPlaylistData(searchText, page, limit) {
  // STRATEGY 1: Try YouTube Music InnerTube API for curated playlists
  // IMPORTANT: UI components expect a Saavn-like shape for playlists:
  //   - title/name
  //   - image[] entries with `.link`
  //   - songCount (optional, used to detect Saavn shape)
  // Also playlist browseId is usually like "VL...". Our getPlaylistData routes VL/RDAMPL/OLAK/PL to YTMusic browse.
  try {
    const innerTubeResponse = await fetch('https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/search',
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
    });

    if (innerTubeResponse.ok) {
      const data = await innerTubeResponse.json();
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

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
            const browseId = musicItem.navigationEndpoint?.browseEndpoint?.browseId;
            if (!browseId) {
              continue;
            }

            // Extract title
            const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';

            // Extract song count (if present)
            const metaRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            const metaText = Array.isArray(metaRuns) ? metaRuns.map(r => r.text).join('') : '';
            const songCountMatch = metaText.match(/(\d+)\s*(song|songs)/i);
            const songCount = songCountMatch ? parseInt(songCountMatch[1], 10) : undefined;

            // Extract thumbnail
            let thumbnail =
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
              musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url ||
              'https://via.placeholder.com/544x544/cccccc/000000?text=No+Img';

            if (thumbnail && thumbnail.startsWith('//')) {
              thumbnail = 'https:' + thumbnail;
            }

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            // Return in Saavn-compatible shape (so existing UI doesn't show empty)
            const imageArr = [
              { quality: '50x50', link: thumbnail, url: thumbnail },
              { quality: '150x150', link: thumbnail, url: thumbnail },
              { quality: '500x500', link: thumbnail, url: thumbnail },
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
          return { data: { results: playlists } };
        }
      }
    }
  } catch (error) {
    // ignore; return empty below
  }

  // No fallback to Invidious - use InnerTube only
  return { data: { results: [] } };
}

async function getLyricsSongData(id) {
  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/songs/${id}/lyrics`,
    `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=wap6dot0&api_version=4&_format=json&_marker=0&id=${id}`,
  ];

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

async function getYTLyricsSongData(artist, title, preferredLanguage, isYouTubeMusic = false) {

  const apis = [
    {
      url: `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      timeout: 5000,
      transform: async (data) => {
        if (data.syncedLyrics) {
          // Handle both LRC format (string) and JSON format (array)
          let timed_lyrics = [];

          if (Array.isArray(data.syncedLyrics)) {
            // JSON format from lrclib.net API
            timed_lyrics = data.syncedLyrics.map((line, index) => ({
              start_time: parseInt(line.startTimeMs, 10),
              end_time: parseInt(line.endTimeMs, 10),
              text: line.text,
              id: `line_${index}`,
            }));
          } else if (typeof data.syncedLyrics === 'string') {
            // LRC format - parse synced lyrics
            const lines = data.syncedLyrics.split('\n');

            for (const line of lines) {
              const match = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
              if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseFloat(match[2]);
                const start_time = (minutes * 60 + seconds) * 1000;
                const text = match[3].trim();

                if (text) {
                  // Check if this is a continuation of previous line (very close timing)
                  if (timed_lyrics.length > 0) {
                    const lastLine = timed_lyrics[timed_lyrics.length - 1];
                    const timeDiff = start_time - lastLine.start_time;

                    // If timing is very close (< 0.5 seconds) and last line is short, combine them
                    if (timeDiff < 500 && lastLine.text.length < 50) {
                      lastLine.text += ' ' + text;
                      continue;
                    }
                  }

                  timed_lyrics.push({ start_time, text });
                }
              }
            }

            // Add IDs and end times for LRC format
            timed_lyrics = timed_lyrics.map((line, index) => ({
              ...line,
              end_time: timed_lyrics[index + 1] ? timed_lyrics[index + 1].start_time : line.start_time + 5000, // Default 5s duration
              id: `line_${index}`,
            }));
          }

          return {
            success: true,
            data: {
              lyrics: data.plainLyrics || (Array.isArray(data.syncedLyrics) ?
                data.syncedLyrics.map(line => line.text).join('\n') :
                data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]\s*/g, '')),
              timed_lyrics: timed_lyrics,
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://lyrics-api-go-better-lyrics-api-pr-12.up.railway.app/getLyrics?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}`,
      timeout: 5000,
      transform: async (data) => {
        if (data.ttml) {
          // Parse TTML to extract lyrics and timed_lyrics
          const ttml = data.ttml;
          // Simple extraction of text from TTML
          const plainLyrics = ttml.replace(/<[^>]*>/g, '').trim();

          // For timed_lyrics, parse the spans with begin/end
          const timed_lyrics = [];
          const spanRegex = /<span begin="([^"]*)" end="([^"]*)">([^<]*)<\/span>/g;
          let match;
          const words = [];

          while ((match = spanRegex.exec(ttml)) !== null) {
            const start_time = parseFloat(match[1]) * 1000; // times are in seconds
            const text = match[3].trim();
            if (text) {
              words.push({ start_time, text });
            }
          }

          // Group words into lines based on timing gaps (more than 2 seconds apart)
          if (words.length > 0) {
            let currentLine = { start_time: words[0].start_time, text: words[0].text };

            for (let i = 1; i < words.length; i++) {
              const word = words[i];
              const timeGap = word.start_time - (currentLine.start_time + currentLine.text.length * 100); // Rough estimate

              if (timeGap > 2000 || currentLine.text.length > 100) { // New line if gap > 2s or line too long
                timed_lyrics.push({ ...currentLine, id: `line_${timed_lyrics.length}` });
                currentLine = { start_time: word.start_time, text: word.text };
              } else {
                currentLine.text += ' ' + word.text;
              }
            }
            timed_lyrics.push({ ...currentLine, id: `line_${timed_lyrics.length}` }); // Add the last line
          }

          return {
            success: true,
            data: {
              lyrics: plainLyrics,
              timed_lyrics,
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://test-0k.onrender.com/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&tamps=true&pass=false&sequence=1,2,3,4,5,6`,
      timeout: 5000,
      transform: async (data) => {
        if (data.data && data.data.lyrics) {
          return {
            success: true,
            data: {
              lyrics: data.data.lyrics,
              timed_lyrics: data.data.timed_lyrics,
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://test-0k.onrender.com/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&tamps=true&pass=false&sequence=2,4,6,1,3,5`,
      timeout: 5000,
      transform: async (data) => {
        if (data.data && data.data.lyrics) {
          return {
            success: true,
            data: {
              lyrics: data.data.lyrics,
              timed_lyrics: data.data.timed_lyrics,
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      timeout: 5000,
      transform: async (data) => {
        if (data.lyrics) {
          return {
            success: true,
            data: {
              lyrics: data.lyrics,
              // no timed_lyrics
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_artist=${encodeURIComponent(artist)}&q_track=${encodeURIComponent(title)}&apikey=2d782bc7a52a41ba2fc1ef05b9cf40d7`,
      timeout: 5000,
      transform: async (data) => {
        if (data?.message?.body?.lyrics) {
          const lyricsData = data.message.body.lyrics;
          return {
            success: true,
            data: {
              lyrics: lyricsData.lyrics_body || lyricsData.lyrics_body_plain || '',
              // Musixmatch doesn't provide timed lyrics in free tier
            },
          };
        }
        return null;
      },
    },
    {
      // JioSaavn fallback: search for song, then get lyrics
      url: null, // no single url
      transform: async (data) => {
        try {
          // Search for song
          const searchConfig = {
            method: 'get',
            url: `https://jiosavan-api-with-playlist.vercel.app/api/search/songs?query=${encodeURIComponent(artist + ' ' + title)}&limit=5`,
            headers: {},
          };
          const searchResponse = await axios.request(searchConfig);
          const songs = searchResponse.data?.data?.results;
          if (songs && songs.length > 0) {
            let selected = songs[0];
            if (preferredLanguage) {
              const langLower = preferredLanguage.toLowerCase();
              const match = songs.find(s => (s.language || '').toLowerCase() === langLower);
              if (match) {
                selected = match;
              } else {
              }
            }
            const songId = selected.id;
            // Get lyrics - try multiple endpoints
            const lyricsUrls = [
              `https://jiosavan-api-with-playlist.vercel.app/api/songs/${songId}/lyrics`,
              `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=wap6dot0&api_version=4&_format=json&_marker=0&id=${songId}`,
            ];

            for (const lyricsUrl of lyricsUrls) {
              try {
                const lyricsConfig = {
                  method: 'get',
                  url: lyricsUrl,
                  headers: {},
                };
                const lyricsResponse = await axios.request(lyricsConfig);
                const lyricsData = lyricsResponse.data;

                // Handle different response formats
                let lyricsText = lyricsData?.data?.lyrics || lyricsData?.lyrics;

                if (lyricsText) {
                  return {
                    success: true,
                    data: {
                      lyrics: lyricsText,
                      // JioSaavn may not have timed_lyrics
                    },
                  };
                }
              } catch (lyricsError) {
                continue;
              }
            }
          }
        } catch (e) {
          // ignore
        }
        return null;
      },
    },
  ];

  for (let api of apis) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: api.url,
        headers: {},
        timeout: api.timeout || 10000,
      };
      const response = await axios.request(config);
      const result = await api.transform(response.data);
      if (result) {
        return result;
      }
    } catch (e) {
      // For the JioSaavn fallback, api.url is null, so handle differently
      if (!api.url) {
        const result = await api.transform(null);
        if (result) {
          return result;
        }
      }
      continue;
    }
  }

  // If preferred language failed and it's not English, try with English as fallback
  if (preferredLanguage && preferredLanguage.toLowerCase() !== 'en' && preferredLanguage.toLowerCase() !== 'english') {
    return getYTLyricsSongData(artist, title, 'en', isYouTubeMusic);
  }

  return {
    success: false,
    data: {
      lyrics: "No Lyrics Found",
    },
  };
}

async function getYTSearchVideoData(searchText, page, limit) {
  // Use YouTube InnerTube API (primary)
  try {
    const response = await axios.post('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      context: { client: { clientName: 'WEB', clientVersion: '2.20241204.01.00', hl: 'en', gl: 'US' } },
      query: searchText,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/results',
      },
    });

    if (response.status === 200) {
      const data = response.data;

      // Parse YouTube InnerTube response structure
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;

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
            const channelName = videoRenderer.ownerText?.runs?.[0]?.text || 'Unknown';

            // Extract thumbnail - try multiple paths for robustness
            const thumbnails = videoRenderer.thumbnail?.thumbnails ||
              videoRenderer.thumbnails ||
              [];
            let thumbnail = thumbnails[thumbnails.length - 1]?.url ||
              thumbnails[0]?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            // Ensure protocol
            if (thumbnail.startsWith('//')) {
              thumbnail = 'https:' + thumbnail;
            }

            // Upgrade thumbnail quality using YTArtworkUtils
            thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
            thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);

            // Extract duration from lengthText
            const durationText = videoRenderer.lengthText?.simpleText;
            const duration = parseDuration(durationText) || 0;

            videos.push({
              id: videoId,
              name: title,
              image: [{ url: thumbnail }, { url: thumbnail }, { url: thumbnail }],
              artists: { primary: [{ name: channelName }] },
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
          return { data: { results: videos } };
        }
      }
    }
  } catch (error) {
    // InnerTube API also failed
  }

  throw new Error('All YouTube API instances failed');
}

async function getSongData(id) {
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    song_detail: "__call=webapi.get&type=song&includeMetaTags=0",
  };

  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/songs/${id}`,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.song_detail}&id=${id}`,
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
      return response.data
    } catch (error) {
      continue;
    }
  }
  throw new Error('All song data API instances failed');
}

export { getSearchSongData, getLyricsSongData, getYTSearchSongData, getYTSearchVideoData, getSongData, getYTLyricsSongData, getYTSearchAlbumData, getYTSearchPlaylistData, getSearchSuggestions }



