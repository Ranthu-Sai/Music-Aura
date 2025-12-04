import axios from "axios";

async function getAlbumData(id){
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
        headers: { },
      };
      const response = await axios.request(config);
      return response.data
    } catch (error) {
      continue;
    }
  }
  throw new Error('All album data API instances failed');
}

async function getSearchAlbumData(searchText,page,limit){
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
        headers: { },
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
  
    // Debug: Log the full structure to understand the API response    if (data.header) {    }
    if (data.contents) {    }

    // Try multiple possible header locations
    const header = data?.header?.musicDetailHeaderRenderer ||
                   data?.header?.musicImmersiveHeaderRenderer ||
                   data?.header?.musicHeaderRenderer;
  
    const albumName = header?.title?.runs?.[0]?.text ||
                     header?.title?.text ||
                     'Unknown Album';
  
    // Extract thumbnail
    let thumbnail = header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
    if (thumbnail && thumbnail.includes('googleusercontent.com')) {
      thumbnail = thumbnail.split('=')[0] + '=w544-h544-l90-rj';
    }
  
    // Extract year
    const subtitle = header?.subtitle?.runs || [];
    let year = '';
    for (const run of subtitle) {
      if (run.text && /^\d{4}$/.test(run.text.trim())) {
        year = run.text.trim();
        break;
      }
    }
  
    // Extract songs
    const songs = [];
    
    // Try multiple possible content paths
    let contents = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    
    if (!contents) {
      // Try alternative path for two-column layout
      contents = data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents;
    }
    
    if (!contents) {
      // Try another alternative
      contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    }
    
      if (contents && contents.length > 0) {    }

    if (contents) {
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
          const videoId = musicItem.playlistItemData?.videoId ||
                         musicItem.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

          if (!videoId) {
                      continue;
          }

        
          // Extract title
          const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';

          // Extract artist
          const artistRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          const artist = artistRuns?.filter(r => r.text !== ' • ').map(r => r.text).join('') || 'Unknown';

          // Extract thumbnail - try multiple paths
          const thumbnails = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
          let songThumbnail = thumbnails?.[thumbnails.length - 1]?.url ||
                              thumbnails?.[0]?.url ||
                              thumbnail || // Use album thumbnail as fallback
                              `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        
          // Fix YouTube Music CDN URLs to high resolution
          if (songThumbnail && songThumbnail.includes('googleusercontent.com')) {
            songThumbnail = songThumbnail.split('=')[0] + '=w544-h544-l90-rj';
          } else if (songThumbnail && songThumbnail.includes('ggpht.com')) {
            songThumbnail = songThumbnail.split('=')[0] + '=w544-h544-l90-rj';
          }

        
          // Extract duration
          const durationText = musicItem.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
          const duration = parseDuration(durationText) || 0;
          // Detect language from title/artist
          const detectLanguage = (text) => {
            if (!text) {return 'en';}
            if (/[\u0C00-\u0C7F]/.test(text)) {return 'telugu';}
            if (/[\u0900-\u097F]/.test(text)) {return 'hindi';}
            if (/[\u0B80-\u0BFF]/.test(text)) {return 'tamil';}
            if (/[\u0C80-\u0CFF]/.test(text)) {return 'kannada';}
            if (/[\u0D00-\u0D7F]/.test(text)) {return 'malayalam';}
            if (/[\u0980-\u09FF]/.test(text)) {return 'bengali';}
            if (/[\u0A00-\u0A7F]/.test(text)) {return 'punjabi';}
            if (/[\u0A80-\u0AFF]/.test(text)) {return 'gujarati';}
            return 'en';
          };

          songs.push({
            id: videoId,
            name: title,
            image: [{}, {}, { url: songThumbnail }],
            duration: duration,
            language: detectLanguage(title + ' ' + artist),
            artists: { primary: [{ name: artist }] },
            downloadUrl: videoId, // Video ID for playback
            url: videoId,
          });
        }
      }
    }

    const albumData = {
      data: {
        id: browseId,
        name: albumName,
        image: [{}, {}, { url: thumbnail }],
        year: year,
        songs: songs,
        type: 'album',
        source: 'ytmusic',
      },
    };    return albumData;

  } catch (error) {
        throw error;
  }
}

// Helper function to parse duration
function parseDuration(durationText) {
  if (!durationText) {return 0;}
  const parts = durationText.split(':').map(p => parseInt(p, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return 0;
}

export {getAlbumData, getSearchAlbumData}



