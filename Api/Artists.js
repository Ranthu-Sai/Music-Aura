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
      () =>
        axios.get(
          `https://jiosavan-api-with-playlist.vercel.app/api/songs/${songId}`,
          {timeout: 15000}, // Increased timeout for slower networks
        ),
      2, // Reduced retries for streaming URLs to avoid delays
      1000,
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

// Helper to standardly format artist images from various API responses
function formatArtistImage(image) {
  if (!image) {
    return 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png';
  }

  if (Array.isArray(image)) {
    // Try to get 500x500, then 150x150, then 50x50
    return (
      image[2]?.link ||
      image[1]?.link ||
      image[0]?.link ||
      image[2]?.url ||
      image[1]?.url ||
      image[0]?.url ||
      'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'
    );
  }

  if (typeof image === 'string') {
    if (image.startsWith('http')) {
      // Upgrade quality if it's a standard Saavn CDN link
      return image.replace('150x150', '500x500').replace('50x50', '500x500');
    }
    return 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png';
  }

  return 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png';
}

/**
 * Get top/trending artists from JioSaavn
 * @param {string} language - Optional language filter (hindi, english, etc.)
 * @returns {Promise<Array>} Array of artist objects with name, id, image
 */
export async function getTrendingArtists(language = null) {
  // If language is specified and not 'All', get trending artists from language-specific modules
  if (language && language !== 'All' && language !== '') {
    try {
      // Try multiple fallback APIs for the /modules endpoint as they are more reliable for trending content
      const moduleApis = [
        'https://jio-savan-api-sigma.vercel.app', // Working API - highest priority
        'https://jiosaavn-api-2.vercel.app', // Fallback
        'https://saavn-api.vercel.app', // Last resort
      ];

      for (const apiBase of moduleApis) {
        try {
          const response = await retryWithBackoff(
            () =>
              axios.get(`${apiBase}/modules?language=${language}`, {
                timeout: 10000,
              }),
            2, // Reduced retries
            1000,
          );

          if (response.data?.status === 'SUCCESS' && response.data?.data) {
            const modules = response.data.data;
            const artistsMap = new Map();

            // Helper to extract specifically primary artists from songs/albums
            const extractArtists = items => {
              if (!items || !Array.isArray(items)) {
                return;
              }
              items.forEach(item => {
                const artists = item.primaryArtists || item.artists || [];
                artists.forEach(artist => {
                  if (artist.id && !artistsMap.has(artist.id)) {
                    artistsMap.set(artist.id, {
                      id: artist.id,
                      name: artist.name,
                      image: formatArtistImage(artist.image),
                      type: 'artist',
                      perma_url: artist.url || artist.perma_url,
                    });
                  }
                });
              });
            };

            extractArtists(modules.trending?.songs);
            extractArtists(modules.albums);

            const trendingArtists = Array.from(artistsMap.values());
            if (trendingArtists.length > 5) {
              return trendingArtists.slice(0, 16);
            }
          }
        } catch (apiError) {
          console.warn(
            `Module API ${apiBase} failed for artists:`,
            apiError.message,
          );
          continue;
        }
      }

      // If modules API didn't give enough artists, try a very specific search for trending artists
      const searchQuery = `trending ${language.split(',')[0]} artists`;
      const searchRes = await axios.get('https://www.jiosaavn.com/api.php', {
        params: {
          __call: 'search.getResults',
          _format: 'json',
          cc: 'in',
          q: searchQuery,
          n: 30,
          includeMetaTags: 1,
        },
        timeout: 15000,
      });

      if (searchRes.data?.results) {
        const searchedArtists = searchRes.data.results
          .filter(item => item.type === 'artist')
          .map(artist => ({
            id: artist.id,
            name: artist.title || artist.name,
            image: formatArtistImage(artist.image),
            type: 'artist',
            perma_url: artist.perma_url,
          }));

        if (searchedArtists.length > 0) {
          return searchedArtists.slice(0, 16);
        }
      }
    } catch (error) {
      console.warn(
        `Trending artist extraction failed for ${language}:`,
        error.message,
      );
    }
  }

  // Fallback to general top artists
  try {
    const response = await retryWithBackoff(
      () =>
        axios.get('https://www.jiosaavn.com/api.php', {
          params: {
            ctx: 'wap6dot0',
            api_version: 4,
            _format: 'json',
            _marker: 0,
            __call: 'webapi.getLaunchData',
          },
          timeout: 20000,
        }),
      3,
      1500,
    );

    let data = response.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    if (data && data.artist_recos) {
      return data.artist_recos
        .filter(
          artist =>
            artist.type === 'radio_station' &&
            artist.more_info?.featured_station_type === 'artist',
        )
        .map(artist => ({
          id: artist.id,
          name: artist.title,
          image: formatArtistImage(artist.image),
          type: 'artist',
          perma_url: artist.perma_url,
        }))
        .slice(0, 16);
    }
  } catch (error) {
    console.warn('Primary API failed for top artists, trying fallbacks');
  }

  return [];
}

/**
 * Get popular/top artists for a specific language
 * @param {string} language - selected language
 * @returns {Promise<Array>}
 */
export async function getLanguageTopArtists(language) {
  if (!language || language === 'All') {
    return getTrendingArtists(); // Same as general top artists
  }

  try {
    // First try the modules API for this language - it provides real artist objects with images
    const moduleApis = [
      'https://jio-savan-api-sigma.vercel.app', // Working API - highest priority
      'https://jiosaavn-api-2.vercel.app', // Fallback
      'https://saavn-api.vercel.app', // Last resort
    ];

    for (const apiBase of moduleApis) {
      try {
        const response = await retryWithBackoff(
          () =>
            axios.get(`${apiBase}/modules?language=${language}`, {
              timeout: 10000,
            }),
          2, // Reduced retries
          1000,
        );

        if (response.data?.status === 'SUCCESS' && response.data?.data) {
          const modules = response.data.data;
          const artistsMap = new Map();

          // Helper to extract specifically primary artists from songs/albums
          const extractArtists = items => {
            if (!items || !Array.isArray(items)) {
              return;
            }
            items.forEach(item => {
              const artists = item.primaryArtists || item.artists || [];
              artists.forEach(artist => {
                if (artist.id && !artistsMap.has(artist.id)) {
                  artistsMap.set(artist.id, {
                    id: artist.id,
                    name: artist.name,
                    image: formatArtistImage(artist.image), // Use actual artist image
                    type: 'artist',
                    perma_url: artist.url || artist.perma_url,
                  });
                }
              });
            });
          };

          extractArtists(modules.trending?.songs);
          extractArtists(modules.albums);

          const languageArtists = Array.from(artistsMap.values());
          if (languageArtists.length > 5) {
            return languageArtists.slice(0, 16);
          }
        }
      } catch (apiError) {
        console.warn(
          `Modules API ${apiBase} failed for language ${language}:`,
          apiError.message,
        );
        continue;
      }
    }

    // If modules API didn't work, fall back to search-based approach
    // Try multiple search queries for better results
    const searchQueries = [
      `${language.split(',')[0]} artists`, // Direct artist search
      `top ${language.split(',')[0]} artists`, // Top artists
      `popular ${language.split(',')[0]} artists`, // Popular artists
      `best ${language.split(',')[0]} singers`, // Best singers
      `${language.split(',')[0]} singers`, // Singers
    ];

    for (const searchQuery of searchQueries) {
      // Try Vercel API first with retry
      try {
        const vercelRes = await retryWithBackoff(
          () =>
            axios.get(
              `https://jiosaavn-api-2.vercel.app/search/songs?query=${encodeURIComponent(
                searchQuery,
              )}`,
              {timeout: 10000},
            ),
          2, // Reduced retries
          1000,
        );

        if (vercelRes.data?.results) {
          const results = vercelRes.data.results;
          const artistsMap = new Map();

          results.forEach(item => {
            // In this API, artists are usually in primaryArtists and primaryArtistsId strings
            const names = item.primaryArtists?.split(', ') || [];
            const ids = item.primaryArtistsId?.split(', ') || [];

            names.forEach((name, index) => {
              const id = ids[index];
              if (id && !artistsMap.has(id)) {
                artistsMap.set(id, {
                  id: id,
                  name: name,
                  // Use default artist image instead of song image
                  image: formatArtistImage(),
                  type: 'artist',
                  perma_url: `https://www.jiosaavn.com/artist/${name
                    .toLowerCase()
                    .replace(/ /g, '-')}/${id}`,
                });
              }
            });
          });

          const artists = Array.from(artistsMap.values());
          if (artists.length > 5) {
            return artists.slice(0, 16);
          }
        }
      } catch (vercelError) {
        console.warn(
          `Vercel search failed for "${searchQuery}":`,
          vercelError.message,
        );
      }

      // Try Saavn search for this query with retry
      try {
        // First try direct artist search
        const artistResponse = await retryWithBackoff(
          () =>
            axios.get('https://www.jiosaavn.com/api.php', {
              params: {
                __call: 'search.getArtistResults',
                _format: 'json',
                cc: 'in',
                q: searchQuery
                  .replace('artists', '')
                  .replace('singers', '')
                  .trim(),
                n: 20,
                includeMetaTags: 1,
              },
              timeout: 15000,
            }),
          2,
          1000,
        );

        if (
          artistResponse.data?.results &&
          artistResponse.data.results.length > 0
        ) {
          const directArtists = artistResponse.data.results
            .filter(artist => artist.id)
            .map(artist => ({
              id: artist.id,
              name: artist.title || artist.name,
              image: formatArtistImage(artist.image),
              type: 'artist',
              perma_url: artist.perma_url,
            }));

          if (directArtists.length > 0) {
            return directArtists.slice(0, 16);
          }
        }
      } catch (artistError) {
        // Continue to general search
      }

      // Fallback to general search
      try {
        const response = await retryWithBackoff(
          () =>
            axios.get('https://www.jiosaavn.com/api.php', {
              params: {
                __call: 'search.getResults',
                _format: 'json',
                cc: 'in',
                q: searchQuery,
                n: 40,
                includeMetaTags: 1,
              },
              timeout: 15000,
            }),
          2, // Reduced retries
          1000,
        );

        if (response.data?.results) {
          const results = response.data.results;
          const directArtists = [];
          const artistsFromSongs = new Map();

          results.forEach(item => {
            // Prioritize direct artist results
            if (item.type === 'artist' && item.id) {
              directArtists.push({
                id: item.id,
                name: item.title || item.name,
                image: formatArtistImage(item.image),
                type: 'artist',
                perma_url: item.perma_url,
              });
            }

            // Extract from song artistMap as fallback
            if (item.artistMap && directArtists.length < 20) {
              Object.entries(item.artistMap).forEach(([name, id]) => {
                if (id && !artistsFromSongs.has(id)) {
                  artistsFromSongs.set(id, {
                    id: id,
                    name: name,
                    image: formatArtistImage(), // Use default artist image
                    type: 'artist',
                    perma_url: `https://www.jiosaavn.com/artist/${name
                      .toLowerCase()
                      .replace(/ /g, '-')}/${id}`,
                  });
                }
              });
            }
          });

          // Prioritize direct artist results, then fill with extracted ones
          const allArtists = [
            ...directArtists,
            ...Array.from(artistsFromSongs.values()),
          ];
          if (allArtists.length > 0) {
            return allArtists.slice(0, 16);
          }
        }
      } catch (saavnError) {
        console.warn(
          `Saavn search failed for "${searchQuery}":`,
          saavnError.message,
        );
      }
    }

    // Saavn Search Fallback
    const response = await axios.get('https://www.jiosaavn.com/api.php', {
      params: {
        __call: 'search.getResults',
        _format: 'json',
        cc: 'in',
        q: `${language.split(',')[0]} artists`,
        n: 40,
        includeMetaTags: 1,
      },
      timeout: 15000,
    });

    if (response.data?.results) {
      const results = response.data.results;
      const artistsMap = new Map();

      results.forEach(item => {
        // Handle direct artist results
        if (item.type === 'artist' && item.id) {
          artistsMap.set(item.id, {
            id: item.id,
            name: item.title || item.name,
            image: formatArtistImage(item.image),
            type: 'artist',
            perma_url: item.perma_url,
          });
        }

        // Extract from song artistMap
        if (item.artistMap && artistsMap.size < 20) {
          Object.entries(item.artistMap).forEach(([name, id]) => {
            if (id && !artistsMap.has(id)) {
              artistsMap.set(id, {
                id: id,
                name: name,
                image: formatArtistImage(), // Use default artist image instead of song image
                type: 'artist',
                perma_url: `https://www.jiosaavn.com/artist/${name
                  .toLowerCase()
                  .replace(/ /g, '-')}/${id}`,
              });
            }
          });
        }
      });

      const artists = Array.from(artistsMap.values());
      if (artists.length > 0) {
        return artists.slice(0, 16);
      }
    }
  } catch (error) {
    console.warn(
      `Language top artists extraction failed for ${language}:`,
      error.message,
    );
  }
  return [];
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
      () =>
        axios.get('https://www.jiosaavn.com/api.php', {
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
        }),
      3,
      1500,
    );

    if (response.data) {
      let songs = response.data.topSongs?.songs || [];

      // Filter by language if specified
      if (language && language !== 'All' && language !== '') {
        songs = songs.filter(
          song => song.language?.toLowerCase() === language.toLowerCase(),
        );
      }

      // Get streaming URLs for songs (batch process for better performance)
      const songsWithStreaming = await Promise.all(
        songs.map(async song => {
          const streamingUrls = await getStreamingUrl(song.id);

          return {
            ...song,
            downloadUrl: streamingUrls || song.encrypted_media_url, // Use streaming URLs or fallback
            hasStreaming: !!streamingUrls,
          };
        }),
      );

      return {
        id: artistId,
        name: response.data.name,
        image: formatArtistImage(response.data.image),
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
      () =>
        axios.get('https://www.jiosaavn.com/api.php', {
          params: {
            ctx: 'wap6dot0',
            api_version: 4,
            _format: 'json',
            _marker: 0,
            __call: 'webapi.getLaunchData',
          },
          timeout: 20000,
        }),
      3,
      1500,
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
      () =>
        axios.get('https://www.jiosaavn.com/api.php', {
          params: {
            __call: 'autocomplete.get',
            _format: 'json',
            _marker: 0,
            cc: 'in',
            includeMetaTags: 1,
            query: query,
          },
          timeout: 15000,
        }),
      3,
      1000,
    );

    if (response.data && response.data.artists && response.data.artists.data) {
      return response.data.artists.data.map(artist => ({
        id: artist.id,
        name: artist.title,
        image: formatArtistImage(artist.image),
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
