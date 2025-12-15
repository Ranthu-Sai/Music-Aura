export * from './Saavn/Recommended';
import axios from "axios";

// Get recommended songs for JioSaavn tracks
async function getRecommendedSongs(id){
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    song_reco: "__call=reco.getreco",
  };

  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/songs/${id}/suggestions`,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.song_reco}&id=${id}`,
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
  throw new Error('All recommended songs API instances failed');
}

// Helper function to parse duration from YouTube Music format
function parseDuration(durationText) {
  if (!durationText) {return 0;}
  const parts = durationText.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]);
  } else if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return 0;
}

// Get recommended songs for YouTube Music tracks
async function getYTMusicRecommendedSongs(videoId) {
  try {
    
    // Get video info to create search query
    const invidiousInstances = [
      'https://yt.omada.cafe',
      'https://invidious.nerdvpn.de',
      'https://inv.perditum.com',
    ];
    
    let videoInfo = null;
    for (const instance of invidiousInstances) {
      try {
        const infoUrl = `${instance}/api/v1/videos/${videoId}`;
        const infoResponse = await axios.get(infoUrl, { timeout: 5000 });
        if (infoResponse.data && infoResponse.data.title) {
          videoInfo = infoResponse.data;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!videoInfo) {
      return { data: { results: [] } };
    }
    
    // Create search query from video info
    let searchQuery = videoInfo.title;
    if (videoInfo.author && !videoInfo.author.includes('Topic')) {
      searchQuery = `${videoInfo.author} ${videoInfo.title}`;
    }
    
    // Search YouTube Music InnerTube API for similar songs
    const response = await fetch('https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.youtube.com',
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
        query: searchQuery,
        params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ==', // Filter for songs only
      }),
    });
    
    if (!response.ok) {
      return { data: { results: [] } };
    }
    
    const data = await response.json();
    const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    
    if (!contents || contents.length === 0) {
      return { data: { results: [] } };
    }
    
    const songs = [];
    
    for (const section of contents) {
      const musicShelf = section.musicShelfRenderer;
      if (!musicShelf || !musicShelf.contents) continue;
      
      for (const item of musicShelf.contents) {
        if (!item) continue;
        
        const musicItem = item.musicResponsiveListItemRenderer;
        if (!musicItem) continue;
        
        const foundVideoId = musicItem.playlistItemData?.videoId ||
                       musicItem.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
        
        if (!foundVideoId || foundVideoId === videoId) continue; // Skip if no ID or original song
        
        const title = musicItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown';
        
        const artistRuns = musicItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
        let artist = 'Unknown';
        if (artistRuns && artistRuns.length > 0) {
          artist = artistRuns[0]?.text || 'Unknown';
        }
        
        let thumbnail = musicItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                        `https://img.youtube.com/vi/${foundVideoId}/maxresdefault.jpg`;
        
        if (thumbnail && (thumbnail.includes('googleusercontent.com') || thumbnail.includes('ggpht.com'))) {
          thumbnail = thumbnail.split('=')[0] + '=w1080-h1080-l90-rj';
        }
        
        const durationText = musicItem.flexColumns?.[musicItem.flexColumns.length - 1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        const duration = parseDuration(durationText) || 0;
        
        // Only add if we have a valid video ID
        if (foundVideoId) {
          songs.push({
            id: foundVideoId,
            name: title,
            image: [
              { url: thumbnail },
              { url: thumbnail },
              { url: thumbnail },
            ],
            artists: {
              primary: [{ name: artist }],
            },
            downloadUrl: [
              { url: foundVideoId },
              { url: foundVideoId },
              { url: foundVideoId },
              { url: foundVideoId },
            ],
            duration: duration,
            language: 'en',
            source: 'ytmusic',
          });
        }
        
        if (songs.length >= 10) break;
      }
      
      if (songs.length >= 10) break;
    }
    
    return { data: { results: songs } };
    
  } catch (error) {
    return { data: { results: [] } };
  }
}

export {getRecommendedSongs, getYTMusicRecommendedSongs}
