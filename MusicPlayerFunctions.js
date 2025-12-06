import TrackPlayer from "react-native-track-player";
//import { setRepeatMode } from "react-native-track-player/lib/trackPlayer";
import { GetPlaybackQuality } from "./LocalStorage/AppSettings";
import { getSongData } from "./Api/Songs";
import { getRecommendedSongs } from "./Api/Recommended";
import { getYTMusicStreamUrl } from "./Api/YTMusicStream";

let playerInitialized = false;

async function ensurePlayerInitialized() {
  if (!playerInitialized) {
    try {
      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
        autoHandleInterruptions: true,
      });
      playerInitialized = true;
    } catch (error) {
      if (error.message?.includes('already been initialized')) {
        playerInitialized = true;
      } else {
        console.warn('Failed to initialize TrackPlayer:', error);
        throw error;
      }
    }
  }
}

async function PlayOneSong(song) {

  await ensurePlayerInitialized();

  if (!song.url) {
    alert('Cannot play: Song URL is missing');
    return;
  }

  // Check if it's a YouTube video ID (not a full URL)
  if (!song.url.startsWith('http')) {
    try {
      const streamData = await getYTMusicStreamUrl(song.url);
      song.url = streamData.url;
      song.headers = streamData.headers; // Use headers from streaming function
    } catch (error) {
      console.error('❌ Stream URL resolution failed:', error.message);
      alert(`Unable to play this song.\n${error.message || 'YouTube Music stream unavailable.'}`);
      return;
    }
  }

  // Add track with headers
  const trackToAdd = {
    ...song,
    // Use headers from song if available (YouTube), otherwise use default headers
    headers: song.headers || {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    // Some versions of TrackPlayer need userAgent explicitly
    userAgent: song.headers?.['User-Agent'] || 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
  };

  await TrackPlayer.reset();
  await TrackPlayer.add([trackToAdd]);
  await TrackPlayer.play();
}
async function AddPlaylist(songs) {
  await ensurePlayerInitialized();

  if (!songs || !Array.isArray(songs)) {
    return;
  }

  // Filter out null/undefined songs and songs without required properties
  const validSongs = songs.filter(song => song && song.id && song.url);

  if (validSongs.length === 0) {
    return;
  }

  const processedSongs = await Promise.all(validSongs.map(async (song) => {
    if (!song.url.startsWith('http')) {
      try {
        const streamData = await getYTMusicStreamUrl(song.url);
        return {
          ...song,
          url: streamData.url,
          headers: streamData.headers, // Use headers from streaming function
        };
      } catch (error) {
        console.warn(`⚠️ Failed to resolve stream for ${song.title || song.url}:`, error.message);
        return null; // Filter out failed songs
      }
    }
    return song;
  }));

  // Filter out null entries (failed resolutions)
  const successfulSongs = processedSongs.filter(s => s !== null);

  if (successfulSongs.length === 0) {
    alert('Unable to play any songs from this playlist. All streams are unavailable.');
    return;
  }

  await TrackPlayer.reset();
  await TrackPlayer.add(successfulSongs);
  await TrackPlayer.play();
}

async function AddSongsToQueue(songs) {
  await ensurePlayerInitialized();

  if (!songs || !Array.isArray(songs)) {
    return;
  }

  // Filter out null/undefined songs and songs without required properties
  const validSongs = songs.filter(song => song && song.id && song.url);

  if (validSongs.length === 0) {
    return;
  }

  const processedSongs = await Promise.all(validSongs.map(async (song) => {
    if (!song.url.startsWith('http')) {
      try {
        const streamData = await getYTMusicStreamUrl(song.url);
        return {
          ...song,
          url: streamData.url,
          headers: streamData.headers, // Use headers from streaming function
        };
      } catch (error) {
        console.warn(`⚠️ Failed to resolve stream for ${song.title || song.url}:`, error.message);
        return null; // Filter out failed songs
      }
    }
    return song;
  }));

  // Filter out null entries (failed resolutions)
  const successfulSongs = processedSongs.filter(s => s !== null);

  if (successfulSongs.length > 0) {
    await TrackPlayer.add(successfulSongs);
  }
}
async function PlaySong() {
  await ensurePlayerInitialized();
  await TrackPlayer.play();
}
async function PauseSong() {
  await ensurePlayerInitialized();
  await TrackPlayer.pause();
}

async function SetProgressSong(value) {
  await ensurePlayerInitialized();
  await TrackPlayer.seekTo(value);
}

async function PlayNextSong() {
  await ensurePlayerInitialized();
  await TrackPlayer.skipToNext();
  PlaySong()
}

async function PlayPreviousSong() {
  await ensurePlayerInitialized();
  await TrackPlayer.skipToPrevious();
  PlaySong()
}
async function SkipToTrack(trackIndex) {
  await ensurePlayerInitialized();
  await TrackPlayer.skip(trackIndex);
  await PlaySong()
}
async function SetRepeatMode(mode) {
  await ensurePlayerInitialized();
  await TrackPlayer.setRepeatMode(mode)
}

async function getIndexQuality() {
  const PlaybackQuality = [
    { value: '12kbps' },
    { value: '48kbps' },
    { value: '96kbps' },
    { value: '160kbps' },
    { value: '320kbps' },
  ];
  const data = await GetPlaybackQuality()
  let index = 4
  PlaybackQuality.map((e, i) => {
    if (e.value === data) {
      index = i
    }
  })
  return index
}

export { PlayOneSong, PlaySong, PauseSong, SetProgressSong, PlayNextSong, AddPlaylist, PlayPreviousSong, AddSongsToQueue, SkipToTrack, SetRepeatMode, getIndexQuality }

// Build a fresh queue from a song id + related songs, then play
export async function PlaySongWithRelated(id, fallbackImage, songInfo = null) {
  await ensurePlayerInitialized();

  // Check if this is a YouTube video ID (11 chars, alphanumeric with - and _)
  const isYouTubeId = /^[a-zA-Z0-9_-]{11}$/.test(id);

  if (isYouTubeId) {    // For YouTube, play directly without fetching related (Invidious doesn't provide good related)
    await PlayOneSong({
      url: songInfo?.url || id, // Use provided URL or fallback to ID
      title: songInfo?.title || 'Loading...',
      artist: songInfo?.artist || 'YouTube',
      artwork: fallbackImage || `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      duration: songInfo?.duration || 0,
      id: id,
      language: songInfo?.language || 'en',
      image: fallbackImage || `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    });
    return;
  }

  // JioSaavn song handling (original code)
  try {
    const [songData, quality, related] = await Promise.all([
      getSongData(id),
      getIndexQuality(),
      getRecommendedSongs(id).catch(() => ({ data: [] })),
    ]);
    const songObj = songData?.data?.[0];
    if (!songObj) {
      throw new Error('Song not found');
    }
    const mainSong = {
      url: songObj.downloadUrl?.[quality]?.url || songObj.downloadUrl?.[0]?.url,
      title: songObj.name,
      artist: (songObj.artists?.primary || []).map(a => a.name).join(', '),
      artwork: songObj.image?.[2]?.url || fallbackImage,
      duration: songObj.duration,
      id: songObj.id,
      language: songObj.language,
      artistID: songObj.primary_artists_id,
      image: songObj.image?.[2]?.url || fallbackImage,
      downloadUrl: songObj.downloadUrl,
    };
    const recs = Array.isArray(related?.data) ? related.data : [];
    const queue = [mainSong];
    const seen = new Set([mainSong.id]);
    for (const e of recs) {
      try {
        const rid = e.id || e?.more_info?.id || e?.songid;
        if (!rid || seen.has(rid)) {
          continue;
        }
        const rimg = e?.image?.[2]?.url || e?.image?.[2]?.link || e?.image?.[0]?.url || fallbackImage;
        const rdl = e?.downloadUrl || e?.more_info?.downloadUrl;
        if (!Array.isArray(rdl) || !rdl[quality]) {
          continue;
        }
        queue.push({
          url: rdl[quality].url,
          title: e?.name || e?.title || "",
          artist: (e?.artists?.primary || []).map(a => a.name).join(', '),
          artwork: rimg,
          duration: e?.duration,
          id: rid,
          language: e?.language,
          artistID: e?.primary_artists_id,
          image: rimg,
          downloadUrl: rdl,
        });
        seen.add(rid);
      } catch (_) {
        // skip malformed
      }
    }
    await AddPlaylist(queue);
  } catch (e) {
    // fallback to just attempting to play id if related or details failed
    try {
      const songData = await getSongData(id);
      const quality = await getIndexQuality();
      const songObj = songData?.data?.[0];
      if (!songObj) {
        return;
      }
      await PlayOneSong({
        url: songObj.downloadUrl?.[quality]?.url || songObj.downloadUrl?.[0]?.url,
        title: songObj.name,
        artist: (songObj.artists?.primary || []).map(a => a.name).join(', '),
        artwork: songObj.image?.[2]?.url || fallbackImage,
        duration: songObj.duration,
        id: songObj.id,
        language: songObj.language,
        artistID: songObj.primary_artists_id,
        image: songObj.image?.[2]?.url || fallbackImage,
        downloadUrl: songObj.downloadUrl,
      });
    } catch (_) {
      // give up silently
    }
  }
}



