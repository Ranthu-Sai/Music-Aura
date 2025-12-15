import { getCachedData, CACHE_GROUPS } from '../CacheManager';
import YouTubeMusicService from '../../Utils/YouTubeMusicService';
import { upgradeArtworkQuality } from '../../Utils/YTMusicArtworkUtils';

// Helper function to transform YTMusic song data to Saavn format
function transformYTToSaavnSong(song) {
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
    image: imageArray.length > 0 ? imageArray : [{ url: "https://via.placeholder.com/150", quality: "150x150" }],
    artist: song.artists?.[0]?.name || "Unknown Artist",
    artists: { primary: song.artists || [] },
    duration: song.duration || 0,
    language: "unknown",
    year: "",
    albumId: "",
    album: "",
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
}

function transformYTToSaavnArtist(artist) {
  const imageArray = [];
  if (artist.thumbnails && Array.isArray(artist.thumbnails)) {
    artist.thumbnails.forEach((thumbnail) => {
      imageArray.push({ url: upgradeArtworkQuality(thumbnail.url), quality: thumbnail.height < 300 ? "150x150" : "500x500" });
    });
  }
  const artistId = artist.browseId || artist.id;

  return {
    id: artistId,
    name: artist.name || artist.artist,
    title: artist.name || artist.artist,
    subtitle: `${artist.type || "Artist"} • ${artist.subscribers || ""}`,
    type: "artist",
    image: imageArray.length > 0 ? imageArray : [{ url: "https://via.placeholder.com/150", quality: "150x150" }],
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

function transformYTToSaavnAlbum(album) {
  const imageArray = [];
  if (album.thumbnails && Array.isArray(album.thumbnails)) {
    album.thumbnails.forEach((thumbnail) => {
      const imageUrl = upgradeArtworkQuality(thumbnail.link || thumbnail.url);
      imageArray.push({ url: imageUrl, link: imageUrl, quality: thumbnail.height <= 226 ? "150x150" : "500x500" });
    });
  }
  const albumId = album.browseId || album.id;
  const artistName = album.artists?.[0]?.name || "Various Artists";

  return {
    id: albumId,
    name: album.title,
    title: album.title,
    subtitle: album.year ? `Album • ${album.year}` : "Album",
    type: "album",
    image: imageArray.length > 0 ? imageArray : [{ url: "https://via.placeholder.com/150", link: "https://via.placeholder.com/150", quality: "150x150" }],
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

function transformYTToSaavnPlaylist(playlist) {
  const imageArray = [];
  if (playlist.thumbnails && Array.isArray(playlist.thumbnails)) {
    playlist.thumbnails.forEach((thumbnail, index) => {
      const imageUrl = upgradeArtworkQuality(thumbnail.link || thumbnail.url);
      imageArray.push({ quality: thumbnail.height <= 192 ? "50x50" : thumbnail.height <= 226 ? "150x150" : "500x500", url: imageUrl, link: imageUrl });
    });
  }
  const playlistId = playlist.browseId || playlist.id;
  const author = playlist.author || "YouTube Music";

  return {
    id: playlistId,
    name: playlist.title,
    title: playlist.title,
    subtitle: `${author} • ${playlist.itemCount || playlist.count || 0} songs`,
    type: "playlist",
    image: imageArray.length > 0 ? imageArray : [{ quality: "150x150", url: "https://via.placeholder.com/150", link: "https://via.placeholder.com/150" }],
    url: playlistId,
    songCount: playlist.itemCount || playlist.count || 0,
    createdBy: author,
    songs: [],
    duration: 0,
    description: "",
    explicit: false,
    artists: author
  };
}

async function getYTMusicSearchSongData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_songs_${searchText}_page${page}_limit${limit}`;
  const fetchFunction = async () => {
    try {
      const searchResults = await YouTubeMusicService.search(searchText, 'songs', limit);
      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnSong);
        return { status: "SUCCESS", message: "", data: { total: transformedResults.length, start: 0, results: transformedResults }, success: true };
      }
      return { status: "SUCCESS", message: "", data: { total: 0, start: 0, results: [] }, success: false };
    } catch (error) {
      console.error('YTMusic song search error:', error);
      return { status: "FAILED", message: error.message || "Failed to search YTMusic songs", data: { total: 0, start: 0, results: [] }, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH); } catch (error) { return { success: false, data: { results: [] }, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicSearchArtistData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_artists_${searchText}_page${page}_limit${limit}`;
  const fetchFunction = async () => {
    try {
      const searchResults = await YouTubeMusicService.search(searchText, 'artists', limit);
      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnArtist);
        return { status: "SUCCESS", message: "", data: { total: transformedResults.length, start: 0, results: transformedResults }, success: true };
      }
      return { status: "SUCCESS", message: "", data: { total: 0, start: 0, results: [] }, success: false };
    } catch (error) {
      console.error('YTMusic artist search error:', error);
      return { status: "FAILED", message: error.message || "Failed to search YTMusic artists", data: { total: 0, start: 0, results: [] }, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH); } catch (error) { return { success: false, data: { results: [] }, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicSearchAlbumData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_albums_${searchText}_page${page}_limit${limit}`;
  const fetchFunction = async () => {
    try {
      const searchResults = await YouTubeMusicService.search(searchText, 'albums', limit);
      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnAlbum);
        return { status: "SUCCESS", message: "", data: { total: transformedResults.length, start: 0, results: transformedResults }, success: true };
      }
      return { status: "SUCCESS", message: "", data: { total: 0, start: 0, results: [] }, success: false };
    } catch (error) {
      console.error('YTMusic album search error:', error);
      return { status: "FAILED", message: error.message || "Failed to search YTMusic albums", data: { total: 0, start: 0, results: [] }, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH); } catch (error) { return { success: false, data: { results: [] }, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicSearchPlaylistData(searchText, page = 1, limit = 20) {
  const cacheKey = `ytmusic_search_playlists_${searchText}_page${page}_limit${limit}`;
  const fetchFunction = async () => {
    try {
      const searchResults = await YouTubeMusicService.search(searchText, 'playlists', limit);
      if (searchResults && Array.isArray(searchResults)) {
        const transformedResults = searchResults.map(transformYTToSaavnPlaylist);
        return { status: "SUCCESS", message: "", data: { total: transformedResults.length, start: 0, results: transformedResults }, success: true };
      }
      return { status: "SUCCESS", message: "", data: { total: 0, start: 0, results: [] }, success: false };
    } catch (error) {
      console.error('YTMusic playlist search error:', error);
      return { status: "FAILED", message: error.message || "Failed to search YTMusic playlists", data: { total: 0, start: 0, results: [] }, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 5, CACHE_GROUPS.SEARCH); } catch (error) { return { success: false, data: { results: [] }, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicHomeFeed(limit = 10) {
  const cacheKey = `ytmusic_homefeed_limit_${limit}`;
  const fetchFunction = async () => {
    try {
      const homeFeedData = await YouTubeMusicService.getHomeFeed(limit);
      if (homeFeedData) {
        const parsedData = typeof homeFeedData === 'string' ? JSON.parse(homeFeedData) : homeFeedData;
        if (parsedData && Array.isArray(parsedData)) {
          const feedSections = parsedData;
          const playlists = [];
          const albums = [];
          feedSections.forEach((section) => {
            if (section.contents && Array.isArray(section.contents)) {
              section.contents.forEach((item) => {
                if (item.playlistId) {
                  playlists.push(transformYTToSaavnPlaylist({ id: item.playlistId, title: item.title, thumbnails: item.thumbnails || [] }));
                } else if (item.browseId) {
                  albums.push(transformYTToSaavnAlbum({ id: item.browseId, title: item.title, thumbnails: item.thumbnails || [], year: item.year || '' }));
                }
              });
            }
          });
          const finalPlaylists = playlists.slice(0, 20);
          const finalAlbums = albums.slice(0, 20);
          return { status: "SUCCESS", message: `Found ${finalPlaylists.length} playlists and ${finalAlbums.length} albums`, data: { playlists: finalPlaylists, albums: finalAlbums, feed: feedSections }, success: true };
        }
      }
      return { status: "SUCCESS", message: "No data available", data: { playlists: [], albums: [], feed: [] }, success: false };
    } catch (error) {
      console.error('YTMusic homefeed error:', error);
      return { status: "FAILED", message: error.message || "Failed to fetch YTMusic homefeed", data: { playlists: [], albums: [], feed: [] }, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 7200, CACHE_GROUPS.HOME); } catch (error) { return { success: false, data: { playlists: [], albums: [], feed: [] }, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicPlaylistData(playlistId) {
  const cacheKey = `ytmusic_playlist_${playlistId}`;
  const fetchFunction = async () => {
    try {
      const playlistData = await YouTubeMusicService.getPlaylist(playlistId);
      if (playlistData && !playlistData.error) {
        const transformedSongs = [];
        const tracks = playlistData.songs || playlistData.tracks || [];
        const tracksToProcess = tracks.slice(0, 500);
        for (const song of tracksToProcess) {
          if (!song || !song.title) continue;
          let thumbnailUrl = "https://via.placeholder.com/150";
          if (song.thumbnails && Array.isArray(song.thumbnails) && song.thumbnails.length > 0) {
            const bestThumb = song.thumbnails[song.thumbnails.length - 1];
            thumbnailUrl = upgradeArtworkQuality(bestThumb?.url || thumbnailUrl);
          }
          const transformedSong = {
            id: song.videoId || song.id,
            name: song.title,
            title: song.title,
            subtitle: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
            type: "song",
            source: "ytmusic",
            image: song.thumbnails?.map(thumb => ({ url: upgradeArtworkQuality(thumb.url), quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500" })) || [{ url: thumbnailUrl, quality: "150x150" }],
            images: song.thumbnails?.map(thumb => ({ url: upgradeArtworkQuality(thumb.url), quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500" })) || [{ url: thumbnailUrl, quality: "150x150" }],
            artist: song.artists?.[0]?.name || "Unknown Artist",
            artists: { primary: song.artists || [] },
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
        const transformedPlaylist = {
          id: playlistData.id || playlistId,
          name: playlistData.title || "Playlist",
          title: playlistData.title || "Playlist",
          subtitle: `YouTube Music Playlist • ${transformedSongs.length} songs`,
          type: "playlist",
          image: playlistData.thumbnails?.map(thumb => { const imageUrl = thumb.link || thumb.url; return { quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500", url: imageUrl, link: imageUrl }; }) || [{ quality: "150x150", url: "https://via.placeholder.com/150", link: "https://via.placeholder.com/150" }],
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
        return { status: "SUCCESS", message: `Loaded playlist with ${transformedSongs.length} songs`, data: transformedPlaylist, success: true };
      }
      return { status: "FAILED", message: playlistData?.error || "No playlist data found", data: null, success: false };
    } catch (error) {
      console.error('YTMusic playlist fetch error:', error);
      return { status: "FAILED", message: error.message || "Failed to fetch YTMusic playlist", data: null, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 30, CACHE_GROUPS.PLAYLISTS); } catch (error) { return { success: false, data: null, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicAlbumData(albumId) {
  const cacheKey = `ytmusic_album_${albumId}`;
  const fetchFunction = async () => {
    try {
      const albumData = await YouTubeMusicService.getAlbum(albumId);
      if (albumData && !albumData.error) {
        const transformedSongs = [];
        const tracksArray = albumData.tracks || albumData.songs || [];
        const tracksToProcess = tracksArray.slice(0, 500);
        for (const song of tracksToProcess) {
          if (!song || !song.title) continue;
          let thumbnails = song.thumbnails;
          if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) thumbnails = albumData.thumbnails;
          let thumbnailUrl = "https://via.placeholder.com/150";
          if (thumbnails && Array.isArray(thumbnails) && thumbnails.length > 0) { const bestThumb = thumbnails[thumbnails.length - 1]; thumbnailUrl = upgradeArtworkQuality(bestThumb?.url || bestThumb?.link || thumbnailUrl); }
          const transformedSong = {
            id: song.videoId || song.id,
            name: song.title,
            title: song.title,
            subtitle: song.artists?.map(artist => artist.name).join(", ") || "Unknown Artist",
            type: "song",
            source: "ytmusic",
            image: thumbnails?.map(thumb => ({ url: upgradeArtworkQuality(thumb.url || thumb.link), quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500" })) || [{ url: thumbnailUrl, quality: "150x150" }],
            images: thumbnails?.map(thumb => ({ url: upgradeArtworkQuality(thumb.url || thumb.link), quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500" })) || [{ url: thumbnailUrl, quality: "150x150" }],
            artist: song.artists?.[0]?.name || "Unknown Artist",
            artists: { primary: song.artists || [] },
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
        const transformedAlbum = {
          id: albumData.browseId || albumId,
          name: albumData.title || "Unknown Album",
          title: albumData.title || "Unknown Album",
          subtitle: albumData.year ? `Album • ${albumData.year}` : "Album",
          type: "album",
          image: albumData.thumbnails?.map(thumb => { const imageUrl = thumb.link || thumb.url; return { quality: thumb.height <= 192 ? "50x50" : thumb.height <= 226 ? "150x150" : "500x500", url: imageUrl, link: imageUrl }; }) || [{ quality: "150x150", url: "https://via.placeholder.com/150", link: "https://via.placeholder.com/150" }],
          artist: albumData.artists?.[0]?.name || "Various Artists",
          artistId: albumData.artists?.[0]?.id || "",
          artists: albumData.artists?.map(a => a.name).join(', ') || "Various Artists",
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
          primaryArtists: albumData.artists?.map(a => a.name).join(', ') || "Various Artists",
          primaryArtistsId: albumData.artists?.[0]?.id || "",
          albumid: albumData.browseId || albumId,
          releaseDate: "",
          songCountText: `${transformedSongs.length} songs`
        };
        return { status: "SUCCESS", message: `Loaded album with ${transformedSongs.length} songs`, data: transformedAlbum, success: true };
      }
      return { status: "FAILED", message: albumData?.error || `No album data found for ID: ${albumId}`, data: null, success: false };
    } catch (error) {
      console.error('YTMusic album fetch error:', error);
      return { status: "FAILED", message: error.message || "Failed to fetch YTMusic album", data: null, success: false };
    }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 60, CACHE_GROUPS.ALBUMS); } catch (error) { return { success: false, data: null, error: error.message || 'Network or Cache Error' }; }
}

async function getYTMusicArtistDetails(artistId) {
  const cacheKey = `ytmusic_artist_details_${artistId}`;
  const fetchFunction = async () => {
    try {
      const artistData = await YouTubeMusicService.getArtist(artistId);
      if (artistData && !artistData.error) {
        return { status: "SUCCESS", data: { id: artistId, name: artistData.name, image: artistData.thumbnails?.map(t => ({ url: t.url, quality: "500x500" })) || [{ url: "https://via.placeholder.com/500", quality: "500x500" }], followerCount: 0, bio: [], isVerified: false }, success: true };
      }
      return { success: false, data: null };
    } catch (error) { console.error('YTMusic artist details error:', error); return { success: false, data: null }; }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 120, CACHE_GROUPS.SEARCH); } catch (error) { return { success: false, data: null }; }
}

async function getYTMusicArtistSongsPaginated(artistId, page = 1, limit = 20) {
  const cacheKey = `ytmusic_artist_songs_${artistId}_page${page}_limit${limit}`;
  const fetchFunction = async () => {
    try {
      const artistData = await YouTubeMusicService.getArtist(artistId);
      if (artistData && artistData.songs) {
        const allSongs = artistData.songs.map(transformYTToSaavnSong);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedSongs = allSongs.slice(startIndex, endIndex);
        return { data: { songs: paginatedSongs, total: allSongs.length }, success: true };
      }
      return { data: { songs: [], total: 0 }, success: true };
    } catch (e) { console.error(e); return { data: { songs: [], total: 0 }, success: false }; }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 30, CACHE_GROUPS.SEARCH); } catch (error) { return { data: { songs: [], total: 0 }, success: false }; }
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
        return { data: { albums: paginatedAlbums, total: allAlbums.length }, success: true };
      }
      return { data: { albums: [], total: 0 }, success: true };
    } catch (e) { console.error(e); return { data: { albums: [], total: 0 }, success: false }; }
  };
  try { return await getCachedData(cacheKey, fetchFunction, 30, CACHE_GROUPS.SEARCH); } catch (error) { return { data: { albums: [], total: 0 }, success: false }; }
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
