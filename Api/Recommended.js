export * from './Saavn/Recommended';
import axios from 'axios';
import InnerTubeClient from './InnertubeClient';

// Get recommended songs for JioSaavn tracks
async function getRecommendedSongs(id) {
  const urls = [
    `https://jiosaavn-api-privatecvc2.vercel.app/songs/${id}/suggestions`,
    `https://jio-saavan-api.vercel.app/songs/${id}/suggestions`,
    `https://jiosaavn-api-privatecvc2.vercel.app/playlists?id=${id}`,
    `https://www.jiosaavn.com/api.php?ctx=wap6dot0&api_version=4&_format=json&_marker=0&__call=reco.getreco&pid=${id}`,
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
      if (response.data) {
        // If it's playlist format, extract songs
        if (response.data.data && response.data.data.songs) {
          return {data: response.data.data.songs.slice(0, 20)};
        }
        // If it's direct data array
        if (Array.isArray(response.data.data)) {
          return {data: response.data.data.slice(0, 20)};
        }
        // If it's success format with data array
        if (response.data.status === 'SUCCESS' && Array.isArray(response.data.data)) {
          return {data: response.data.data.slice(0, 20)};
        }
        // Return as-is if format is unknown but has data
        if (response.data.data) {
          return response.data;
        }
      }
      return response.data;
    } catch (error) {
      continue;
    }
  }

  // If all APIs fail, return empty recommendations instead of throwing error
  return {data: []};
}

// Get recommended songs for YouTube Music tracks
async function getYTMusicRecommendedSongs(videoId) {
  try {
    // Use InnerTube to get recommendations/radio
    const result = await InnerTubeClient.getNext(videoId);
    if (!result || !result.items) {
      return {data: {results: []}};
    }

    // Filter to get songs from the next list and format for the UI
    const recommendedSongs = result.items
      .filter(item => item.videoId && item.videoId !== videoId)
      .map(item => ({
        id: item.videoId,
        name: item.title,
        image: item.thumbnails
          ? item.thumbnails.map(t => ({url: t.url}))
          : [{url: item.thumbnail}],
        artists: {
          primary: item.artists || [{name: item.artist}],
        },
        primaryArtists: item.artist || (item.artists ? item.artists.map(a => a.name || a).join(', ') : 'Unknown Artist'),
        downloadUrl: item.videoId,
        duration: item.duration,
        language: 'en',
        source: 'ytmusic',
      }));

    return {data: {results: recommendedSongs.slice(0, 20)}};  } catch (error) {
    console.error('getYTMusicRecommendedSongs error:', error);
    return {data: {results: []}};
  }
}

export {getRecommendedSongs, getYTMusicRecommendedSongs};
