import { getCachedData, CACHE_GROUPS } from './CacheManager';
import YouTubeMusicService from '../Utils/YouTubeMusicService';
import { upgradeArtworkQuality } from '../Utils/YTMusicArtworkUtils';


// Helper function to transform YTMusic song data to Saavn format
function transformYTToSaavnSong(song) {
  // Transform thumbnails array to Saavn format with .url property
  const imageArray = [];
  if (song.thumbnails && Array.isArray(song.thumbnails)) {
    song.thumbnails.forEach((thumbnail, index) => {
      imageArray.push({
        url: upgradeArtworkQuality(thumbnail.url),
        quality: index === 0 ? "50x50" : index === 1 ? "150x150" : "500x500"
      });
    });
  }


  return {
    id: song.videoId || song.id,
    name: song.title,
    title: song.title,
    subtitle: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
    type: "song",
    image: imageArray.length > 0 ? imageArray : [{
      url: "https://via.placeholder.com/150",
      quality: "150x150"
    }],
    artist: song.artists?.[0]?.name || "Unknown Artist",
    artists: {
      primary: song.artists || []
    },
    duration: 0, // YTMusic API doesn't provide duration in search
    language: "unknown",
    year: "",
    albumId: "",
    album: "",
    label: "",
    url: "", // YTMusic doesn't provide direct audio URLs
    copyright: "",
    primaryArtists: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
    singers: "",
    composer: "",
    lyricist: "",
    producer: "",
    genre: "",
    playCount: 0,
    explicitContent: 0,
    downloadUrl: song.videoId || song.id // Store the video ID for streaming
  };
}

// Transform YTMusic artist data
function transformYTToSaavnArtist(artist) {
  // Transform thumbnails array to Saavn format with .url property
  const imageArray = [];
  if (artist.thumbnails && Array.isArray(artist.thumbnails)) {
    artist.thumbnails.forEach((thumbnail) => {
      imageArray.push({
        url: upgradeArtworkQuality(thumbnail.url),
        quality: thumbnail.height < 300 ? "150x150" : "500x500"
      });
    });
  }


  // Handle both 'browseId' and 'id' field names
  const artistId = artist.browseId || artist.id;

  return {
    id: artistId,
    name: artist.name || artist.artist,
    title: artist.name || artist.artist,
    subtitle: `${artist.type || "Artist"} • ${artist.subscribers || ""}`,
    type: "artist",
    image: imageArray.length > 0 ? imageArray : [{
      url: "https://via.placeholder.com/150",
      quality: "150x150"
    }],
    url: artistId,
    role: "",
    artistId: artistId,
    followerCount: 0,
    follower_count: 0,
    fan_count: 0,
    isVerified: false,
    dominantLanguage: "unknown",
    dominantType: "",
    bio: "",
    dob: "",
    fb: "",
    twitter: "",
    wiki: "",
    availableLanguages: [],
    isRadioPresent: false
  };
}

// Transform YTMusic album data
function transformYTToSaavnAlbum(album) {
  // Transform thumbnails array to Saavn format with .url property
  const imageArray = [];
  if (album.thumbnails && Array.isArray(album.thumbnails)) {
    album.thumbnails.forEach((thumbnail) => {
      const imageUrl = upgradeArtworkQuality(thumbnail.link || thumbnail.url);
      imageArray.push({
        url: imageUrl,
        link: imageUrl, // Add link property for compatibility
        quality: thumbnail.height <= 226 ? "150x150" : "500x500"
      });
    });
  }


  // Handle both 'browseId' and 'id' field names
  const albumId = album.browseId || album.id;
  const artistName = album.artists?.[0]?.name || "Various Artists";

  return {
    id: albumId,
    name: album.title,
    title: album.title,
    subtitle: album.year ? `Album • ${album.year}` : "Album",
    type: "album",
    image: imageArray.length > 0 ? imageArray : [{
      url: "https://via.placeholder.com/150",
      link: "https://via.placeholder.com/150",
      quality: "150x150"
    }],
    artist: artistName,
    artistId: album.artists?.[0]?.id || "",
    artists: artistName,
    url: albumId,
    duration: 0,
    explicit: album.isExplicit || false,
    language: "unknown",
    playCount: 0,
    year: album.year || "",
    songs: [],
    artistMap: {}
  };
}

// Transform YTMusic playlist data
function transformYTToSaavnPlaylist(playlist) {
  // Transform thumbnails array to Saavn format with .link property
  const imageArray = [];
  if (playlist.thumbnails && Array.isArray(playlist.thumbnails)) {
    playlist.thumbnails.forEach((thumbnail, index) => {
      const imageUrl = upgradeArtworkQuality(thumbnail.link || thumbnail.url);
      imageArray.push({
        quality: thumbnail.height <= 192 ? "50x50" : thumbnail.height <= 226 ? "150x150" : "500x500",
        url: imageUrl,
        link: imageUrl // This is what EachPlaylistCard expects
      });
    });
  }


  // Handle both 'browseId' and 'id' field names
  const playlistId = playlist.browseId || playlist.id;
  const author = playlist.author || "YouTube Music";

  return {
    id: playlistId,
    name: playlist.title,
    title: playlist.title,
    subtitle: `${author} • ${playlist.itemCount || playlist.count || 0} songs`,
    type: "playlist",
    image: imageArray.length > 0 ? imageArray : [{
      quality: "150x150",
      url: "https://via.placeholder.com/150",
      link: "https://via.placeholder.com/150"
    }],
    url: playlistId,
    songCount: playlist.itemCount || playlist.count || 0,
    createdBy: author,
    songs: [],
    duration: 0,
    description: "",
    explicit: false,
    artists: author // Add artists property for compatibility
  };
}

async function getYTMusicSearchSongData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_songs_${searchText}_page${page}_limit${limit}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Search Songs - Using Innertube Client for query: ${searchText}`);

      const searchResults = await YouTubeMusicService.search(searchText, 'songs', limit);

      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnSong);

        console.log(`✅ YTMusic Search Songs - Found ${transformedResults.length} songs for: ${searchText}`);

        return {
          status: "SUCCESS",
          message: "",
          data: {
            total: transformedResults.length,
            start: 0,
            results: transformedResults
          },
          success: true
        };
      }

      console.log('YTMusic Search Songs - No results found');
      return {
        status: "SUCCESS",
        message: "",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    } catch (error) {
      console.error('YTMusic song search error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to search YTMusic songs",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH);
  } catch (error) {
    console.error(`Error getting YTMusic song search data for "${searchText}":`, error);
    return {
      success: false,
      data: { results: [] },
      error: error.message || 'Network or Cache Error'
    };
  }
}

async function getYTMusicSearchArtistData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_artists_${searchText}_page${page}_limit${limit}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Search Artists - Using Innertube Client for query: ${searchText}`);

      const searchResults = await YouTubeMusicService.search(searchText, 'artists', limit);

      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnArtist);

        console.log(`✅ YTMusic Search Artists - Found ${transformedResults.length} artists for: ${searchText}`);

        return {
          status: "SUCCESS",
          message: "",
          data: {
            total: transformedResults.length,
            start: 0,
            results: transformedResults
          },
          success: true
        };
      }

      console.log('YTMusic Search Artists - No results found');
      return {
        status: "SUCCESS",
        message: "",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    } catch (error) {
      console.error('YTMusic artist search error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to search YTMusic artists",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH);
  } catch (error) {
    console.error(`Error getting YTMusic artist search data for "${searchText}":`, error);
    return {
      success: false,
      data: { results: [] },
      error: error.message || 'Network or Cache Error'
    };
  }
}

async function getYTMusicSearchAlbumData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_albums_${searchText}_page${page}_limit${limit}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Search Albums - Using Innertube Client for query: ${searchText}`);

      const searchResults = await YouTubeMusicService.search(searchText, 'albums', limit);

      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnAlbum);

        console.log(`✅ YTMusic Search Albums - Found ${transformedResults.length} albums for: ${searchText}`);

        return {
          status: "SUCCESS",
          message: "",
          data: {
            total: transformedResults.length,
            start: 0,
            results: transformedResults
          },
          success: true
        };
      }

      console.log('YTMusic Search Albums - No results found');
      return {
        status: "SUCCESS",
        message: "",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    } catch (error) {
      console.error('YTMusic album search error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to search YTMusic albums",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH);
  } catch (error) {
    console.error(`Error getting YTMusic album search data for "${searchText}":`, error);
    return {
      success: false,
      data: { results: [] },
      error: error.message || 'Network or Cache Error'
    };
  }
}

async function getYTMusicSearchPlaylistData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_playlists_${searchText}_page${page}_limit${limit}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Search Playlists - Using Innertube Client for query: ${searchText}`);

      // Use YouTube Music Service
      const searchResults = await YouTubeMusicService.search(searchText, 'playlists', limit);

      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnPlaylist);

        console.log(`✅ YTMusic Search Playlists - Found ${transformedResults.length} playlists for: ${searchText}`);

        return {
          status: "SUCCESS",
          message: "",
          data: {
            total: transformedResults.length,
            start: 0,
            results: transformedResults
          },
          success: true
        };
      }

      console.log('YTMusic Search Playlists - No results found');
      return {
        status: "SUCCESS",
        message: "",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    } catch (error) {
      console.error('YTMusic playlist search error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to search YTMusic playlists",
        data: {
          total: 0,
          start: 0,
          results: []
        },
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH);
  } catch (error) {
    console.error(`Error getting YTMusic playlist search data for "${searchText}":`, error);
    return {
      success: false,
      data: { results: [] },
      error: error.message || 'Network or Cache Error'
    };
  }
}

async function getYTMusicHomeFeed(limit = 10) {
  const cacheKey = `ytmusic_homefeed_limit_${limit}`;

  const fetchFunction = async () => {
    try {
      // Use YouTube Music Service (InnerTube API)
      console.log('🌐 YTMusic Home - Using Innertube Client for homefeed...');

      const homeFeedData = await YouTubeMusicService.getHomeFeed(limit);

      if (homeFeedData) {
        // No need to parse if it's already an object from Shim
        const parsedData = typeof homeFeedData === 'string' ? JSON.parse(homeFeedData) : homeFeedData;

        if (parsedData && Array.isArray(parsedData)) {
          // Transform the homefeed data to extract playlists and albums
          const feedSections = parsedData;

          // Extract playlists and albums from all sections
          const playlists = [];
          const albums = [];

          console.log('Processing YTMusic homefeed sections:', feedSections.length);

          feedSections.forEach((section, sectionIndex) => {
            console.log(`Section ${sectionIndex}: ${section.title}, items: ${section.contents?.length || 0}`);

            if (section.contents && Array.isArray(section.contents)) {
              section.contents.forEach((item, itemIndex) => {
                console.log(`  Item ${itemIndex}: type=${item.videoId ? 'song' : item.playlistId ? 'playlist' : item.browseId ? 'album' : 'unknown'}, id=${item.videoId || item.playlistId || item.browseId || item.id}, title=${item.title}`);

                // Determine item type based on available properties
                let itemType = 'unknown';
                if (item.playlistId) {
                  itemType = 'playlist';
                } else if (item.browseId) {
                  itemType = 'album';
                }

                if (itemType === 'playlist') {
                  // Transform playlist data
                  const transformedPlaylist = transformYTToSaavnPlaylist({
                    id: item.playlistId,
                    title: item.title,
                    thumbnails: item.thumbnails || []
                  });
                  playlists.push(transformedPlaylist);
                  console.log('    Added playlist:', transformedPlaylist.title);
                } else if (itemType === 'album') {
                  // Transform album data
                  const transformedAlbum = transformYTToSaavnAlbum({
                    id: item.browseId,
                    title: item.title,
                    thumbnails: item.thumbnails || [],
                    year: item.year || ''
                  });
                  albums.push(transformedAlbum);
                  console.log('    Added album:', transformedAlbum.title);
                }
              });
            }
          });

          console.log(`YTMusic homefeed processed: ${playlists.length} playlists, ${albums.length} albums`);

          // Log sample data for debugging
          if (playlists.length > 0) {
            console.log('Sample playlist:', JSON.stringify(playlists[0], null, 2));
          }
          if (albums.length > 0) {
            console.log('Sample album:', JSON.stringify(albums[0], null, 2));
          }

          const finalPlaylists = playlists.slice(0, 20);
          const finalAlbums = albums.slice(0, 20);

          return {
            status: "SUCCESS",
            message: `Found ${finalPlaylists.length} playlists and ${finalAlbums.length} albums`,
            data: {
              playlists: finalPlaylists,
              albums: finalAlbums,
              feed: feedSections // Store the full feed for future use
            },
            success: true
          };
        }
      }

      console.log('YTMusic homefeed: No valid data from Innertube Client');
      return {
        status: "SUCCESS",
        message: "No data available",
        data: {
          playlists: [],
          albums: [],
          feed: []
        },
        success: false
      };
    } catch (error) {
      console.error('YTMusic homefeed error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to fetch YTMusic homefeed",
        data: {
          playlists: [],
          albums: [],
          feed: []
        },
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 7200, CACHE_GROUPS.HOME); // Cache for 2 hours (7200 seconds)
  } catch (error) {
    console.error('Error getting YTMusic homefeed data:', error);
    return {
      success: false,
      data: { playlists: [], albums: [], feed: [] },
      error: error.message || 'Network or Cache Error'
    };
  }
}


async function getYTMusicPlaylistData(playlistId) {
  const cacheKey = `ytmusic_playlist_${playlistId}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Playlist - Using Innertube Client for playlist: ${playlistId}`);

      // Use YouTube Music Service
      const playlistData = await YouTubeMusicService.getPlaylist(playlistId);

      if (playlistData && !playlistData.error) {
        // Transform the tracks data to match Saavn format
        const transformedSongs = [];
        const tracks = playlistData.songs || playlistData.tracks;

        if (tracks && Array.isArray(tracks)) {
          // Limit processing to avoid excessive callbacks
          const tracksToProcess = tracks.slice(0, 500); // Limit to 500 songs max

          for (const song of tracksToProcess) {
            // Skip null/invalid songs
            if (!song || !song.title) {
              continue;
            }

            // Get the best quality thumbnail
            let thumbnailUrl = "https://via.placeholder.com/150";
            if (song.thumbnails && Array.isArray(song.thumbnails) && song.thumbnails.length > 0) {
              // Get highest quality thumbnail (last one is usually highest)
              const bestThumb = song.thumbnails[song.thumbnails.length - 1];
              thumbnailUrl = upgradeArtworkQuality(bestThumb?.url || thumbnailUrl);
            }

            // Transform song data to Saavn format
            const transformedSong = {
              id: song.videoId || song.id,
              name: song.title,
              title: song.title,
              subtitle: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
              type: "song",
              source: "ytmusic", // Mark as YTMusic song
              // Use array format with url property for compatibility
              image: song.thumbnails?.map(thumb => ({
                url: upgradeArtworkQuality(thumb.url),
                quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500"
              })) || [{
                url: thumbnailUrl,
                quality: "150x150"
              }],
              // Also add direct image URL for components that expect it
              images: song.thumbnails?.map(thumb => ({
                url: upgradeArtworkQuality(thumb.url),
                quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500"
              })) || [{
                url: thumbnailUrl,
                quality: "150x150"
              }],
              artist: song.artists?.[0]?.name || "Unknown Artist",
              artists: {
                primary: song.artists || []
              },
              duration: song.duration || 0,
              language: "unknown",
              year: "",
              albumId: "",
              album: song.album?.name || "",
              label: "",
              url: "",
              copyright: "",
              primaryArtists: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
              singers: "",
              composer: "",
              lyricist: "",
              producer: "",
              genre: "",
              playCount: 0,
              explicitContent: 0,
              downloadUrl: song.videoId || song.id
            };
            transformedSongs.push(transformedSong);
          }
        }

        // Transform the playlist metadata
        const transformedPlaylist = {
          id: playlistData.id || playlistId,
          name: playlistData.title || "Playlist",
          title: playlistData.title || "Playlist",
          subtitle: `YouTube Music Playlist • ${transformedSongs.length} songs`,
          type: "playlist",
          image: playlistData.thumbnails?.map(thumb => {
            const imageUrl = thumb.link || thumb.url;
            return {
              quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500",
              url: imageUrl,
              link: imageUrl
            };
          }) || [{
            quality: "150x150",
            url: "https://via.placeholder.com/150",
            link: "https://via.placeholder.com/150"
          }],
          url: playlistData.id || playlistId,
          songCount: transformedSongs.length,
          createdBy: playlistData.author || "YouTube Music",
          songs: transformedSongs,
          duration: playlistData.duration || 0,
          description: playlistData.description || "",
          explicit: false,
          artists: "YouTube Music",
          follower: `${transformedSongs.length} songs`
        };


        return {
          status: "SUCCESS",
          message: `Loaded playlist with ${transformedSongs.length} songs`,
          data: transformedPlaylist,
          success: true
        };
      }

      return {
        status: "FAILED",
        message: playlistData?.error || "No playlist data found",
        data: null,
        success: false
      };
    } catch (error) {
      console.error('YTMusic playlist fetch error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to fetch YTMusic playlist",
        data: null,
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 30, CACHE_GROUPS.PLAYLISTS); // Cache for 30 minutes
  } catch (error) {
    console.error(`Error getting YTMusic playlist data for ID ${playlistId}:`, error);
    return {
      success: false,
      data: null,
      error: error.message || 'Network or Cache Error'
    };
  }
}

async function getYTMusicAlbumData(albumId) {
  const cacheKey = `ytmusic_album_${albumId}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Album - Using Innertube Client for album: ${albumId}`);

      // Use YouTube Music Service
      const albumData = await YouTubeMusicService.getAlbum(albumId);

      console.log(`🔍 YTMusic Album - Raw response for ${albumId}:`, {
        hasData: !!albumData,
        error: albumData?.error,
        title: albumData?.title,
        tracksCount: albumData?.tracks?.length || 0,
        songsCount: albumData?.songs?.length || 0,
        thumbnailsCount: albumData?.thumbnails?.length || 0
      });

      if (albumData && !albumData.error) {
        // Transform the tracks data to match Saavn format
        const transformedSongs = [];
        // Support both 'tracks' and 'songs' property names for compatibility
        const tracksArray = albumData.tracks || albumData.songs || [];
        if (tracksArray && Array.isArray(tracksArray) && tracksArray.length > 0) {
          // Limit processing to avoid excessive callbacks
          const tracksToProcess = tracksArray.slice(0, 500); // Limit to 500 songs max

          for (const song of tracksToProcess) {
            // Skip null/invalid songs
            if (!song || !song.title) {
              continue;
            }

            // Get the best quality thumbnail
            let thumbnails = song.thumbnails;
            if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
              // Fallback to album thumbnails if song thumbnails are missing
              thumbnails = albumData.thumbnails;
            }

            let thumbnailUrl = "https://via.placeholder.com/150";
            if (thumbnails && Array.isArray(thumbnails) && thumbnails.length > 0) {
              // Get highest quality thumbnail (last one is usually highest)
              const bestThumb = thumbnails[thumbnails.length - 1];
              thumbnailUrl = upgradeArtworkQuality(bestThumb?.url || bestThumb?.link || thumbnailUrl);
            }

            // Transform song data to Saavn format
            const transformedSong = {
              id: song.videoId || song.id,
              name: song.title,
              title: song.title,
              subtitle: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
              type: "song",
              source: "ytmusic", // Mark as YTMusic song
              // Use array format with url property for compatibility
              image: thumbnails?.map(thumb => ({
                url: upgradeArtworkQuality(thumb.url || thumb.link),
                quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500"
              })) || [{
                url: thumbnailUrl,
                quality: "150x150"
              }],
              // Also add direct image URL for components that expect it
              images: thumbnails?.map(thumb => ({
                url: upgradeArtworkQuality(thumb.url || thumb.link),
                quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500"
              })) || [{
                url: thumbnailUrl,
                quality: "150x150"
              }],
              artist: song.artists?.[0]?.name || "Unknown Artist",
              artists: {
                primary: song.artists || []
              },
              duration: song.duration || 0,
              language: "unknown",
              year: albumData.year || "",
              albumId: albumData.browseId || albumId,
              album: albumData.title || "",
              label: "",
              url: "",
              copyright: "",
              primaryArtists: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
              singers: "",
              composer: "",
              lyricist: "",
              producer: "",
              genre: "",
              playCount: 0,
              explicitContent: 0,
              downloadUrl: song.videoId || song.id
            };
            transformedSongs.push(transformedSong);
          }
        }

        // Transform the album metadata
        const transformedAlbum = {
          id: albumData.browseId || albumId,
          name: albumData.title || "Unknown Album",
          title: albumData.title || "Unknown Album",
          subtitle: albumData.year ? `Album • ${albumData.year}` : "Album",
          type: "album",
          image: albumData.thumbnails?.map(thumb => {
            const imageUrl = thumb.link || thumb.url;
            return {
              quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500",
              url: imageUrl,
              link: imageUrl
            };
          }) || [{
            quality: "150x150",
            url: "https://via.placeholder.com/150",
            link: "https://via.placeholder.com/150"
          }],
          artist: albumData.artists?.[0]?.name || "Various Artists",
          artistId: albumData.artists?.[0]?.id || "",
          artists: albumData.artists?.map(a => a.name).join(", ") || "Various Artists",
          url: albumData.browseId || albumId,
          duration: albumData.duration || 0,
          explicit: false,
          language: "unknown",
          playCount: 0,
          year: albumData.year || "",
          songs: transformedSongs,
          songCount: transformedSongs.length,
          description: albumData.description || "",
          label: "",
          copyright: "",
          primaryArtists: albumData.artists?.map(a => a.name).join(", ") || "Various Artists",
          primaryArtistsId: albumData.artists?.[0]?.id || "",
          albumid: albumData.browseId || albumId,
          releaseDate: "",
          songCountText: `${transformedSongs.length} songs`
        };

        console.log(`✅ YTMusic Album - Loaded ${transformedSongs.length} songs from album: ${transformedAlbum.name}`);

        return {
          status: "SUCCESS",
          message: `Loaded album with ${transformedSongs.length} songs`,
          data: transformedAlbum,
          success: true
        };
      }

      console.log('YTMusic Album - No valid data from Innertube Client, albumData:', albumData);
      return {
        status: "FAILED",
        message: albumData?.error || `No album data found for ID: ${albumId}`,
        data: null,
        success: false
      };
    } catch (error) {
      console.error('YTMusic album fetch error:', error);
      return {
        status: "FAILED",
        message: error.message || "Failed to fetch YTMusic album",
        data: null,
        success: false
      };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 60, CACHE_GROUPS.ALBUMS); // Cache for 60 minutes
  } catch (error) {
    console.error(`Error getting YTMusic album data for ID ${albumId}:`, error);
    return {
      success: false,
      data: null,
      error: error.message || 'Network or Cache Error'
    };
  }
}

// Transform YTMusic artist details
function transformYTToSaavnArtistDetails(artistData) {
  // Transform thumbnails
  const imageArray = [];
  // Use a default or valid image if available
  const artistImage = "https://via.placeholder.com/150";

  if (artistData.thumbnails && Array.isArray(artistData.thumbnails)) {
    artistData.thumbnails.forEach((thumbnail) => {
      imageArray.push({
        url: thumbnail.url,
        quality: thumbnail.height < 300 ? "150x150" : "500x500"
      });
    });
  } else {
    imageArray.push({ url: artistImage, quality: "150x150" });
  }

  return {
    id: artistData.browseId || artistData.id,
    name: artistData.name,
    url: artistData.browseId || artistData.id,
    image: imageArray,
    followerCount: 0,
    isVerified: false,
    bio: [],
    dob: "",
    fb: "",
    twitter: "",
    wiki: "",
    availableLanguages: [],
    isRadioPresent: false
  };
}


async function getYTMusicArtistDetails(artistId) {
  const cacheKey = `ytmusic_artist_details_${artistId}`;

  const fetchFunction = async () => {
    try {
      console.log(`🌐 YTMusic Artist Details - query: ${artistId}`);

      const artistData = await YouTubeMusicService.getArtist(artistId);

      if (artistData && !artistData.error) {
        return {
          status: "SUCCESS",
          data: {
            id: artistId,
            name: artistData.name,
            image: artistData.thumbnails?.map(t => ({ url: t.url, quality: "500x500" })) || [{ url: "https://via.placeholder.com/500", quality: "500x500" }],
            followerCount: 0,
            bio: [],
            isVerified: false
          },
          success: true
        };
      }

      return { success: false, data: null };
    } catch (error) {
      console.error('YTMusic artist details error:', error);
      return { success: false, data: null };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 120, CACHE_GROUPS.SEARCH);
  } catch (error) {
    console.error(`Error getting YTMusic artist details for "${artistId}":`, error);
    return { success: false, data: null };
  }
}

async function getYTMusicArtistSongsPaginated(artistId, page = 1, limit = 20) {
  const cacheKey = `ytmusic_artist_songs_${artistId}_page${page}_limit${limit}`;

  const fetchFunction = async () => {
    try {
      // We have to fetch the full artist page to get songs
      const artistData = await YouTubeMusicService.getArtist(artistId);

      if (artistData && artistData.songs) {
        const allSongs = artistData.songs.map(transformYTToSaavnSong);

        // Simulate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedSongs = allSongs.slice(startIndex, endIndex);

        return {
          data: {
            songs: paginatedSongs,
            total: allSongs.length
          },
          success: true
        };
      }
      return { data: { songs: [], total: 0 }, success: true };
    } catch (e) {
      console.error(e);
      return { data: { songs: [], total: 0 }, success: false };
    }
  };

  try {
    return await getCachedData(cacheKey, fetchFunction, 30, CACHE_GROUPS.SEARCH);
  } catch (error) {
    return { data: { songs: [], total: 0 }, success: false };
  }
}

async function getYTMusicArtistAlbumsPaginated(artistId, page = 1, limit = 20) {
  const cacheKey = `ytmusic_artist_albums_${artistId}_page${page}_limit${limit}`;
  const fetchFunction = async () => {
    try {
      const artistData = await YouTubeMusicService.getArtist(artistId);

      if (artistData && artistData.albums) {
        const allAlbums = artistData.albums.map(transformYTToSaavnAlbum);

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedAlbums = allAlbums.slice(startIndex, endIndex);

        return {
          data: {
            albums: paginatedAlbums,
            total: allAlbums.length
          },
          success: true
        };
      }
      return { data: { albums: [], total: 0 }, success: true };
    } catch (e) {
      console.error(e);
      return { data: { albums: [], total: 0 }, success: false };
    }
  };
  try {
    return await getCachedData(cacheKey, fetchFunction, 30, CACHE_GROUPS.SEARCH);
  } catch (error) {
    return { data: { albums: [], total: 0 }, success: false };
  }
}

export {
  getYTMusicSearchSongData,
  getYTMusicSearchArtistData,
  getYTMusicSearchAlbumData,
  getYTMusicSearchPlaylistData,
  getYTMusicHomeFeed,
  getYTMusicPlaylistData,
  getYTMusicAlbumData,
  getYTMusicArtistDetails,
  getYTMusicArtistSongsPaginated,
  getYTMusicArtistAlbumsPaginated
};
