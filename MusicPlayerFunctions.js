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
        // Android-specific options for better streaming
        androidAudioContentType: 'music',
        androidAudioFocusMode: 'audiofocus_gain',
        // iOS-specific options
        iosCategory: 'playback',
        iosCategoryMode: 'default',
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
  const validSongs = songs.filter(song => song && song.id && song.url && song.title);

  if (validSongs.length === 0) {
    return;
  }

  // Get current queue to check for duplicates
  const currentQueue = await TrackPlayer.getQueue();
  const existingIds = new Set(currentQueue.filter(t => t && t.id).map(t => t.id));
  const existingUrls = new Set(currentQueue.filter(t => t && t.url).map(t => t.url.split('?')[0]));
  const existingSignatures = new Set(
    currentQueue
      .filter(t => t && t.title && t.artist)
      .map(t => `${t.title.toLowerCase().trim()}-${t.artist.toLowerCase().trim()}`)
  );

  // Filter out duplicates before processing
  const uniqueSongs = validSongs.filter(song => {
    // Check ID
    if (existingIds.has(song.id)) {
      return false;
    }

    // Check URL
    const normalizedUrl = song.url.split('?')[0];
    if (existingUrls.has(normalizedUrl)) {
      return false;
    }

    // Check title+artist signature
    if (song.title && song.artist) {
      const signature = `${song.title.toLowerCase().trim()}-${song.artist.toLowerCase().trim()}`;
      if (existingSignatures.has(signature)) {
        return false;
      }
    }

    return true;
  });

  if (uniqueSongs.length === 0) {
    console.log('📋 No new unique songs to add to queue');
    return;
  }

  const processedSongs = await Promise.all(uniqueSongs.map(async (song) => {
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
    console.log(`✅ Added ${successfulSongs.length} unique songs to queue`);
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

  try {
    // Get current queue state
    const queue = await TrackPlayer.getQueue();
    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const currentTrack = await TrackPlayer.getActiveTrack();

    // Validate queue has songs
    if (!queue || queue.length === 0) {
      console.warn('⚠️ Cannot skip: Queue is empty');
      return;
    }

    // Check if there's a next song
    if (currentIndex === null || currentIndex === undefined) {
      console.warn('⚠️ Cannot skip: No active track');
      return;
    }

    if (currentIndex >= queue.length - 1) {
      // At last song - check repeat mode
      const repeatMode = await TrackPlayer.getRepeatMode();
      if (repeatMode === 0) { // RepeatMode.Off
        console.log('📍 At last song with repeat off');
        return;
      }
      // RepeatMode.Queue or RepeatMode.Track will handle automatically
    }

    // Store current track ID to verify change
    const currentTrackId = currentTrack?.id;

    // Attempt to skip
    await TrackPlayer.skipToNext();

    // Verify track actually changed (with small delay for state update)
    await new Promise(resolve => setTimeout(resolve, 100));

    const newTrack = await TrackPlayer.getActiveTrack();
    const newTrackId = newTrack?.id;

    // If track didn't change and we're not on repeat track mode, something went wrong
    if (currentTrackId === newTrackId && currentIndex < queue.length - 1) {
      console.warn('⚠️ Track did not change after skip, retrying...');
      // Retry once
      await TrackPlayer.skipToNext();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Ensure playback starts
    await PlaySong();

  } catch (error) {
    console.error('❌ Error in PlayNextSong:', error);
    // Try to recover by just playing current track
    try {
      await PlaySong();
    } catch (recoveryError) {
      console.error('❌ Recovery failed:', recoveryError);
    }
  }
}

async function PlayPreviousSong() {
  await ensurePlayerInitialized();

  try {
    // Get current queue state
    const queue = await TrackPlayer.getQueue();
    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const currentTrack = await TrackPlayer.getActiveTrack();

    // Validate queue has songs
    if (!queue || queue.length === 0) {
      console.warn('⚠️ Cannot skip back: Queue is empty');
      return;
    }

    // Check if there's a previous song
    if (currentIndex === null || currentIndex === undefined) {
      console.warn('⚠️ Cannot skip back: No active track');
      return;
    }

    if (currentIndex <= 0) {
      // At first song - check repeat mode
      const repeatMode = await TrackPlayer.getRepeatMode();
      if (repeatMode === 0) { // RepeatMode.Off
        console.log('📍 At first song with repeat off');
        return;
      }
    }

    // Store current track ID to verify change
    const currentTrackId = currentTrack?.id;

    // Attempt to skip
    await TrackPlayer.skipToPrevious();

    // Verify track actually changed (with small delay for state update)
    await new Promise(resolve => setTimeout(resolve, 100));

    const newTrack = await TrackPlayer.getActiveTrack();
    const newTrackId = newTrack?.id;

    // If track didn't change, retry once
    if (currentTrackId === newTrackId && currentIndex > 0) {
      console.warn('⚠️ Track did not change after skip back, retrying...');
      await TrackPlayer.skipToPrevious();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Ensure playback starts
    await PlaySong();

  } catch (error) {
    console.error('❌ Error in PlayPreviousSong:', error);
    // Try to recover by just playing current track
    try {
      await PlaySong();
    } catch (recoveryError) {
      console.error('❌ Recovery failed:', recoveryError);
    }
  }
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
// Utility function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function PlaySongWithRelated(id, fallbackImage, songInfo = null) {
  await ensurePlayerInitialized();

  // Check if this is a YouTube video ID (11 chars, alphanumeric with - and _)
  const isYouTubeId = /^[a-zA-Z0-9_-]{11}$/.test(id);

  if (isYouTubeId) {
    // For YouTube, play directly without fetching related (Invidious doesn't provide good related)
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

  // JioSaavn song handling with enhanced queue building
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

    // Enhanced duplicate detection with multiple criteria
    const seenIds = new Set([mainSong.id]);
    const seenUrls = new Set([mainSong.url?.split('?')[0]]);
    const seenSignatures = new Set([
      `${mainSong.title.toLowerCase().trim()}-${mainSong.artist.toLowerCase().trim()}`
    ]);

    // Shuffle recommended songs for variety
    const shuffledRecs = shuffleArray(recs);

    for (const e of shuffledRecs) {
      try {
        const rid = e.id || e?.more_info?.id || e?.songid;
        if (!rid) {
          continue;
        }

        // Check ID duplicate
        if (seenIds.has(rid)) {
          continue;
        }

        const rimg = e?.image?.[2]?.url || e?.image?.[2]?.link || e?.image?.[0]?.url || fallbackImage;
        const rdl = e?.downloadUrl || e?.more_info?.downloadUrl;

        if (!Array.isArray(rdl) || !rdl[quality]) {
          continue;
        }

        const songUrl = rdl[quality].url;
        const normalizedUrl = songUrl?.split('?')[0];

        // Check URL duplicate
        if (normalizedUrl && seenUrls.has(normalizedUrl)) {
          continue;
        }

        const songTitle = e?.name || e?.title || "";
        const songArtist = (e?.artists?.primary || []).map(a => a.name).join(', ');

        // Check title+artist duplicate (fuzzy matching)
        if (songTitle && songArtist) {
          const signature = `${songTitle.toLowerCase().trim()}-${songArtist.toLowerCase().trim()}`;
          if (seenSignatures.has(signature)) {
            continue;
          }
          seenSignatures.add(signature);
        }

        // Validate required fields
        if (!songTitle || !songUrl) {
          continue;
        }

        queue.push({
          url: songUrl,
          title: songTitle,
          artist: songArtist,
          artwork: rimg,
          duration: e?.duration,
          id: rid,
          language: e?.language,
          artistID: e?.primary_artists_id,
          image: rimg,
          downloadUrl: rdl,
        });

        seenIds.add(rid);
        if (normalizedUrl) {
          seenUrls.add(normalizedUrl);
        }

        // Limit initial queue to prevent overwhelming (will auto-grow via ContextState)
        if (queue.length >= 30) {
          break;
        }
      } catch (_) {
        // skip malformed
      }
    }

    console.log(`🎵 Built queue with ${queue.length} unique songs (1 main + ${queue.length - 1} related)`);
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




