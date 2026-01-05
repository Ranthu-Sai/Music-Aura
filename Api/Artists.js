import axios from 'axios';

// Retry helper with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Track failed songs to avoid duplicate warnings
const failedStreamingUrls = new Set();

// Helper to get streaming URL from JioSaavn API
async function getStreamingUrl(songId) {
  try {
    const response = await retryWithBackoff(
      () => axios.get(
        `https://jiosavan-api-with-playlist.vercel.app/api/songs/${songId}`,
        { timeout: 15000 } // Increased timeout for slower networks
      ),
      2, // Reduced retries for streaming URLs to avoid delays
      1000
    );

    if (response.data?.data?.[0]?.downloadUrl) {
      const downloadUrls = response.data.data[0].downloadUrl;
      // Return array of URLs with quality options
      return downloadUrls;
    }
  } catch (error) {
    // Only log unique failures to avoid spam
    if (!failedStreamingUrls.has(songId)) {
      failedStreamingUrls.add(songId);
      // Silently fail for network errors - normal in poor connectivity
    }
  }
  
  return null;
}

/**
 * Get top/trending artists from JioSaavn
 * @returns {Promise<Array>} Array of artist objects with name, id, image
 */
export async function getTopArtists() {
  try {
    const response = await retryWithBackoff(
      () => axios.get(
        'https://www.jiosaavn.com/api.php',
        {
          params: {
            ctx: 'wap6dot0',
            api_version: 4,
            _format: 'json',
            _marker: 0,
            __call: 'webapi.getLaunchData',
          },
          timeout: 20000, // 20s timeout for slower networks
        },
      ),
      3, // 3 retries with backoff
      1500
    );

    let data = response.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    if (data && data.artist_recos) {
      return data.artist_recos.map(artist => ({
        id: artist.artistid || artist.id,
        name: artist.title || artist.name,
        image: artist.image,
        type: 'artist',
        perma_url: artist.perma_url,
      }));
    }

    return [];
  } catch (error) {
    // Silently return empty array - network errors are expected in poor connectivity
    return [];
  }
}

/**
 * Get artist's top songs
 * @param {string} artistId - Artist ID
 * @param {number} limit - Number of songs to fetch (default: 20)
 * @param {string} language - Optional language filter
 * @returns {Promise<Object>} Artist details with top songs
 */
export async function getArtistTopSongs(artistId, limit = 20, language = null) {
  try {
    const response = await retryWithBackoff(
      () => axios.get(
        'https://www.jiosaavn.com/api.php',
        {
          params: {
            __call: 'artist.getArtistPageDetails',
            artistId: artistId,
            n_song: limit,
            n_album: 0,
            page: 0,
            _format: 'json',
            _marker: 0,
          },
          timeout: 20000, // 20s timeout
        },
      ),
      3,
      1500
    );

    if (response.data) {
      let songs = response.data.topSongs?.songs || [];
      
      // Filter by language if specified
      if (language && language !== 'All' && language !== '') {
        songs = songs.filter(
          song => song.language?.toLowerCase() === language.toLowerCase()
        );
      }
      
      // Get streaming URLs for songs (batch process for better performance)
      const songsWithStreaming = await Promise.all(
        songs.map(async (song) => {
          const streamingUrls = await getStreamingUrl(song.id);
          
          return {
            ...song,
            downloadUrl: streamingUrls || song.encrypted_media_url, // Use streaming URLs or fallback
            hasStreaming: !!streamingUrls,
          };
        })
      );
      
      return {
        id: artistId,
        name: response.data.name,
        image: response.data.image,
        followerCount: response.data.follower_count,
        songs: songsWithStreaming,
      };
    }

    return null;
  } catch (error) {
    // Silently return null on error
    return null;
  }
}

/**
 * Get trending/chart playlists
 * @returns {Promise<Array>} Array of trending playlists
 */
export async function getTrendingPlaylists() {
  try {
    const response = await retryWithBackoff(
      () => axios.get(
        'https://www.jiosaavn.com/api.php',
        {
          params: {
            ctx: 'wap6dot0',
            api_version: 4,
            _format: 'json',
            _marker: 0,
            __call: 'webapi.getLaunchData',
          },
          timeout: 20000,
        },
      ),
      3,
      1500
    );

    if (response.data && response.data.charts) {
      return response.data.charts.map(playlist => ({
        id: playlist.id,
        title: playlist.title,
        subtitle: playlist.subtitle,
        image: playlist.image,
        type: playlist.type,
        perma_url: playlist.perma_url,
      }));
    }

    return [];
  } catch (error) {
    // Silently return empty array
    return [];
  }
}

/**
 * Search for artists by name
 * @param {string} query - Artist name to search
 * @returns {Promise<Array>} Array of matching artists
 */
export async function searchArtists(query) {
  try {
    const response = await retryWithBackoff(
      () => axios.get(
        'https://www.jiosaavn.com/api.php',
        {
          params: {
            __call: 'autocomplete.get',
            _format: 'json',
            _marker: 0,
            cc: 'in',
            includeMetaTags: 1,
            query: query,
          },
          timeout: 15000,
        },
      ),
      3,
      1000
    );

    if (response.data && response.data.artists && response.data.artists.data) {
      return response.data.artists.data.map(artist => ({
        id: artist.id,
        name: artist.title,
        image: artist.image,
        type: 'artist',
        perma_url: artist.perma_url,
      }));
    }

    return [];
  } catch (error) {
    // Silently return empty array
    return [];
  }
}
