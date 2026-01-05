import axios from 'axios';

/**
 * Get devotional/bhakti playlists from JioSaavn
 * @param {string} language - Language filter (hindi, telugu, tamil, etc.)
 * @param {number} limit - Number of playlists to fetch
 * @returns {Promise<Array>} Array of devotional playlists
 */
export async function getDevotionalPlaylists(language = 'hindi', limit = 16) {
  try {
    const baseUrl = "https://www.jiosaavn.com/api.php";
    const defaultParams = {
      ctx: "wap6dot0",
      api_version: 4,
      _format: "json",
      _marker: 0,
    };

    // Multiple search queries to get diverse results
    const searchQueries = [
      `devotional ${language}`,
      `bhakti ${language}`,
      `bhajan ${language}`,
      `god songs ${language}`,
      `devotional songs`,
      `bhakti songs`,
      `prayer songs ${language}`
    ];

    const allResults = [];
    
    for (const query of searchQueries) {
      try {
        // Try the alternate API first
        const urls = [
          `https://jio-savan-api-sigma.vercel.app/search/playlists?query=${encodeURIComponent(query)}&page=1&limit=10`,
          `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&__call=search.getPlaylistResults&n=10&q=${encodeURIComponent(query)}&p=1`,
        ];

        for (const url of urls) {
          try {
            const response = await axios.get(url, { timeout: 10000 });
            let data = response.data;
            
            if (typeof data === 'string') {
              data = JSON.parse(data);
            }

            // Handle different response structures
            let playlists = [];
            if (data?.data?.results) {
              playlists = data.data.results;
            } else if (data?.results) {
              playlists = data.results;
            }

            if (playlists.length > 0) {
              allResults.push(...playlists);
              break; // Success, move to next query
            }
          } catch (error) {
            continue; // Try next URL
          }
        }
      } catch (error) {
        // Continue with other queries if one fails
        console.warn(`Failed to fetch devotional playlists for query: ${query}`);
      }
    }

    // Remove duplicates by id
    const uniquePlaylists = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    // Format and return limited results
    return uniquePlaylists.slice(0, limit).map(playlist => {
      // Extract image URL from array or string
      let imageUrl = '';
      if (Array.isArray(playlist.image)) {
        // Get highest quality image (last in array)
        const highQualityImage = playlist.image[playlist.image.length - 1];
        imageUrl = highQualityImage?.link || highQualityImage?.url || '';
      } else if (typeof playlist.image === 'string') {
        imageUrl = playlist.image;
      } else if (playlist.image?.link) {
        imageUrl = playlist.image.link;
      } else if (playlist.image?.url) {
        imageUrl = playlist.image.url;
      }

      return {
        id: playlist.id,
        name: playlist.title || playlist.name,
        subtitle: playlist.subtitle || playlist.description || '',
        image: imageUrl || playlist.more_info?.image || '',
        songCount: playlist.songCount || playlist.song_count || '0',
        type: 'playlist',
        perma_url: playlist.perma_url || playlist.url,
        language: playlist.language || language
      };
    });
  } catch (error) {
    console.warn("Failed to fetch devotional playlists:", error.message);
    return [];
  }
}
