import axios from "axios";

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
        params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ==', // Filter for songs
      }),
      timeout: 15000,
    });

    if (innerTubeResponse.ok) {
      const data = await innerTubeResponse.json();

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

            // Extract artist - only take the first part before the separator
            const artistRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            let artist = 'Unknown';
            if (artistRuns && artistRuns.length > 0) {
              // First run is usually the artist, stop at first separator
              artist = artistRuns[0]?.text || 'Unknown';
            }

            // Extract thumbnail - use highest quality available
            const thumbnails = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            let thumbnail = thumbnails[thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            // Fix YouTube Music thumbnail URLs - use maximum resolution
            if (thumbnail && (thumbnail.includes('googleusercontent.com') || thumbnail.includes('ggpht.com'))) {
              thumbnail = thumbnail.split('=')[0] + '=w1080-h1080-l90-rj';
            }

            // Extract duration
            const durationText = musicItem.flexColumns?.[musicItem.flexColumns.length - 1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            const duration = parseDuration(durationText) || 0;

            // Detect language from title/artist using script detection
            const detectLanguage = (text) => {
              if (!text) { return 'en'; }
              // Telugu script: \u0C00-\u0C7F
              if (/[\u0C00-\u0C7F]/.test(text)) { return 'telugu'; }
              // Hindi/Devanagari: \u0900-\u097F
              if (/[\u0900-\u097F]/.test(text)) { return 'hindi'; }
              // Tamil: \u0B80-\u0BFF
              if (/[\u0B80-\u0BFF]/.test(text)) { return 'tamil'; }
              // Kannada: \u0C80-\u0CFF
              if (/[\u0C80-\u0CFF]/.test(text)) { return 'kannada'; }
              // Malayalam: \u0D00-\u0D7F
              if (/[\u0D00-\u0D7F]/.test(text)) { return 'malayalam'; }
              // Bengali: \u0980-\u09FF
              if (/[\u0980-\u09FF]/.test(text)) { return 'bengali'; }
              // Punjabi: \u0A00-\u0A7F
              if (/[\u0A00-\u0A7F]/.test(text)) { return 'punjabi'; }
              // Gujarati: \u0A80-\u0AFF
              if (/[\u0A80-\u0AFF]/.test(text)) { return 'gujarati'; }
              // Marathi uses Devanagari, same as Hindi
              return 'en';
            };

            const detectedLanguage = detectLanguage(title + ' ' + artist);

            // Debug logging for language detection
            if (detectedLanguage !== 'en') {
            }

            songs.push({
              id: videoId,
              name: title,
              title: title,
              image: [{}, {}, { url: thumbnail }],
              artist: artist,
              artists: { primary: [{ name: artist }] },
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

  // Return empty results instead of falling back to regular YouTube videos
  // This ensures YT Music only shows actual music content
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
            let thumbnail = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

            // Fix YouTube Music thumbnail URLs - remove size params and add high res
            if (thumbnail && thumbnail.includes('googleusercontent.com')) {
              thumbnail = thumbnail.split('=')[0] + '=w544-h544-l90-rj';
            } else if (thumbnail && thumbnail.includes('ggpht.com')) {
              thumbnail = thumbnail.split('=')[0] + '=w544-h544-l90-rj';
            }

            albums.push({
              id: browseId,
              name: title,
              image: [{}, {}, { url: thumbnail }],
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

  // STRATEGY 2: Fallback to Invidious
  const urls = [
    'https://yt.omada.cafe',
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.perditum.com',
  ];

  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${baseUrl}/api/v1/search?q=${encodeURIComponent(searchText)}&type=playlist`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      };
      const response = await axios.request(config);

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        continue;
      }

      // Transform to Saavn-like structure
      const transformedResults = response.data
        .filter(item => item.type === 'playlist' && item.playlistThumbnail)
        .slice(0, limit)
        .map(album => ({
          id: album.playlistId,
          name: album.title,
          image: [{}, {}, { url: album.playlistThumbnail }],
          artists: { primary: [{ name: album.author || 'Unknown' }] },
        }));

      if (transformedResults.length > 0) {
        return { data: { results: transformedResults } };
      }
    } catch (e) {
      continue;
    }
  }
  throw new Error('All YouTube API instances failed');
}

async function getYTSearchPlaylistData(searchText, page, limit) {
  // STRATEGY 1: Try YouTube Music InnerTube API for curated playlists
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
          if (!musicShelf || !musicShelf.contents) { continue; }

          for (const item of musicShelf.contents) {
            const musicItem = item.musicResponsiveListItemRenderer;
            if (!musicItem) { continue; }

            // Extract browse ID for playlist
            const browseId = musicItem.navigationEndpoint?.browseEndpoint?.browseId;
            if (!browseId) { continue; }

            // Extract title
            const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';

            // Extract thumbnail
            let thumbnail = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

            // Fix YouTube Music thumbnail URLs - remove size params and add high res
            if (thumbnail && thumbnail.includes('googleusercontent.com')) {
              thumbnail = thumbnail.split('=')[0] + '=w544-h544-l90-rj';
            } else if (thumbnail && thumbnail.includes('ggpht.com')) {
              thumbnail = thumbnail.split('=')[0] + '=w544-h544-l90-rj';
            }

            playlists.push({
              id: browseId,
              name: title,
              image: [{}, {}, { link: thumbnail }],
              follower: '',
              source: 'ytmusic',
            });

            if (playlists.length >= limit) { break; }
          }

          if (playlists.length >= limit) { break; }
        }

        if (playlists.length > 0) {
          return { data: { results: playlists } };
        }
      }
    }
  } catch (error) {
  }

  // STRATEGY 2: Fallback to Invidious
  const urls = [
    'https://yt.omada.cafe',
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.perditum.com',
  ];

  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${baseUrl}/api/v1/search?q=${encodeURIComponent(searchText)}&type=playlist`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      };
      const response = await axios.request(config);

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        continue;
      }

      // Transform to Saavn-like structure
      const transformedResults = response.data
        .filter(item => item.type === 'playlist' && item.playlistId)
        .slice(0, limit)
        .map(playlist => ({
          id: playlist.playlistId,
          name: playlist.title,
          image: [{}, {}, { link: playlist.playlistThumbnail || '' }],
          follower: "",
        }));

      if (transformedResults.length > 0) {
        return { data: { results: transformedResults } };
      }
    } catch (e) {
      continue;
    }
  }
  throw new Error('All YouTube API instances failed');
}

async function getLyricsSongData(id) {
  const urls = [
    'https://lyrica-teal.vercel.app/api/songs/${id}/lyrics',
    'https://jiosavan-api-with-playlist.vercel.app/api/songs/${id}/lyrics',
    'https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=wap6dot0&api_version=4&_format=json&_marker=0&id=${id}',
  ];
  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: baseUrl.replace('${id}', id),
        headers: {},
      };
      const response = await axios.request(config);
      return response.data
    } catch (e) {
      continue;
    }
  }
  throw new Error('All lyrics API instances failed');
}

async function getYTLyricsSongData(artist, title, preferredLanguage) {

  const apis = [
    {
      url: `https://term30.onrender.com/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&tamps=true&pass=false&sequence=1,2,3,4,5,6`,
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
      url: `https://lyrica-teal.vercel.app/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&tamps=true&pass=false&sequence=2,4,6,1,3,5`,
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
      url: `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      timeout: 5000,
      transform: async (data) => {
        if (data.syncedLyrics) {
          const timed_lyrics = data.syncedLyrics.split('\n').map(line => {
            const match = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
            if (match) {
              const minutes = parseInt(match[1], 10);
              const seconds = parseFloat(match[2]);
              const start_time = (minutes * 60 + seconds) * 1000;
              return { start_time, text: match[3] };
            }
            return null;
          }).filter(Boolean);
          return {
            success: true,
            data: {
              lyrics: data.plainLyrics || data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]\s*/g, ''),
              timed_lyrics,
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://some-random-api.com/lyrics?title=${encodeURIComponent(title + ' ' + artist)}`,
      timeout: 5000,
      transform: async (data) => {
        if (data.lyrics) {
          return {
            success: true,
            data: {
              lyrics: data.lyrics,
            },
          };
        }
        return null;
      },
    },
    {
      url: `https://paxsenix.vercel.app/api/lyrics?song=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
      timeout: 5000,
      transform: async (data) => {
        if (data.lyrics) {
          return {
            success: true,
            data: {
              lyrics: data.lyrics,
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
              `https://lyrica-teal.vercel.app/api/songs/${songId}/lyrics`,
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
  // This handles transliterated titles like "Dheera Dheera" instead of Telugu script
  if (preferredLanguage && preferredLanguage.toLowerCase() !== 'en' && preferredLanguage.toLowerCase() !== 'english') {
    return getYTLyricsSongData(artist, title, 'en');
  }

  return {
    success: false,
    data: {
      lyrics: "No Lyrics Found \nOpps... O_o",
    },
  };
}

async function getYTSearchVideoData(searchText, page, limit) {
  // STRATEGY 1: Try Invidious API instances first (tested 2024-12-06)
  const urls = [
    'https://yt.omada.cafe',      // ✅ Working (200 OK)
    'https://inv.perditum.com',   // ✅ Working (200 OK)
    'https://y.com.sb',           // ✅ Working (200 OK)
  ];

  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${baseUrl}/api/v1/search?q=${encodeURIComponent(searchText)}&type=video`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      };
      const response = await axios.request(config);

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        continue;
      }

      // Transform to Saavn-like structure
      const transformedResults = response.data
        .filter(item => item.type === 'video' && item.videoId)
        .slice(0, limit)
        .map(video => {
          const thumbnails = video.videoThumbnails || [];
          const highQualityThumb = thumbnails.find(t => t?.quality === 'maxres' || t?.quality === 'maxresdefault')?.url ||
            thumbnails.find(t => t?.width >= 1280)?.url ||
            thumbnails[thumbnails.length - 1]?.url ||
            `https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg`;

          return {
            id: video.videoId,
            name: video.title,
            image: [{ url: highQualityThumb }, { url: highQualityThumb }, { url: highQualityThumb }],
            artists: { primary: [{ name: video.author || 'Unknown' }] },
            downloadUrl: video.videoId,
            duration: video.lengthSeconds || 0,
            language: 'en',
          };
        });

      if (transformedResults.length > 0) {
        return { data: { results: transformedResults } };
      }
    } catch (error) {
      continue;
    }
  }

  // STRATEGY 2: Fallback to YouTube InnerTube API if all Invidious instances fail
  try {
    const innerTubeResponse = await fetch('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/results',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20241204.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        query: searchText,
      }),
      timeout: 15000,
    });

    if (innerTubeResponse.ok) {
      const data = await innerTubeResponse.json();

      // Parse YouTube InnerTube response structure
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;

      if (contents && contents.length > 0) {
        const videos = [];

        for (const section of contents) {
          const itemSection = section.itemSectionRenderer;
          if (!itemSection || !itemSection.contents) continue;

          for (const item of itemSection.contents) {
            const videoRenderer = item.videoRenderer;
            if (!videoRenderer) continue;

            const videoId = videoRenderer.videoId;
            if (!videoId) continue;

            // Extract title
            const title = videoRenderer.title?.runs?.[0]?.text || 'Unknown';

            // Extract channel name
            const channelName = videoRenderer.ownerText?.runs?.[0]?.text || 'Unknown';

            // Extract thumbnail - use highest quality available
            const thumbnails = videoRenderer.thumbnail?.thumbnails || [];
            const thumbnail = thumbnails[thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

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
            });

            if (videos.length >= limit) break;
          }

          if (videos.length >= limit) break;
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

export { getSearchSongData, getLyricsSongData, getYTSearchSongData, getYTSearchVideoData, getSongData, getYTLyricsSongData, getYTSearchAlbumData, getYTSearchPlaylistData }



