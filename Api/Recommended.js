import axios from 'axios';
import InnerTubeClient from './InnertubeClient';

// Get recommended songs for JioSaavn tracks
// songMeta is optional: {artist, title, language} — used for search-based fallback
async function getRecommendedSongs(id, songMeta = {}) {
  const urls = [
    `https://jiosaavn-c451wwyru-sumit-kolhes-projects-94a4846a.vercel.app/api/songs/${id}/suggestions`,
    `https://nepotuneapi.vercel.app/api/songs/${id}/suggestions`,
    `https://jiosaavn-api-privatecvc2.vercel.app/songs/${id}/suggestions`,
  ];

  for (let url of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: url,
        headers: {},
        timeout: 5000,
      };
      const response = await axios.request(config);
      if (response.data) {
        let songs = null;

        // If it's playlist format, extract songs
        if (response.data.data && response.data.data.songs) {
          songs = response.data.data.songs;
        }
        // If it's direct data array (wrapper API format: {data: [...]})
        else if (Array.isArray(response.data.data)) {
          songs = response.data.data;
        }
        // If it's direct JioSaavn API format (object with numbered keys)
        else if (
          response.data &&
          typeof response.data === 'object' &&
          !Array.isArray(response.data) &&
          !response.data.data
        ) {
          const values = Object.values(response.data).filter(
            v => v && typeof v === 'object' && (v.id || v.song),
          );
          if (values.length > 0) {
            songs = values;
          }
        }
        // If it's a direct array response
        else if (Array.isArray(response.data)) {
          songs = response.data;
        }

        // Only return if we got non-empty recommendations
        if (songs && songs.length > 0) {
          return {data: songs.slice(0, 20)};
        }
        // Otherwise continue to next URL
      }
    } catch (error) {
      continue;
    }
  }

  // All suggestion APIs failed — try search-based recommendations using song metadata
  try {
    const artist = songMeta.artist && songMeta.artist !== 'Unknown Artist' ? songMeta.artist : '';
    const title = songMeta.title && songMeta.title !== 'Unknown Title' ? songMeta.title : '';
    const language = songMeta.language || '';
    const queryParts = (artist || title || '').trim();
    if (queryParts) {
      const searchQuery = encodeURIComponent(
        queryParts + (language ? ' ' + language : ''),
      );
      const searchUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${searchQuery}&limit=20`;
      const response = await axios.get(searchUrl, {timeout: 8000});
      const results = response.data?.data?.results || response.data?.results || [];
      if (Array.isArray(results) && results.length > 0) {
        const filtered = results.filter(s => {
          if (!s || !s.id || s.id === id) { return false; }
          if (language) {
            const sLang = (s.language || '').toLowerCase();
            const uLang = language.toLowerCase();
            if (sLang && sLang !== uLang) { return false; }
          }
          return true;
        });
        if (filtered.length > 0) {
          return {data: filtered.slice(0, 20)};
        }
      }
    }
  } catch (searchErr) {
    // Search fallback also failed
  }

  // If everything fails, return empty recommendations
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
