export * from './Saavn/Album';
import axios from "axios";
import YTArtworkUtils from "../Utils/YTMusicArtworkUtils";

async function getAlbumData(id) {
  // Check if this is a YouTube Music album (browseId starts with "MPREb_")
  if (id && typeof id === 'string' && id.startsWith('MPREb_')) {
    return await getYTMusicAlbumData(id);
  }

  // Saavn API for regular albums
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    album_detail: "__call=webapi.get&type=album",
  };

  const urls = [
    "https://jiosavan-api-with-playlist.vercel.app/api/albums?id=" + id,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.album_detail}&id=${id}`,
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
  throw new Error('All album data API instances failed');
}

async function getSearchAlbumData(searchText, page, limit) {
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    album_search: "__call=search.getAlbumResults&n=" + limit,
  };

  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/search/albums?query=${searchText}&page=${page}&limit=${limit}`,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.album_search}&q=${encodeURIComponent(searchText)}&p=${page}`,
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
  throw new Error('All album search API instances failed');
}

async function getYTMusicAlbumData(browseId) {
  try {
    const response = await fetch('https://music.youtube.com/youtubei/v1/browse?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com',
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
        browseId: browseId,
      }),
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Extract album metadata from musicResponsiveHeaderRenderer
    const twoCol = data?.contents?.twoColumnBrowseResultsRenderer;
    const tabContent = twoCol?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
    const header = tabContent?.contents?.[0]?.musicResponsiveHeaderRenderer;

    if (!header) {
      console.error('❌ No musicResponsiveHeaderRenderer found in response');
      throw new Error('Invalid YouTube Music album response structure');
    }

    // Extract album name
    const albumName = header?.title?.runs?.[0]?.text || 'Unknown Album';
    console.log('📋 Album Name:', albumName);

    // Extract album thumbnail
    let thumbnail = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

    // Upgrade thumbnail quality
    if (thumbnail) {
      thumbnail = YTArtworkUtils.upgradeArtworkQuality(thumbnail);
      thumbnail = YTArtworkUtils.upgradeYtimgQuality(thumbnail);
    }
    console.log('📋 Album Thumbnail:', thumbnail ? 'Found' : 'Not found');

    // Extract year and artist from subtitle
    const subtitle = header?.subtitle?.runs || [];
    let year = '';
    let primaryArtist = '';

    for (let i = 0; i < subtitle.length; i++) {
      const text = subtitle[i].text?.trim();
      if (text && /^\d{4}$/.test(text)) {
        year = text;
      } else if (text && text !== '•' && text !== ' • ' && !primaryArtist) {
        // First non-separator text is usually the type (EP, Album, etc.) or artist
        if (text !== 'EP' && text !== 'Album' && text !== 'Single') {
          primaryArtist = text;
        }
      }
    }

    if (!primaryArtist) {
      primaryArtist = 'Various Artists';
    }

    // Extract songs from secondaryContents
    const songs = [];
    const musicShelf = twoCol?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer;

    if (musicShelf && musicShelf.contents) {
      console.log('📋 Found', musicShelf.contents.length, 'songs');

      for (const item of musicShelf.contents) {
        const musicItem = item.musicResponsiveListItemRenderer;
        if (!musicItem) continue;

        // Extract video ID
        const videoId = musicItem.playlistItemData?.videoId;
        if (!videoId) continue;

        // Extract title
        const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';

        // Extract artist
        const artistRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
        const artist = artistRuns?.filter(r => r.text !== ' • ').map(r => r.text).join('') || 'Unknown';

        // Extract duration
        const durationText = musicItem.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
        const duration = parseDuration(durationText) || 0;

        // Detect language
        const detectLanguage = (text) => {
          if (!text) return 'en';
          if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
          if (/[\u0900-\u097F]/.test(text)) return 'hindi';
          if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
          if (/[\u0C80-\u0CFF]/.test(text)) return 'kannada';
          if (/[\u0D00-\u0D7F]/.test(text)) return 'malayalam';
          if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
          if (/[\u0A00-\u0A7F]/.test(text)) return 'punjabi';
          if (/[\u0A80-\u0AFF]/.test(text)) return 'gujarati';
          return 'en';
        };

        // ALWAYS use album thumbnail for all songs (consistent artwork)
        songs.push({
          id: videoId,
          name: title,
          title: title,
          image: [{ url: thumbnail }, { url: thumbnail }, { url: thumbnail }],
          duration: duration,
          language: detectLanguage(title + ' ' + artist),
          artist: artist,
          artists: { primary: [{ name: artist }] },
          downloadUrl: videoId,
          url: videoId,
          album: albumName,
          albumId: browseId,
          year: year,
          source: 'ytmusic'
        });
      }
    }

    // Calculate total duration
    const totalDuration = songs.reduce((acc, song) => acc + (song.duration || 0), 0);

    console.log('✅ YT Music Album:', albumName, '|', songs.length, 'songs |', year);

    const albumData = {
      data: {
        id: browseId,
        name: albumName,
        primaryArtist: primaryArtist,
        image: [{ url: thumbnail }, { url: thumbnail }, { url: thumbnail }],
        year: year,
        songs: songs,
        songCount: songs.length,
        totalDuration: totalDuration,
        type: 'album',
        source: 'ytmusic',
      },
    };

    return albumData;

  } catch (error) {
    console.error('❌ Error fetching YT Music album:', error);
    throw error;
  }
}

// Helper function to parse duration
function parseDuration(durationText) {
  if (!durationText) return 0;
  const parts = durationText.split(':').map(p => parseInt(p, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return 0;
}

export { getAlbumData, getSearchAlbumData }
