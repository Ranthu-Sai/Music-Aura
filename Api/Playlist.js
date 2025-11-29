import axios from "axios";

async function getPlaylistData(id){
  if (id.startsWith('/')) {
    // YT playlist
    const listId = id.split('list=')[1];
    const urls = ['https://pipedapi.in.projectsegfau.lt'];
    for (let baseUrl of urls) {
      try {
        let config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: `${baseUrl}/playlists/${listId}`,
          headers: { },
        };
        const response = await axios.request(config);
        // Transform to Saavn format
        const songs = response.data.relatedStreams.filter(video => video.url).map(video => ({
          id: video.url ? video.url.replace('/watch?v=', '') : '',
          name: video.title,
          image: [{}, {}, { url: video.thumbnail }],
          artists: { primary: [{ name: video.uploaderName }] },
          downloadUrl: [
            { url: video.url ? video.url.replace('/watch?v=', '') : '' },
            { url: video.url ? video.url.replace('/watch?v=', '') : '' },
            { url: video.url ? video.url.replace('/watch?v=', '') : '' },
            { url: video.url ? video.url.replace('/watch?v=', '') : '' },
            { url: video.url ? video.url.replace('/watch?v=', '') : '' },
          ],
          duration: video.duration,
          language: 'en',
        }));
        return {
          data: {
            name: response.data.name,
            image: [{}, {}, { url: response.data.thumbnail }],
            songs: songs,
          }
        };
      } catch (e) {
        continue;
      }
    }
    throw new Error('Failed to fetch YT playlist');
  } else {
    // Saavn playlist
    const baseUrl = "https://www.jiosaavn.com/api.php";
    const defaultParams = {
      ctx: "wap6dot0",
      api_version: 4,
      _format: "json",
      _marker: 0,
    };
    const sources = {
      playlist_detail: "__call=webapi.get&type=playlist&p=1&n=50&includeMetaTags=0",
    };

    const urls = [
      `https://jiosavan-api-with-playlist.vercel.app/api/playlists?id=${id}&limit=100000`,
      `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.playlist_detail}&id=${id}`,
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
    throw new Error('All playlist data API instances failed');
  }
}

async function getSearchPlaylistData(searchText,page,limit){
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    playlist_search: "__call=search.getPlaylistResults&n=" + limit,
  };

  const urls = [
    `https://jio-savan-api-sigma.vercel.app/search/playlists?query=${searchText}&page=${page}&limit=${limit}`,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.playlist_search}&q=${encodeURIComponent(searchText)}&p=${page}`,
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
  throw new Error('All playlist search API instances failed');
}

async function getAllPlaylists(language){
  const urls = [
    'https://jiosaavn-c451wwyru-sumit-kolhes-projects-94a4846a.vercel.app',
    'https://nepotuneapi.vercel.app',
    'https://saavn.sumit.co',
    'https://jio-savan-api-sigma.vercel.app'
  ];
  for (let baseUrl of urls) {
    try {
      const pages = [1, 2, 3, 4, 5];
      const promises = pages.map(page => axios.get(`${baseUrl}/api/search/playlists?query=${language}&page=${page}&limit=100`));
      const responses = await Promise.all(promises);
      let allResults = [];
      for (let response of responses) {
        if (response.data?.data?.results) {
          allResults = allResults.concat(response.data.data.results);
        }
      }
      // Remove duplicates based on id
      const uniqueResults = allResults.filter((item, index, self) => self.findIndex(i => i.id === item.id) === index);
      return { data: { results: uniqueResults.slice(0, 500) } };
    }
    catch (error) {
      continue;
    }
  }
  throw new Error('Failed to fetch all playlists');
}

export {getPlaylistData,getSearchPlaylistData,getAllPlaylists}
