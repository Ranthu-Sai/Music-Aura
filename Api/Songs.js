import axios from "axios";

async function getSearchSongData(searchText,page,limit){
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
        headers: { },
      };
      const response = await axios.request(config);
      return response.data
    } catch (error) {
      continue;
    }
  }
  throw new Error('All search API instances failed');
}

async function getYTSearchSongData(searchText,page,limit){
  const urls = [
    'https://pipedapi.in.projectsegfau.lt',
  ];
  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${baseUrl}/search?q=${searchText}&filter=music_songs`,
        headers: { },
      };
      const response = await axios.request(config);
      // Transform to Saavn-like structure
      const transformedResults = response.data.items.slice(0, limit).map(song => ({
        id: song.url.replace('/watch?v=', ''),
        name: song.title,
        image: [{}, {}, { url: `https://img.youtube.com/vi/${song.url.replace('/watch?v=', '')}/maxresdefault.jpg` }],
        artists: { primary: [{ name: song.uploaderName.replace(' - Topic', '').trim() }] },
        downloadUrl: song.url.replace('/watch?v=', ''),
        duration: song.duration,
        language: 'en',
      }));
      return { data: { results: transformedResults } };
    } catch (e) {
      continue;
    }
  }
  throw new Error('All Piped API instances failed');
}

async function getYTSearchAlbumData(searchText,page,limit){
  const urls = [
    'https://pipedapi.in.projectsegfau.lt',
  ];
  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${baseUrl}/search?q=${searchText}&filter=music_albums`,
        headers: { },
      };
      const response = await axios.request(config);
      // Transform to Saavn-like structure
      const transformedResults = response.data.items.filter(album => album.thumbnail).map(album => ({
        id: album.url,
        name: album.title,
        image: [{}, {}, { url: album.thumbnail }],
        artists: { primary: [{ name: album.uploaderName }] },
      }));
      return { data: { results: transformedResults } };
    } catch (e) {
      continue;
    }
  }
  throw new Error('All Piped API instances failed');
}

async function getYTSearchPlaylistData(searchText,page,limit){
  const urls = [
    'https://pipedapi.in.projectsegfau.lt',
  ];
  for (let baseUrl of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${baseUrl}/search?q=${searchText}&filter=music_playlists`,
        headers: { },
      };
      const response = await axios.request(config);
      // Transform to Saavn-like structure
      const transformedResults = response.data.items.slice(0, limit).map(playlist => ({
        id: playlist.url,
        name: playlist.title,
        image: [{}, {}, { link: playlist.thumbnail }],
        follower: "",
      }));
      return { data: { results: transformedResults } };
    } catch (e) {
      continue;
    }
  }
  throw new Error('All Piped API instances failed');
}

async function getLyricsSongData(id){
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
        headers: { },
      };
      const response = await axios.request(config);
      return response.data
    } catch (e) {
      continue;
    }
  }
  throw new Error('All lyrics API instances failed');
}

async function getYTLyricsSongData(artist, title){
  const apis = [
    {
      url: `https://lyrica-teal.vercel.app/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&tamps=true&pass=false&sequence=3,2`,
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
      }
    },
    {
      url: `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
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
      }
    },
    {
      url: `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
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
      }
    },
    {
      // JioSaavn fallback: search for song, then get lyrics
      url: null, // no single url
      transform: async (data) => {
        try {
          // Search for song
          const searchConfig = {
            method: 'get',
            url: `https://jiosavan-api-with-playlist.vercel.app/api/search/songs?query=${encodeURIComponent(artist + ' ' + title)}&limit=1`,
            headers: {},
          };
          const searchResponse = await axios.request(searchConfig);
          const songs = searchResponse.data?.data?.results;
          if (songs && songs.length > 0) {
            const songId = songs[0].id;
            // Get lyrics
            const lyricsConfig = {
              method: 'get',
              url: `https://jiosavan-api-with-playlist.vercel.app/api/songs/${songId}/lyrics`,
              headers: {},
            };
            const lyricsResponse = await axios.request(lyricsConfig);
            const lyricsData = lyricsResponse.data;
            if (lyricsData?.data?.lyrics) {
              return {
                success: true,
                data: {
                  lyrics: lyricsData.data.lyrics,
                  // JioSaavn may not have timed_lyrics
                },
              };
            }
          }
        } catch (e) {
          // ignore
        }
        return null;
      }
    },
  ];

  for (let api of apis) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: api.url,
        headers: { },
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

  return {
    success: false,
    data: {
      lyrics: "No Lyrics Found \nOpps... O_o",
    },
  };
}

async function getYTSearchVideoData(searchText,page,limit){
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://pipedapi.in.projectsegfau.lt/search?q=${searchText}&filter=videos`,
    headers: { },
  };
  try {
    const response = await axios.request(config);
    // Transform to Saavn-like structure
    const transformedResults = response.data.items.slice(0, limit).map(video => ({
      id: video.url.replace('/watch?v=', ''), // extract videoId
      name: video.title,
      image: [{}, {}, { url: `https://img.youtube.com/vi/${video.url.replace('/watch?v=', '')}/hqdefault.jpg` }],
      artists: { primary: [{ name: video.uploaderName }] },
      downloadUrl: video.url.replace('/watch?v=', ''), // videoId
      duration: video.duration,
      language: 'en',
    }));
    return { data: { results: transformedResults } };
  }
  catch (error) {
    throw error;
  }
}

async function getSongData(id){
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
        headers: { },
      };
      const response = await axios.request(config);
      return response.data
    } catch (error) {
      continue;
    }
  }
  throw new Error('All song data API instances failed');
}

export {getSearchSongData, getLyricsSongData, getYTSearchSongData, getYTSearchVideoData, getSongData, getYTLyricsSongData, getYTSearchAlbumData, getYTSearchPlaylistData}
