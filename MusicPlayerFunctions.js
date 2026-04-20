import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  State,
} from 'react-native-track-player';
import {GetPlaybackQuality} from './LocalStorage/AppSettings';
import {GetLanguageValue} from './LocalStorage/Languages';
import NetInfo from '@react-native-community/netinfo';
import {
  ToastAndroid,
  DeviceEventEmitter,
  InteractionManager,
} from 'react-native';
import historyManager from './Utils/HistoryManager';

import youtubeStreamingService from './Utils/YouTubeStreamingService';
import queueManager from './Utils/QueueManager';
import {
  enhanceYTMusicArtwork,
  getPrimaryArtworkUrl,
} from './Utils/ArtworkEnhancer';
import autoRecommendations from './Utils/AutoRecommendations';
import skipOperationManager from './Utils/SkipOperationManager';
import smartPrefetchManager from './Utils/SmartPrefetchManager';
import FormatTitleAndArtist from './Utils/FormatTitleAndArtist';
import ManualSkipFlag from './Utils/ManualSkipFlag';

let isPlayerInitialized = false;
let playerSetupPromise = null;
let setupInitiated = false;
let isSkipInProgress = false; // Prevent multiple simultaneous skip operations
const DEBUG_LOGS = false;
const debugLog = (...args) => {
  if (DEBUG_LOGS) {

  }
};

// Remove a specific track from the queue by its TrackPlayer index
async function removeFromQueue(index) {
  try {
    if (typeof index !== 'number' || index < 0) {
      return;
    }

    // Ensure player is initialized before attempting to remove
    if (!isPlayerInitialized) {
      console.warn('Player not initialized, cannot remove from queue');
      return;
    }

    await TrackPlayer.remove(index);

  } catch (error) {
    console.error('Error removing track from queue:', error);
  }
}

// Helper to extract artwork URL from various formats
const extractArtwork = song => {
  // Direct artwork/image string
  if (
    song.artwork &&
    typeof song.artwork === 'string' &&
    song.artwork.length > 0
  ) {
    return song.artwork;
  }
  if (song.image && typeof song.image === 'string' && song.image.length > 0) {
    return song.image;
  }

  // Object format with url/uri
  if (song.artwork && typeof song.artwork === 'object') {
    if (song.artwork.url) {
      return song.artwork.url;
    }
    if (song.artwork.uri) {
      return song.artwork.uri;
    }
  }

  // Array format (Saavn/OuterTune)
  if (song.image && Array.isArray(song.image)) {
    const bestImage =
      song.image[2] || song.image[song.image.length - 1] || song.image[0];
    if (bestImage?.url) {
      return bestImage.url;
    }
    if (bestImage?.link) {
      return bestImage.link;
    }
    if (typeof bestImage === 'string') {
      return bestImage;
    }
  }

  // Single Image Object format
  if (song.image && typeof song.image === 'object') {
    if (song.image.url) {
      return song.image.url;
    }
    if (song.image.uri) {
      return song.image.uri;
    }
  }

  // Thumbnail format (YTMusic)
  if (song.thumbnail) {
    if (typeof song.thumbnail === 'string') {
      return song.thumbnail;
    }
    if (typeof song.thumbnail === 'object' && song.thumbnail.url) {
      return song.thumbnail.url;
    }
  }

  if (song.thumbnails && Array.isArray(song.thumbnails)) {
    const bestThumb =
      song.thumbnails[song.thumbnails.length - 1] || song.thumbnails[0];
    if (bestThumb?.url) {
      return bestThumb.url;
    }
  }

  // Try to find any property that looks like a URL
  if (song.artwork?.uri) {
    return song.artwork.uri;
  }
  if (song.image?.uri) {
    return song.image.uri;
  }

  return undefined; // Return undefined instead of empty string to avoid TrackPlayer error
};

// Safe HTTP GET helper: prefer axios if available, otherwise fall back to fetch
const safeHttpGet = async (url, opts = {}) => {
  // Try to use axios if present in the bundle
  try {
    const axios = require('axios');
    if (axios && typeof axios.get === 'function') {
      return await axios.get(url, opts);
    }
  } catch (e) {
    // axios not available or failed to load - fall through to fetch
  }

  // Fallback to fetch (React Native global fetch)
  try {
    const timeout = opts.timeout;
    let controller;
    let timeoutId;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      if (timeout && Number(timeout) > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
      }
    }

    const response = await fetch(
      url,
      controller ? {signal: controller.signal} : {},
    );
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const contentType = response.headers?.get?.('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    }

    return {data, status: response.status};
  } catch (fetchErr) {
    throw fetchErr;
  }
};

// Quick synchronous setup: just initialize the player core.
// Returns immediately so play() can be called quickly.
// Full options setup happens in ensurePlayerSetup() in background.
const quickSetup = async () => {
  if (isPlayerInitialized) {
    return true;
  }

  try {
    await TrackPlayer.setupPlayer({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.ContinuePlayback,
        alwaysPauseOnInterruption: false,
      },
      autoHandleInterruptions: true,
      autoUpdateMetadata: true,
      waitForBuffer: true,
    });
    isPlayerInitialized = true;
    return true;
  } catch (error) {
    if (error?.message?.includes('already been initialized')) {
      isPlayerInitialized = true;
      return true;
    }
    console.warn('quickSetup failed:', error);
    return false;
  }
};

// Start player initialization in the background without blocking.
// This allows play() to be called immediately even if setup isn't fully complete.
export const ensurePlayerSetup = () => {
  if (setupInitiated || isPlayerInitialized) {
    return; // Already started or complete
  }

  setupInitiated = true;

  playerSetupPromise = (async () => {
    try {
      // Ensure quick setup is done first
      if (!isPlayerInitialized) {
        await quickSetup();
      }

      // Now do full options configuration
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.ContinuePlayback,
          alwaysPauseOnInterruption: false,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
      });

      smartPrefetchManager.initialize();
    } catch (setupError) {
      const message = setupError?.message || '';
      if (message.includes('player has already been initialized')) {
        // Already initialized, just continue
      } else if (!isPlayerInitialized) {
        console.error('Error setting up player in MusicPlayerFunctions:', setupError);
      }
    } finally {
      playerSetupPromise = null;
    }
  })();
};

// Await player initialization if needed (for background operations that require it).
export const awaitPlayerSetup = async () => {
  try {
    if (!isPlayerInitialized && playerSetupPromise) {
      await playerSetupPromise;
    }
  } catch (error) {
    console.error('Error in awaitPlayerSetup:', error);
  }
};

// Deprecated: use ensurePlayerSetup + awaitPlayerSetup instead.
// Kept for backward compatibility.
export const setupPlayer = async () => {
  ensurePlayerSetup();
  // For callers that need to wait, allow them to await the setup
  if (playerSetupPromise) {
    try {
      await playerSetupPromise;
    } catch (_) {
      // Already logged
    }
  }
  return isPlayerInitialized;
};

async function PlayOneSong(song, options = {}) {
  try {
    const {clearQueue = false} = options;
    // Validate song object
    if (!song) {
      console.error('PlayOneSong: No song provided');
      return;
    }

    // CRITICAL: Ensure player core is initialized before any queue operations.
    // This must complete before calling add() / play() / getQueue().
    if (!isPlayerInitialized) {
      const success = await quickSetup();
      if (!success) {
        console.error('PlayOneSong: Failed to initialize player');
        return;
      }
      // Small stabilization delay to ensure native player is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Kick off full background setup (options, capabilities) for later use.
    // This doesn't block playback start.
    ensurePlayerSetup();

    // Get the appropriate URL based on playback quality setting
    // Prioritize downloadUrl for Saavn songs, fallback to url
    let playbackUrl = song.url;
    let updatedSong = {...song};

    // If downloadUrl exists (Saavn songs), use it instead of url
    if (
      song.downloadUrl &&
      Array.isArray(song.downloadUrl) &&
      song.downloadUrl.length > 0
    ) {
      playbackUrl = song.downloadUrl;
      updatedSong.url = song.downloadUrl; // Ensure url is set for downstream processing
    }

    // Handle case where `song.url` or `downloadUrl` is an array of quality objects
    // e.g. [{ quality: '12kbps', url: '...' }, { quality: '160kbps', url: '...' }]
    if (Array.isArray(playbackUrl)) {
      try {
        const qualityIndex = await getIndexQuality();
        // Prefer configured quality, fall back to highest available
        const preferred =
          playbackUrl[qualityIndex] &&
          (playbackUrl[qualityIndex].url ||
            playbackUrl[qualityIndex].link ||
            playbackUrl[qualityIndex].download);
        if (preferred) {
          playbackUrl = preferred;
        } else {
          // Find highest-quality available by iterating from end
          for (let i = playbackUrl.length - 1; i >= 0; i--) {
            const candidate = playbackUrl[i];
            const candidateUrl =
              candidate &&
              (candidate.url || candidate.link || candidate.download);
            if (candidateUrl) {
              playbackUrl = candidateUrl;
              break;
            }
          }
        }
        // If playbackUrl is now a string, update song copy
        if (typeof playbackUrl === 'string') {
          updatedSong.url = playbackUrl;
        }
      } catch (err) {
        // If quality lookup fails, ignore and continue — other handlers will try
        console.warn(
          'PlayOneSong: Failed to select quality from url array',
          err,
        );
      }
    }

    // Check if this is a YouTube song (has videoId/id that looks like YouTube video ID)
    // Honor explicit flag `song.isYouTubeSong` when provided (e.g., callers that know the source)
    const isYouTubeSong =
      song.isYouTubeSong === true ||
      (song.id &&
        typeof song.id === 'string' &&
        song.id.length === 11 &&
        !song.isLocalMusic);

    if (isYouTubeSong) {
      // If the song already has a real stream URL from prefetch, use it
      if (
        updatedSong.url &&
        typeof updatedSong.url === 'string' &&
        updatedSong.url.trim() !== '' &&
        !updatedSong.url.startsWith('ytmusic://')
      ) {
        playbackUrl = updatedSong.url;
        updatedSong = {
          ...updatedSong,
          _needsStream: false,
          isYTMusic: true,
        };
      } else {
        // Use placeholder for lazy loading
        playbackUrl = `ytmusic://${song.id}`;
        updatedSong = {
          ...updatedSong,
          url: playbackUrl,
          _needsStream: true,
          isYTMusic: true,
        };
      }
    } else {
      // If song has multiple quality URLs, select based on setting
      if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
        const qualityIndex = await getIndexQuality();
        const preferredQuality = song.downloadUrl[qualityIndex];
        if (preferredQuality?.url || preferredQuality?.link) {
          playbackUrl = preferredQuality.url || preferredQuality.link;
        } else {
          // Fallback to any available URL
          for (let i = song.downloadUrl.length - 1; i >= 0; i--) {
            const candidate = song.downloadUrl[i];
            if (candidate?.url || candidate?.link) {
              playbackUrl = candidate.url || candidate.link;
              break;
            }
          }
        }
      } else if (song.download_url && Array.isArray(song.download_url)) {
        // Alternative format
        const qualityIndex = await getIndexQuality();
        const preferredQuality = song.download_url[qualityIndex];
        if (preferredQuality?.url || preferredQuality?.link) {
          playbackUrl = preferredQuality.url || preferredQuality.link;
        } else {
          // Fallback to any available URL
          for (let i = song.download_url.length - 1; i >= 0; i--) {
            const candidate = song.download_url[i];
            if (candidate?.url || candidate?.link) {
              playbackUrl = candidate.url || candidate.link;
              break;
            }
          }
        }
      }
    }

    // Validate song URL - if missing, attempt a best-effort fetch for non-YouTube songs
    if (
      !playbackUrl ||
      typeof playbackUrl !== 'string' ||
      playbackUrl.trim() === ''
    ) {
      // Try to resolve missing URLs for non-YouTube tracks using API lookup + search fallback
      if (!isYouTubeSong && song.id) {
        try {
          const {getSongData} = require('./Api/Songs');
          const apiResp = await getSongData(song.id);

          let songInfo = apiResp;
          if (apiResp && apiResp.data) {
            songInfo = apiResp.data;
          }
          if (
            songInfo &&
            songInfo.results &&
            Array.isArray(songInfo.results) &&
            songInfo.results.length > 0
          ) {
            songInfo = songInfo.results[0];
          }

          const candidateDownload =
            songInfo?.downloadUrl ||
            songInfo?.download_url ||
            songInfo?.downloadUrls ||
            songInfo?.media?.downloadUrl;
          const candidateUrl =
            songInfo?.url ||
            songInfo?.stream_url ||
            songInfo?.playUrl ||
            songInfo?.downloadUrl ||
            songInfo?.download_url;

          if (candidateDownload) {
            if (Array.isArray(candidateDownload)) {
              playbackUrl =
                candidateDownload[0] ||
                candidateDownload.find(d => d?.url)?.url ||
                playbackUrl;
            } else if (typeof candidateDownload === 'string') {
              playbackUrl = candidateDownload;
            }
          } else if (candidateUrl) {
            playbackUrl = candidateUrl;
          }

          // If still missing, try a Saavn-style search by title+artist
          if (
            (!playbackUrl ||
              typeof playbackUrl !== 'string' ||
              playbackUrl.trim() === '') &&
            song.title
          ) {
            try {
              const query = encodeURIComponent(
                (song.title || '') + ' ' + (song.artist || ''),
              );
              const searchUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${query}&limit=1`;
              const searchResp = await safeHttpGet(searchUrl);
              const respData =
                (searchResp && (searchResp.data || searchResp)) || {};
              const results =
                (respData && (respData.data?.results || respData.results)) ||
                [];
              if (results && results.length > 0) {
                const first = results[0];
                const cand =
                  first?.downloadUrl ||
                  first?.download_url ||
                  first?.url ||
                  first?.stream_url ||
                  first?.playUrl;
                if (cand) {
                  if (Array.isArray(cand)) {
                    playbackUrl =
                      cand[0] || cand.find(d => d?.url)?.url || playbackUrl;
                  } else if (typeof cand === 'string') {
                    playbackUrl = cand;
                  }
                }
                // Merge any improved metadata
                song.title =
                  song.title || first.title || first.name || song.title;
                song.artist =
                  song.artist ||
                  first.artist ||
                  first.artists ||
                  first.primaryArtists ||
                  first.primary_artists ||
                  first.subtitle ||
                  song.artist;
                song.artwork =
                  song.artwork ||
                  first.image ||
                  first.thumbnails ||
                  first.albumCover ||
                  first.cover ||
                  song.artwork;
              }
            } catch (e) {
              console.warn(
                'PlayOneSong: search fallback failed',
                e?.message || e,
              );
            }
          }

          if (
            playbackUrl &&
            typeof playbackUrl === 'string' &&
            playbackUrl.trim() !== ''
          ) {
            updatedSong.url = playbackUrl;
          }
        } catch (e) {
          console.warn('PlayOneSong: fallback fetch failed', e?.message || e);
        }
      }

      if (
        !playbackUrl ||
        typeof playbackUrl !== 'string' ||
        playbackUrl.trim() === ''
      ) {
        console.error('PlayOneSong: Invalid or missing song URL', song);
        ToastAndroid.show('Cannot play song - invalid URL', ToastAndroid.SHORT);
        return;
      }
    }

    // Check if the song is a local file (has a path or isLocalMusic property)
    const isLocalFile =
      song.isLocalMusic || song.path || playbackUrl.startsWith('file://');

    // If it's a local file, make sure the URL starts with file://
    if (isLocalFile && !playbackUrl.startsWith('file://') && song.path) {
      playbackUrl = `file://${song.path}`;
    }

    // Fast-start path: for YouTube placeholder URLs, trigger playback immediately.
    // Keep this BEFORE network checks so app-close race does not clear notification.
    const isYouTubePlaceholder =
      isYouTubeSong &&
      typeof playbackUrl === 'string' &&
      playbackUrl.startsWith('ytmusic://');

    if (isYouTubePlaceholder) {
      const songForFastPlayback = {
        ...updatedSong,
        url: playbackUrl,
        title: FormatTitleAndArtist(updatedSong.title, updatedSong.artist),
        artist: FormatTitleAndArtist(updatedSong.artist),
        artwork:
          getPrimaryArtworkUrl(
            enhanceYTMusicArtwork(updatedSong.artwork || updatedSong.image, 'playing'),
          ) ||
          updatedSong.artwork ||
          updatedSong.image ||
          undefined,
      };

      if (clearQueue) {
        await TrackPlayer.reset();
        await TrackPlayer.add([songForFastPlayback]);
        await TrackPlayer.play();
      } else {
        const queue = await TrackPlayer.getQueue();
        const existingIndex = queue.findIndex(track => track.id === songForFastPlayback.id);

        if (existingIndex >= 0) {
          await TrackPlayer.skip(existingIndex);
          await TrackPlayer.play();
        } else if (queue.length > 0) {
          try {
            const currentIndex = await TrackPlayer.getActiveTrackIndex();
            const insertIndex =
              typeof currentIndex === 'number' && currentIndex >= 0
                ? currentIndex + 1
                : 0;
            await TrackPlayer.add([songForFastPlayback], insertIndex);
            await TrackPlayer.skip(insertIndex);
            await TrackPlayer.play();
          } catch (insertErr) {
            console.warn('Fast insert failed, appending to queue:', insertErr);
            await TrackPlayer.add([songForFastPlayback]);
            const appendedQueue = await TrackPlayer.getQueue();
            const lastIndex = Math.max(0, appendedQueue.length - 1);
            await TrackPlayer.skip(lastIndex);
            await TrackPlayer.play();
          }
        } else {
          await TrackPlayer.add([songForFastPlayback]);
          await TrackPlayer.play();
        }
      }

      DeviceEventEmitter.emit('queue-updated', {});
      DeviceEventEmitter.emit('playback-mode-changed', {isPlaylist: false});
      historyManager.startTracking(song).catch(() => {});
      return;
    }

    // Check network availability for non-local files
    if (!isLocalFile) {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {

        // Return early or try to play a cached version
        return;
      }
    }

    // Create a copy of the song with the selected playback URL and quality info
    const qualityIndex = await getIndexQuality();
    const qualityNames = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];
    const currentQuality = qualityNames[qualityIndex] || 'Unknown';

    // Enhance artwork to highest quality for playing song (w500)
    const enhancedArtwork = enhanceYTMusicArtwork(
      updatedSong.artwork || updatedSong.image,
      'playing',
    );
    const playingArtwork =
      getPrimaryArtworkUrl(enhancedArtwork) ||
      updatedSong.artwork ||
      updatedSong.image ||
      undefined;

    const songForPlayback = {
      ...updatedSong,
      url: playbackUrl,
      title: FormatTitleAndArtist(updatedSong.title, updatedSong.artist),
      artist: FormatTitleAndArtist(updatedSong.artist),
      currentPlayingQuality: currentQuality,
      artwork:
        playingArtwork && playingArtwork.trim() !== ''
          ? playingArtwork
          : undefined, // Ensure never empty string
    };

    if (clearQueue) {
      await TrackPlayer.reset();
      await TrackPlayer.add([songForPlayback]);
      await TrackPlayer.play();
    } else {
      const queue = await TrackPlayer.getQueue();
      const existingIndex = queue.findIndex(track => track.id === songForPlayback.id);

      if (existingIndex >= 0) {
        await TrackPlayer.skip(existingIndex);
        await TrackPlayer.play();
      } else if (queue.length > 0) {
        try {
          const currentIndex = await TrackPlayer.getActiveTrackIndex();
          const insertIndex =
            typeof currentIndex === 'number' && currentIndex >= 0
              ? currentIndex + 1
              : 0;
          await TrackPlayer.add([songForPlayback], insertIndex);
          await TrackPlayer.skip(insertIndex);
          await TrackPlayer.play();
        } catch (insertErr) {
          console.warn('Insert-after-current failed, appending to queue:', insertErr);
          await TrackPlayer.add([songForPlayback]);
          const appendedQueue = await TrackPlayer.getQueue();
          const lastIndex = Math.max(0, appendedQueue.length - 1);
          await TrackPlayer.skip(lastIndex);
          await TrackPlayer.play();
        }
      } else {
        await TrackPlayer.add([songForPlayback]);
        await TrackPlayer.play();
      }

      try {
        const state = await TrackPlayer.getPlaybackState();
        if (
          state.state !== State.Playing &&
          state.state !== State.Buffering &&
          state.state !== State.Loading
        ) {
          await TrackPlayer.play();
        }
      } catch (stateError) {
        console.warn('Could not verify playback state:', stateError);
      }
    }

    // Keep Context queue state in sync immediately after direct play actions.
    DeviceEventEmitter.emit('queue-updated', {});

    // Signal that this is a single song playback (enable auto-recommendations)
    DeviceEventEmitter.emit('playback-mode-changed', {isPlaylist: false});

    // History tracking should never block immediate playback startup.
    historyManager.startTracking(song).catch(() => {});
  } catch (error) {
    console.error('Error playing song:', error);
  }
}

async function PlaySongWithRelated(videoId, artwork, songData = {}) {
  try {
    songData = songData || {};
    const normalizedSource = (songData?.source || '').toString().toLowerCase();
    const normalizedVideoId =
      songData?.videoId ||
      songData?.id ||
      videoId;

    // Create song object
    const song = {
      id: normalizedVideoId,
      artwork: artwork,
      title: songData.title || 'Unknown Title',
      artist: songData.artist || 'Unknown Artist',
      url: songData.url || '',
      downloadUrl: songData.downloadUrl || undefined, // Accept downloadUrl from caller
      duration: songData.duration || 0,
      language: songData.language || 'Unknown',
      // Mark as YouTube song
      // Check explicit source flag first; fall back to ID-length heuristic only
      // when the song has no Saavn-style downloadUrl (Saavn IDs can also be 11 chars)
      isYouTubeSong:
        normalizedSource === 'youtube' ||
        normalizedSource === 'ytmusic' ||
        songData?.isYTMusic === true ||
        (typeof normalizedVideoId === 'string' &&
          normalizedVideoId.length === 11 &&
          !songData?.downloadUrl &&
          !songData?.download_url),
    };

    if (song.isYouTubeSong) {
      try {
        const streamData = await youtubeStreamingService.getStreamUrl(
          normalizedVideoId,
        );
        if (streamData?.url) {
          song.url = streamData.url;
          song.downloadUrl = streamData.url;
          song.headers = streamData.headers;
          song.userAgent = streamData.headers?.['User-Agent'];
          song.artwork = streamData.thumbnail || song.artwork;
          song.duration = song.duration || streamData.duration || 0;
          song._needsStream = false;
        }
      } catch (streamErr) {
        console.warn('PlaySongWithRelated: stream prefetch failed', streamErr?.message || streamErr);
      }
    }

    // If this is not a YouTube song and URL/download metadata is missing,
    // try to fetch Saavn song details from the API so we can obtain downloadUrl(s).
    const isUrlMissing =
      !song.url ||
      (typeof song.url === 'string' && song.url.trim() === '') ||
      (Array.isArray(song.url) && song.url.length === 0);
    const isDownloadUrlMissing =
      !song.downloadUrl ||
      (Array.isArray(song.downloadUrl) && song.downloadUrl.length === 0);

    if (!song.isYouTubeSong && isUrlMissing && isDownloadUrlMissing) {
      try {
        const {getSongData} = require('./Api/Songs');
        const apiResp = await getSongData(song.id);

        // Normalize response into songInfo object
        let songInfo = apiResp;

        // Handle case where data is directly an array (Saavn API format)
        if (
          apiResp &&
          apiResp.data &&
          Array.isArray(apiResp.data) &&
          apiResp.data.length > 0
        ) {
          songInfo = apiResp.data[0];
        }
        // Handle case where data.results is an array
        else if (apiResp && apiResp.data) {
          songInfo = apiResp.data;
        }

        // Handle nested results array
        if (
          songInfo &&
          songInfo.results &&
          Array.isArray(songInfo.results) &&
          songInfo.results.length > 0
        ) {
          songInfo = songInfo.results[0];
        }

        // Try common fields used across different APIs
        const candidateDownload =
          songInfo?.downloadUrl ||
          songInfo?.download_url ||
          songInfo?.downloadUrls ||
          songInfo?.downloadUrls ||
          songInfo?.media?.downloadUrl ||
          songInfo?.media?.download_url;
        const candidateUrl =
          songInfo?.url ||
          songInfo?.stream_url ||
          songInfo?.playUrl ||
          songInfo?.downloadUrl ||
          songInfo?.download_url;

        if (candidateDownload) {
          // If API returned an array or single URL, attach appropriately
          if (Array.isArray(candidateDownload)) {
            song.downloadUrl = candidateDownload;
            // Keep song.url for backward compatibility (leave as array)
            song.url = candidateDownload;
          } else if (
            typeof candidateDownload === 'string' &&
            candidateDownload.length > 0
          ) {
            song.url = candidateDownload;
          }
        } else if (candidateUrl) {
          song.url = candidateUrl;
        }
        // If we found duration/title/artist from API, merge to improve metadata
        if (songInfo) {
          song.title = song.title || songInfo.title || songInfo.name;
          song.artist =
            song.artist ||
            songInfo.primaryArtists ||
            songInfo.primary_artists ||
            songInfo.artist ||
            songInfo.artists ||
            songInfo.subtitle;
          song.duration =
            song.duration ||
            songInfo.duration ||
            songInfo.length ||
            songInfo.track_length;
          song.artwork =
            song.artwork ||
            songInfo.image ||
            songInfo.thumbnails ||
            songInfo.albumCover ||
            songInfo.cover;
        }
        // If after the ID-based fetch we still don't have a usable URL,
        // try a Saavn-style search by title+artist against the provided
        // jiosavan API to locate a playable download URL.
        if (
          (!song.url ||
            (typeof song.url === 'string' && song.url.trim() === '')) &&
          song.title
        ) {
          try {
            const query = encodeURIComponent(
              (song.title || '') + ' ' + (song.artist || ''),
            );
            const searchUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${query}&limit=1`;
            const searchResp = await safeHttpGet(searchUrl);
            const respData =
              (searchResp && (searchResp.data || searchResp)) || {};
            const results =
              (respData && (respData.data?.results || respData.results)) || [];
            if (results && results.length > 0) {
              const first = results[0];
              const cand =
                first?.downloadUrl ||
                first?.download_url ||
                first?.url ||
                first?.stream_url ||
                first?.playUrl;
              if (cand) {
                if (Array.isArray(cand)) {
                  song.downloadUrl = cand;
                  song.url = cand;
                } else if (typeof cand === 'string' && cand.length > 0) {
                  song.url = cand;
                }
              }
              // Merge any improved metadata
              song.title = song.title || first.title || first.name;
              song.artist =
                song.artist ||
                first.artist ||
                first.artists ||
                first.primaryArtists ||
                first.primary_artists ||
                first.subtitle;
              song.artwork =
                song.artwork ||
                first.image ||
                first.thumbnails ||
                first.albumCover ||
                first.cover;
            }
          } catch (e) {
            // Non-fatal; continue without search results
            console.warn(
              'PlaySongWithRelated: Saavn search fallback failed',
              e?.message || e,
            );
          }
        }
      } catch (e) {
        // Non-fatal; proceed — PlayOneSong will handle missing URL gracefully
        console.warn(
          'PlaySongWithRelated: failed to fetch song details for',
          song.id,
          e?.message || e,
        );
      }
    }

    // vivi-music playQueue pattern: Stop all recommendation systems FIRST
    if (autoRecommendations && typeof autoRecommendations.stop === 'function') {
      autoRecommendations.stop();
    }
    if (queueManager && typeof queueManager.stopContinuousQueueMonitor === 'function') {
      queueManager.stopContinuousQueueMonitor();
    }

    // Do not reset before playback start.
    // Immediate app close after tap can kill notification between reset and new track add.
    await PlayOneSong(song, {clearQueue: true});

    // Emit event to open queue when song is played from anywhere
    DeviceEventEmitter.emit('songPlayed', {songId: normalizedVideoId});

    // Build queue based on song type
    if (song.isYouTubeSong) {
      // Start auto-recommendations for YouTube Music songs
      if (
        autoRecommendations &&
        typeof autoRecommendations.start === 'function'
      ) {
        await autoRecommendations.start(normalizedVideoId);
      }
      // Start continuous monitor to refill queue when low
      if (
        queueManager &&
        typeof queueManager.startContinuousQueueMonitor === 'function'
      ) {
        queueManager.startContinuousQueueMonitor(normalizedVideoId);
      }
    } else {
      // Build queue for JioSaavn songs using recommendations API
      await (async () => {
        try {
          const {getRecommendedSongs} = require('./Api/Recommended');
          const preferredLanguage = await GetLanguageValue();
          const recommendations = await getRecommendedSongs(normalizedVideoId, {
            artist: songData?.artist || song.artist || '',
            title: songData?.title || song.title || '',
            language: songData?.language || song.language || preferredLanguage || '',
          });

          // Parse recommendations response
          let recSongs = [];
          if (recommendations?.data) {
            recSongs = Array.isArray(recommendations.data)
              ? recommendations.data
              : [];
          } else if (Array.isArray(recommendations)) {
            recSongs = recommendations;
          }

          // Format and filter songs to ensure they have all required fields
          const formattedSongs = recSongs
            .filter(s => {
              if (!s || !s.id || s.id === normalizedVideoId) { return false; }
              // Filter by user's preferred language if set
              if (preferredLanguage) {
                const songLang = (s.language || '').toLowerCase();
                const userLang = preferredLanguage.toLowerCase();
                if (songLang && songLang !== userLang) { return false; }
              }
              return true;
            })
            .map(s => {
              // Extract artwork URL from image array
              let artworkUrl = '';
              if (Array.isArray(s.image) && s.image.length > 0) {
                // Get highest quality image (usually the last one)
                artworkUrl =
                  s.image[s.image.length - 1]?.url ||
                  s.image[s.image.length - 1]?.link ||
                  s.image[2]?.url ||
                  s.image[2]?.link ||
                  s.image[1]?.url ||
                  s.image[1]?.link ||
                  s.image[0]?.url ||
                  s.image[0]?.link ||
                  '';
              } else if (typeof s.image === 'string') {
                artworkUrl = s.image;
              }

              return {
                id: s.id,
                name: s.name || s.title || 'Unknown',
                title: s.name || s.title || 'Unknown',
                artist:
                  s.artists?.primary?.map(a => a.name).join(', ') ||
                  s.primaryArtists ||
                  s.primary_artists ||
                  s.artist ||
                  'Unknown Artist',
                artists: s.artists || {primary: [{name: 'Unknown Artist'}]},
                image: s.image || [],
                artwork: artworkUrl, // Set artwork as string URL for player
                downloadUrl: s.downloadUrl || s.download_url || [],
                duration: s.duration || 0,
                language: s.language || 'Unknown',
                url: s.url || '',
              };
            })
            .slice(0, 20);

          if (formattedSongs.length > 0) {
            await AddSongsToQueue(formattedSongs);
          } else {
            // Recommendations API returned no songs — try search-based fallback
            // Search for songs by the same artist or with similar title
            try {
              const preferredLang = preferredLanguage || '';
              const searchArtist = songData?.artist && songData.artist !== 'Unknown Artist'
                ? songData.artist
                : '';
              const searchTitle = songData?.title && songData.title !== 'Unknown Title'
                ? songData.title
                : '';
              const searchQuery = encodeURIComponent(
                (searchArtist || searchTitle || '') + ' ' + preferredLang,
              ).trim();

              if (searchQuery) {
                const searchUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${searchQuery}&limit=20`;
                const searchResp = await safeHttpGet(searchUrl);
                const respData = (searchResp && (searchResp.data || searchResp)) || {};
                const results = (respData && (respData.data?.results || respData.results)) || [];

                if (Array.isArray(results) && results.length > 0) {
                  const searchSongs = results
                    .filter(s => s && s.id && s.id !== normalizedVideoId)
                    .filter(s => {
                      if (preferredLanguage) {
                        const sLang = (s.language || '').toLowerCase();
                        const uLang = preferredLanguage.toLowerCase();
                        if (sLang && sLang !== uLang) { return false; }
                      }
                      return true;
                    })
                    .map(s => {
                      let artworkUrl = '';
                      if (Array.isArray(s.image) && s.image.length > 0) {
                        artworkUrl =
                          s.image[s.image.length - 1]?.url ||
                          s.image[s.image.length - 1]?.link ||
                          s.image[0]?.url || s.image[0]?.link || '';
                      } else if (typeof s.image === 'string') {
                        artworkUrl = s.image;
                      }
                      return {
                        id: s.id,
                        name: s.name || s.title || 'Unknown',
                        title: s.name || s.title || 'Unknown',
                        artist: s.artists?.primary?.map(a => a.name).join(', ') ||
                          s.primaryArtists || s.artist || 'Unknown Artist',
                        artists: s.artists || {primary: [{name: 'Unknown Artist'}]},
                        image: s.image || [],
                        artwork: artworkUrl,
                        downloadUrl: s.downloadUrl || [],
                        duration: s.duration || 0,
                        language: s.language || 'Unknown',
                        url: s.url || '',
                      };
                    })
                    .slice(0, 20);

                  if (searchSongs.length > 0) {
                    await AddSongsToQueue(searchSongs);
                  }
                }
              }
            } catch (searchError) {
              // Search fallback failed — continue to trending fallback
            }

            // If search fallback didn't add songs, try trending as final fallback
            const currentQueue = await TrackPlayer.getQueue();
            if (currentQueue.length <= 1) {
              try {
                const {getHomePageData} = require('./Api/HomePage');
                const {getSongData} = require('./Api/Songs');
              const homeData = await getHomePageData(preferredLanguage);
              const trendingSongs = homeData?.data?.trending?.songs || [];

              if (trendingSongs.length > 0) {
                // Fetch full details for first 10 trending songs (to get downloadUrl)
                const songsToFetch = trendingSongs
                  .filter(s => s && s.id && s.id !== normalizedVideoId)
                  .slice(0, 10);

                const fallbackSongs = [];
                for (const trendingSong of songsToFetch) {
                  try {
                    const fullSongData = await getSongData(trendingSong.id);
                    const apiSongData = fullSongData?.data?.[0] || fullSongData?.[0] || fullSongData;

                    // Skip songs that don't match user's preferred language
                    if (preferredLanguage && apiSongData?.language) {
                      const songLang = apiSongData.language.toLowerCase();
                      const userLang = preferredLanguage.toLowerCase();
                      if (songLang !== userLang) { continue; }
                    }

                    if (apiSongData && apiSongData.downloadUrl) {
                      let artworkUrl = '';
                      if (Array.isArray(apiSongData.image) && apiSongData.image.length > 0) {
                        artworkUrl =
                          apiSongData.image[2]?.url || apiSongData.image[2]?.link ||
                          apiSongData.image[1]?.url || apiSongData.image[1]?.link ||
                          apiSongData.image[0]?.url || apiSongData.image[0]?.link || '';
                      }

                      fallbackSongs.push({
                        id: apiSongData.id,
                        name: apiSongData.name || apiSongData.title || 'Unknown',
                        title: apiSongData.name || apiSongData.title || 'Unknown',
                        artist: apiSongData.primaryArtists || apiSongData.artist || 'Unknown Artist',
                        artists: apiSongData.artists || {primary: [{name: apiSongData.primaryArtists || 'Unknown'}]},
                        image: apiSongData.image || [],
                        artwork: artworkUrl,
                        downloadUrl: apiSongData.downloadUrl || [],
                        duration: apiSongData.duration || 0,
                        language: apiSongData.language || 'Unknown',
                        // Don't set url - let AddSongsToQueue extract from downloadUrl
                      });
                    }
                  } catch (err) {
                    // Silently skip failed songs
                  }
                }

                if (fallbackSongs.length > 0) {
                  await AddSongsToQueue(fallbackSongs);
                }
              }
            } catch (fallbackError) {
              // Silently fail
            }
            }
          }
        } catch (error) {
          // Silently fail
        }
      })();
    }
  } catch (error) {
    console.error('Error in PlaySongWithRelated:', error);
  }
}

// Guard against concurrent AddPlaylist calls
// Queue pending calls instead of ignoring them
let _addPlaylistInProgress = false;
let _pendingPlaylistCall = null;

async function AddPlaylist(songs, startSongId = null) {
  // If a playlist add is already in progress, queue this call instead of ignoring it
  if (_addPlaylistInProgress) {
    console.log('AddPlaylist: Queueing call (one already in progress)');
    _pendingPlaylistCall = {songs, startSongId};
    return;
  }

  _addPlaylistInProgress = true;

  try {
    // Validate songs array
    if (!Array.isArray(songs) || songs.length === 0) {
      console.error('Invalid songs array provided to AddPlaylist');
      return;
    }

    // Ensure player is initialized before proceeding
    if (!isPlayerInitialized) {
      await setupPlayer();
    }

    // Keep all songs in the queue but remember which index to start from
    let tracksToAdd = [...songs];
    let startIndex = 0;

    if (startSongId) {
      const foundIndex = songs.findIndex(
        s => s.id === startSongId || s.videoId === startSongId,
      );
      if (foundIndex !== -1) {
        startIndex = foundIndex;
      } else {
        console.warn(
          `⚠️ Start song ID ${startSongId} not found in playlist, starting from beginning`,
        );
      }
    }

    // Ensure all songs have albumId if it exists on the first song
    const albumId = tracksToAdd[0]?.albumId;
    if (albumId) {
      tracksToAdd = tracksToAdd.map(song => ({
        ...song,
        albumId: albumId,
      }));
    }

    // Apply playback quality setting to all songs
    const qualityIndex = await getIndexQuality();
    const qualityNames = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];
    const currentQuality = qualityNames[qualityIndex] || 'Unknown';

    const processedSongs = await Promise.all(
      tracksToAdd.map(async (song, index) => {
        let playbackUrl = song.url;
        let updatedSong = {...song};

        // Check if this is a YouTube song
        const isYouTubeSong =
          song.id &&
          typeof song.id === 'string' &&
          song.id.length === 11 &&
          !song.isLocalMusic;

        if (isYouTubeSong) {
          // Fetch stream for the song user clicked (startIndex) and optionally first song
          // This prevents playback errors when jumping to specific songs in albums
          const shouldFetchImmediately = index === startIndex || (index === 0 && startIndex === 0);

          if (shouldFetchImmediately) {
            try {
              debugLog(
                `Fetching YouTube stream for song at index ${index}:`,
                song.id,
              );
              const streamData = await youtubeStreamingService.getStreamUrl(
                song.id,
              );

              if (streamData && streamData.url) {
                playbackUrl = streamData.url;
                updatedSong = {
                  ...updatedSong,
                  url: streamData.url,
                  headers: streamData.headers,
                  userAgent: streamData.headers?.['User-Agent'],
                  artwork: streamData.thumbnail || updatedSong.artwork,
                  duration: streamData.duration || updatedSong.duration,
                  title: streamData.title || updatedSong.title,
                  currentPlayingQuality: currentQuality,
                  _prefetched: true,
                };
              }
            } catch (error) {
              console.error(
                `Error fetching YouTube stream for song at index ${index}:`,
                error,
              );
            }
          } else {
            // LAZY LOAD: Set placeholder URL and flag
            playbackUrl = `ytmusic://${song.id || song.videoId}`;
            updatedSong._needsStream = true;
            updatedSong.isYTMusic = true;
            updatedSong.url = playbackUrl;
            updatedSong.currentPlayingQuality = currentQuality;
          }
        } else {
          // Standard file/download URL logic
          if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
            const preferred = song.downloadUrl[qualityIndex];
            const fallback = song.downloadUrl.find(d => d?.url || d?.link);
            updatedSong.url =
              preferred?.url || preferred?.link ||
              fallback?.url || fallback?.link ||
              song.url;
          } else if (song.download_url && Array.isArray(song.download_url)) {
            const preferred = song.download_url[qualityIndex];
            const fallback = song.download_url.find(d => d?.url || d?.link);
            updatedSong.url =
              preferred?.url || preferred?.link ||
              fallback?.url || fallback?.link ||
              song.url;
          }
        }

        const artworkUrl = extractArtwork(song) || extractArtwork(updatedSong);
        const enhancedArtwork = enhanceYTMusicArtwork(artworkUrl, 'playing');
        const finalArtwork =
          getPrimaryArtworkUrl(enhancedArtwork) || artworkUrl || undefined;

        return {
          ...updatedSong,
          url: playbackUrl || updatedSong.url,
          title: FormatTitleAndArtist(updatedSong.title, updatedSong.artist),
          artist: FormatTitleAndArtist(updatedSong.artist),
          artwork: finalArtwork,
          image: finalArtwork,
          currentPlayingQuality: currentQuality,
        };
      }),
    );

    // BATCHED PLAYLIST ADDITION
    // 1. Add first batch for instant playback
    const INITIAL_BATCH_SIZE = 20;
    const initialBatch = processedSongs.slice(0, INITIAL_BATCH_SIZE);

    // If player already has the same track playing, avoid unnecessary reset which can cause queue churn
    try {
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      const queue = await TrackPlayer.getQueue();
      const currentTrack = (typeof currentIndex === 'number' && currentIndex >= 0) ? queue[currentIndex] : null;
      if (currentTrack && startSongId && (currentTrack.id === startSongId || currentTrack.id === (songs[startIndex] && songs[startIndex].id))) {
        // Already playing the requested track — ensure playing state and return
        await TrackPlayer.play();
      } else {
        await TrackPlayer.reset();
        await TrackPlayer.add(initialBatch);

        // Skip to the song user clicked on if startIndex is within initial batch
        if (startIndex < INITIAL_BATCH_SIZE) {
          await TrackPlayer.skip(startIndex);
          // Small delay to ensure track is loaded before playing (prevents multiple loads)
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        await TrackPlayer.play();
      }
    } catch (err) {
      // If any error, fallback to reset + add + play
      console.warn('AddPlaylist: error checking existing queue, falling back to reset', err);
      await TrackPlayer.reset();
      await TrackPlayer.add(initialBatch);
      if (startIndex < INITIAL_BATCH_SIZE) {
        await TrackPlayer.skip(startIndex);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await TrackPlayer.play();
    }

    // Signal that this is a playlist/album playback (disable auto-recommendations)
    DeviceEventEmitter.emit('playback-mode-changed', {isPlaylist: true});

    // 2. Add remaining songs in background
    const remainingSongs = processedSongs.slice(INITIAL_BATCH_SIZE);

    if (remainingSongs.length > 0) {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const BATCH_SIZE = 50;
          let hasSkipped = false; // FLAG: Prevent multiple skip operations
          for (let i = 0; i < remainingSongs.length; i += BATCH_SIZE) {
            const batch = remainingSongs.slice(i, i + BATCH_SIZE);

            // Small pause to let UI breathe
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            await TrackPlayer.add(batch);

            // If user clicked on a song in the remaining batch, skip to it once it's added
            // Only skip ONCE when the batch containing startIndex is added
            if (!hasSkipped && startIndex >= INITIAL_BATCH_SIZE + i && startIndex < INITIAL_BATCH_SIZE + i + BATCH_SIZE) {
              try {
                await TrackPlayer.skip(startIndex);
                hasSkipped = true; // Mark as skipped to prevent duplicate skips
              } catch (skipErr) {
                console.warn('Could not skip to song in later batch:', skipErr);
              }
            }
          }

          DeviceEventEmitter.emit('queue-updated', {
            count: processedSongs.length,
          });
        } catch (batchError) {
          console.error(
            '❌ Error adding background playlist batch:',
            batchError,
          );
        }
      });
    } else {
      // No remaining songs
      DeviceEventEmitter.emit('queue-updated', {count: processedSongs.length});
    }

    // Prefetch next song check
    setTimeout(() => {
      queueManager
        .prefetchNextTrack()
        .catch(err => console.error('Error prefetching next track:', err));
    }, 1000);

    // Add recommendations after album/playlist songs to enable continuous playback
    // This runs in the background after the album is loaded
    InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        try {
          // Get the last song from the original songs array to base recommendations on
          const lastSong = processedSongs[processedSongs.length - 1];
          if (!lastSong || !lastSong.id) {
            return;
          }

          // Check if this is a YouTube Music song
          const isYouTubeSong =
            lastSong.id &&
            typeof lastSong.id === 'string' &&
            lastSong.id.length === 11 &&
            !lastSong.isLocalMusic;

          if (isYouTubeSong) {
            // Fetch YouTube Music recommendations
            const recommendations =
              await queueManager.buildQueueFromRecommendations(
                lastSong.id,
                'ytmusic',
                20,
              );
            if (recommendations && recommendations.length > 0) {
              await AddSongsToQueue(recommendations);
            }
          } else {
            // Fetch JioSaavn recommendations
            const {getRecommendedSongs} = require('./Api/Recommended');
            const recommendations = await getRecommendedSongs(lastSong.id, {
              artist: lastSong.artist || '',
              title: lastSong.title || lastSong.name || '',
              language: lastSong.language || '',
            });

            // Parse recommendations response
            let recSongs = [];
            if (recommendations?.data) {
              recSongs = Array.isArray(recommendations.data)
                ? recommendations.data
                : [];
            } else if (Array.isArray(recommendations)) {
              recSongs = recommendations;
            }

            // Format songs
            const formattedSongs = recSongs
              .filter(s => s && s.id)
              .map(s => {
                let artworkUrl = '';
                if (Array.isArray(s.image) && s.image.length > 0) {
                  artworkUrl =
                    s.image[s.image.length - 1]?.url ||
                    s.image[s.image.length - 1]?.link ||
                    s.image[2]?.url ||
                    s.image[2]?.link ||
                    s.image[1]?.url ||
                    s.image[1]?.link ||
                    s.image[0]?.url ||
                    s.image[0]?.link ||
                    '';
                } else if (typeof s.image === 'string') {
                  artworkUrl = s.image;
                }

                return {
                  id: s.id,
                  name: s.name || s.title || 'Unknown',
                  title: s.name || s.title || 'Unknown',
                  artist:
                    s.artists?.primary?.map(a => a.name).join(', ') ||
                    s.primaryArtists ||
                    s.primary_artists ||
                    s.artist ||
                    'Unknown Artist',
                  artists: s.artists || {primary: [{name: 'Unknown Artist'}]},
                  image: s.image || [],
                  artwork: artworkUrl,
                  downloadUrl: s.downloadUrl || s.download_url || [],
                  duration: s.duration || 0,
                  language: s.language || 'Unknown',
                  url: s.url || '',
                };
              })
              .slice(0, 20);

            if (formattedSongs.length > 0) {
              await AddSongsToQueue(formattedSongs);
            }
          }
        } catch (error) {
          // Silently fail if recommendations can't be added
        }
      }, 2000); // Wait 2 seconds after album loads
    });
  } catch (error) {
    console.error('Error in AddPlaylist:', error);
  } finally {
    _addPlaylistInProgress = false;

    // If a call was queued while this one was processing, process it now
    if (_pendingPlaylistCall) {
      const pending = _pendingPlaylistCall;
      _pendingPlaylistCall = null;
      console.log('AddPlaylist: Processing queued call');
      try {
        await AddPlaylist(pending.songs, pending.startSongId);
      } catch (recurseErr) {
        console.error('AddPlaylist: Error processing queued call:', recurseErr);
      }
    }
  }
}


async function AddSongsToQueue(songs) {
  // Ensure player is initialized before proceeding
  if (!isPlayerInitialized) {
    await setupPlayer();
  }

  const qualityIndex = await getIndexQuality();
  const qualityNames = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];
  const currentQuality = qualityNames[qualityIndex] || 'Unknown';

  const processedSongs = [];

  for (const song of songs) {
    const hasValidYouTubeId =
      song.id && typeof song.id === 'string' && song.id.length === 11;
    const normalizedSource = (song?.source || '').toString().toLowerCase();
    const isYTMusicSource =
      normalizedSource === 'ytmusic' || song.isYTMusic === true;

    let processedSong = {...song};

    if ((hasValidYouTubeId && !song.isLocalMusic) || isYTMusicSource) {
      // ...existing code...
      const videoId = song.id || song.videoId;
      processedSong = {
        ...processedSong,
        url: `ytmusic://${videoId}`,
        _needsStream: true,
        isYTMusic: true,
        source: 'ytmusic',
        currentPlayingQuality: currentQuality,
        title: FormatTitleAndArtist(song.title, song.artist),
        artist: FormatTitleAndArtist(song.artist),
        artwork: getPrimaryArtworkUrl(
          enhanceYTMusicArtwork(extractArtwork(song), 'playing'),
        ),
        image: extractArtwork(song),
        duration: song.duration,
      };
    } else {
      // Standard logic for downloads/local and Saavn
      let extractedUrl = song.url;
      if (song.downloadUrl) {
        if (Array.isArray(song.downloadUrl)) {
          const preferred = song.downloadUrl[qualityIndex];
          const fallback = song.downloadUrl.find(d => d?.url || d?.link);
          extractedUrl =
            preferred?.url || preferred?.link ||
            fallback?.url || fallback?.link ||
            song.url;
        } else if (typeof song.downloadUrl === 'string') {
          extractedUrl = song.downloadUrl;
        }
      } else if (song.download_url && Array.isArray(song.download_url)) {
        const preferred = song.download_url[qualityIndex];
        const fallback = song.download_url.find(d => d?.url || d?.link);
        extractedUrl =
          preferred?.url || preferred?.link ||
          fallback?.url || fallback?.link ||
          song.url;
      }
      processedSong.url = extractedUrl;
      processedSong.currentPlayingQuality = currentQuality;
      processedSong.title = FormatTitleAndArtist(song.title, song.artist);
      processedSong.artist = FormatTitleAndArtist(song.artist);
      processedSong.artwork = getPrimaryArtworkUrl(
        enhanceYTMusicArtwork(extractArtwork(song), 'playing'),
      );
      processedSong.image = extractArtwork(song);
    }

    processedSongs.push(processedSong);
  }

  if (processedSongs.length > 0) {
    try {
      const existingQueue = await TrackPlayer.getQueue();
      const existingIds = new Set(existingQueue.map(s => s.id).filter(Boolean));
      const existingUrls = new Set(
        existingQueue
          .map(s => (typeof s.url === 'string' ? s.url.trim() : ''))
          .filter(Boolean),
      );
      const existingTitles = new Set(
        existingQueue
          .map(s =>
            `${(s.title || '').trim()}|${(
              s.artist || ''
            ).trim()}`.toLowerCase(),
          )
          .filter(k => k !== '|'),
      );

      const uniqueProcessed = [];
      const seenIds = new Set();
      const seenUrls = new Set();
      const seenTitles = new Set();
      for (const p of processedSongs) {
        if (!p) {
          continue;
        }
        const id = p.id;
        const url = typeof p.url === 'string' ? p.url.trim() : '';
        const titleKey = `${(p.title || '').trim()}|${(
          p.artist || ''
        ).trim()}`.toLowerCase();

        const isDuplicateExisting =
          (id && existingIds.has(id)) ||
          (url && existingUrls.has(url)) ||
          (titleKey && titleKey !== '|' && existingTitles.has(titleKey));
        if (isDuplicateExisting) {
          continue;
        }

        const isDuplicateIncoming =
          (id && seenIds.has(id)) ||
          (url && seenUrls.has(url)) ||
          (titleKey && titleKey !== '|' && seenTitles.has(titleKey));
        if (isDuplicateIncoming) {
          continue;
        }

        uniqueProcessed.push(p);
        if (id) {
          seenIds.add(id);
        }
        if (url) {
          seenUrls.add(url);
        }
        if (titleKey && titleKey !== '|') {
          seenTitles.add(titleKey);
        }
      }

      if (uniqueProcessed.length === 0) {
        return;
      }

      const songsToAdd = uniqueProcessed;

      // BATCHED ADDITION STRATEGY
      // 1. Add first small batch immediately for instant UI response
      const INITIAL_BATCH_SIZE = 20;
      const initialBatch = songsToAdd.slice(0, INITIAL_BATCH_SIZE);

      await TrackPlayer.add(initialBatch);

      // Emit event to update UI immediately
      DeviceEventEmitter.emit('queue-updated', {count: initialBatch.length});

      // 2. Add remaining songs in background batches
      const remainingSongs = songsToAdd.slice(INITIAL_BATCH_SIZE);

      if (remainingSongs.length > 0) {
        InteractionManager.runAfterInteractions(async () => {
          try {
            const BATCH_SIZE = 50;
            for (let i = 0; i < remainingSongs.length; i += BATCH_SIZE) {
              const batch = remainingSongs.slice(i, i + BATCH_SIZE);

              // Small delay to allow UI frame updates between batches
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }

              await TrackPlayer.add(batch);
            }

            // Final event to ensuring everything is synced
            DeviceEventEmitter.emit('queue-updated', {
              count: processedSongs.length,
            });
          } catch (batchError) {
            console.error('❌ Error adding background batch:', batchError);
          }
        });
      } else {
        // No remaining songs
        DeviceEventEmitter.emit('queue-updated', {
          count: processedSongs.length,
        });
      }
    } catch (error) {
      console.error('❌ Failed to add songs to queue:', error.message);
    }
  }
}
async function PlaySong() {
  if (!isPlayerInitialized) {
    await setupPlayer();
  }
  await TrackPlayer.play();
}
async function PauseSong() {
  if (!isPlayerInitialized) {
    return;
  }
  await TrackPlayer.pause();
}

async function SetProgressSong(value) {
  try {
    if (!isPlayerInitialized) {
      return;
    }
    // Ensure value is a valid number and within bounds
    const seekValue = Math.max(0, parseFloat(value) || 0);
    await TrackPlayer.seekTo(seekValue);
  } catch (error) {
    console.error('Error seeking to position:', error);
  }
}

async function PlayNextSong() {
  // Prevent next/prev from running while manual skip is in progress
  if (isSkipInProgress) {
    console.warn('Skip already in progress, ignoring PlayNextSong');
    return;
  }

  await skipOperationManager.executeSkip(async signal => {
    try {
      if (!isPlayerInitialized) {
        await setupPlayer();
      }

      await historyManager.stopTracking();

      if (signal.aborted) {
        throw new Error('AbortError');
      }

      // Determine current index robustly (some players may return -1)
      const queue = await TrackPlayer.getQueue();
      const activeTrack = await TrackPlayer.getActiveTrack();
      let currentIndex = await TrackPlayer.getActiveTrackIndex();
      if ((typeof currentIndex !== 'number' || currentIndex < 0) && activeTrack) {
        currentIndex = queue.findIndex(t => t && t.id === activeTrack.id);
      }

      let nextIndex = typeof currentIndex === 'number' && currentIndex >= 0 ? currentIndex + 1 : 0;

      // If nextIndex is beyond queue, wait briefly for recommendations to load
      if (nextIndex >= queue.length) {
        let retries = 6;
        while (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const freshQueue = await TrackPlayer.getQueue();
          if (freshQueue.length > nextIndex) {
            // Queue grew — update and continue
            queue.length = 0;
            queue.push(...freshQueue);
            break;
          }
          retries--;
        }
        if (nextIndex >= queue.length) {
          return;
        }
      }

      // Skip forward until we find a different track (guard against duplicates)
      let nextTrack = queue[nextIndex];
      while (nextTrack && activeTrack && nextTrack.id === activeTrack.id) {
        nextIndex += 1;
        if (nextIndex >= queue.length) {
          return;
        }
        nextTrack = queue[nextIndex];
      }

      if (!nextTrack) {
        return;
      }

      // Prefetch stream if needed
      if (smartPrefetchManager.needsStream(nextTrack)) {
        if (signal.aborted) {
          throw new Error('AbortError');
        }
        const cached = smartPrefetchManager.getPrefetchedStream(nextTrack.id);
        let streamData = cached;
        if (!streamData) {
          streamData = await smartPrefetchManager.fetchOnDemand(nextTrack.id);
        }
        if (signal.aborted) {
          throw new Error('AbortError');
        }
        if (streamData && streamData.url) {
          await smartPrefetchManager.replaceTrackAndWait(
            nextIndex,
            nextTrack,
            streamData,
          );
        }
      }

      if (signal.aborted) {
        throw new Error('AbortError');
      }

      // Try skipping by index first, fallback to skipToNext if needed
      // Suppress repeat-one revert so the handler in service.js doesn't undo this skip
      ManualSkipFlag.suppress();
      await TrackPlayer.skip(nextIndex);
      await TrackPlayer.play();

      // Verify that active track changed; if not, attempt skipToNext and play
      const afterTrack = await TrackPlayer.getActiveTrack();
      if (afterTrack && activeTrack && afterTrack.id === activeTrack.id) {
        console.warn('Skip by index did not change track; attempting skipToNext fallback');
        try {
          await TrackPlayer.skipToNext();
          await TrackPlayer.play();
        } catch (e) {
          console.error('skipToNext fallback failed:', e);
        }
      }

      const newTrack = await TrackPlayer.getActiveTrack();
      if (newTrack) {
        await historyManager.startTracking(newTrack);
        skipOperationManager.resetErrorCounter();
        // Ensure queue is filled and UI updates
        try {
          // Dynamically import Context actions
          const {ensureMinimumQueue, updateTrack} = require('./Context/ContextState');
          if (typeof ensureMinimumQueue === 'function') {
            await ensureMinimumQueue();
          }
          if (typeof updateTrack === 'function') {
            await updateTrack();
          }
        } catch (e) {
          console.warn('Queue update after next song failed:', e);
        }
        DeviceEventEmitter.emit('queue-updated', {});
      }
    } catch (error) {
      if (error.message !== 'AbortError') {
        console.error('❌ Error in PlayNextSong:', error);
      }
      throw error;
    }
  });

  // If not executed, silently ignore
}

async function PlayNextInQueue(songs) {
  if (!isPlayerInitialized) {
    await setupPlayer();
  }
  if (!Array.isArray(songs) || songs.length === 0) {
    return;
  }

  const qualityIndex = await getIndexQuality();
  const qualityNames = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];
  const currentQuality = qualityNames[qualityIndex] || 'Unknown';

  const processedSongs = songs.map(song => {
    let processedSong = {...song};
    const hasValidYouTubeId =
      song.id && typeof song.id === 'string' && song.id.length === 11;
    const normalizedSource = (song?.source || '').toString().toLowerCase();
    const isYTMusicSource =
      normalizedSource === 'ytmusic' || song.isYTMusic === true;

    if ((hasValidYouTubeId && !song.isLocalMusic) || isYTMusicSource) {
      const videoId = song.id || song.videoId;
      processedSong = {
        ...processedSong,
        url: `ytmusic://${videoId}`,
        _needsStream: true,
        isYTMusic: true,
        source: 'ytmusic',
        currentPlayingQuality: currentQuality,
        title: FormatTitleAndArtist(song.title, song.artist),
        artist: FormatTitleAndArtist(song.artist),
        artwork: getPrimaryArtworkUrl(
          enhanceYTMusicArtwork(extractArtwork(song), 'playing'),
        ),
        image: extractArtwork(song),
        duration: song.duration,
      };
    } else {
      if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
        const preferred = song.downloadUrl[qualityIndex];
        const fallback = song.downloadUrl.find(d => d?.url || d?.link);
        processedSong.url =
          preferred?.url || preferred?.link ||
          fallback?.url || fallback?.link ||
          song.url;
      }
      processedSong.currentPlayingQuality = currentQuality;
      processedSong.title = FormatTitleAndArtist(song.title, song.artist);
      processedSong.artist = FormatTitleAndArtist(song.artist);
      processedSong.artwork = getPrimaryArtworkUrl(
        enhanceYTMusicArtwork(extractArtwork(song), 'playing'),
      );
      processedSong.image = extractArtwork(song);
    }
    return processedSong;
  });

  try {
    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const insertIndex = (typeof currentIndex === 'number' && currentIndex >= 0)
      ? currentIndex + 1
      : 0;

    // Deduplicate against existing queue
    const existingQueue = await TrackPlayer.getQueue();
    const existingIds = new Set(existingQueue.map(s => s.id).filter(Boolean));
    const uniqueSongs = processedSongs.filter(s => s.id && !existingIds.has(s.id));

    if (uniqueSongs.length > 0) {
      await TrackPlayer.add(uniqueSongs, insertIndex);
      DeviceEventEmitter.emit('queue-updated', {count: uniqueSongs.length});
    }
  } catch (error) {
    console.error('Error in PlayNextInQueue:', error);
  }
}

async function PlayPreviousSong() {
  // Prevent next/prev from running while manual skip is in progress
  if (isSkipInProgress) {
    console.warn('Skip already in progress, ignoring PlayPreviousSong');
    return;
  }

  // Use SkipOperationManager to debounce and lock skip operations
  await skipOperationManager.executeSkip(async signal => {
    try {
      // Ensure player is initialized
      if (!isPlayerInitialized) {
        await setupPlayer();
      }

      // Stop tracking current song before switching
      await historyManager.stopTracking();

      // Check if operation was cancelled
      if (signal.aborted) {
        throw new Error('AbortError');
      }

      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (typeof currentIndex !== 'number' || currentIndex <= 0) {
        // At beginning of queue or invalid index — restart current song
        await TrackPlayer.seekTo(0);
        await TrackPlayer.play();
        const currentTrack = await TrackPlayer.getActiveTrack();
        if (currentTrack) {
          await historyManager.startTracking(currentTrack);
        }
        return;
      }

      if (signal.aborted) {
        throw new Error('AbortError');
      }

      const queue = await TrackPlayer.getQueue();
      const prevIndex = currentIndex - 1;
      const prevTrack = queue[prevIndex];

      if (!prevTrack) {
        return;
      }

      const prevTrackId = prevTrack.id;

      // Ensure previous track is playable if it needs a stream
      if (smartPrefetchManager.needsStream(prevTrack)) {
        const cached = smartPrefetchManager.getPrefetchedStream(prevTrackId);
        let streamData = cached;
        if (!streamData) {
          streamData = await smartPrefetchManager.fetchOnDemand(prevTrackId);
        }
        if (signal.aborted) {
          throw new Error('AbortError');
        }
        if (streamData && streamData.url) {
          // Use replaceTrackImmediately (no InteractionManager deferral)
          // to avoid race conditions with event handlers between remove+add and skip
          await smartPrefetchManager.replaceTrackImmediately(
            prevIndex,
            prevTrack,
            streamData,
          );
        }
      }

      if (signal.aborted) {
        throw new Error('AbortError');
      }

      // Re-find the track by ID after potential replace (indices may have shifted)
      const freshQueue = await TrackPlayer.getQueue();
      let targetIndex = -1;

      // First: try to find the track by ID (most reliable after remove+add)
      const foundIndex = freshQueue.findIndex(t => t && t.id === prevTrackId);
      if (foundIndex >= 0) {
        targetIndex = foundIndex;
      } else {
        // Track not found in queue (replace may have failed) — use raw prevIndex
        // clamped to valid range
        targetIndex = Math.min(prevIndex, freshQueue.length - 1);
        if (targetIndex < 0) {
          return;
        }
      }

      // Skip to the verified previous index
      // Suppress repeat-one revert so the handler in service.js doesn't undo this skip
      ManualSkipFlag.suppress();
      await TrackPlayer.skip(targetIndex);

      // Verify the skip actually changed the track
      const newTrack = await TrackPlayer.getActiveTrack();
      const newIndex = await TrackPlayer.getActiveTrackIndex();

      if (newTrack && newIndex === targetIndex) {
        await historyManager.startTracking(newTrack);
        skipOperationManager.resetErrorCounter();
      } else if (newIndex !== targetIndex) {
        // Skip didn't land where expected — retry once with skipToPrevious
        try {
          await TrackPlayer.skipToPrevious();
        } catch (e) {
          // Ignore if no previous track
        }
        const retryTrack = await TrackPlayer.getActiveTrack();
        if (retryTrack) {
          await historyManager.startTracking(retryTrack);
        }
      }

      await PlaySong();
    } catch (error) {
      if (error.message !== 'AbortError') {
        console.error('❌ Error in PlayPreviousSong:', error);
      }
      throw error;
    }
  });

  // If not executed, silently ignore to prevent log spam
}
async function SkipToTrack(trackIndex) {
  // Prevent multiple simultaneous skip operations (prevents next/prev conflicts)
  if (isSkipInProgress) {
    console.warn('Skip already in progress, ignoring duplicate request');
    return;
  }

  isSkipInProgress = true;
  try {
    // Ensure player is initialized
    if (!isPlayerInitialized) {
      await setupPlayer();
    }

    // Prevent queue cleanup on manual jump to preserve subsequent songs
    try {
      smartPrefetchManager.suppressCleanupNextChange();
    } catch (_) {}
    // Stop tracking current song before switching
    await historyManager.stopTracking();

    // Ensure trackIndex is a valid number
    const validIndex = Number(trackIndex);
    if (isNaN(validIndex)) {
      console.error('Invalid trackIndex provided to SkipToTrack:', trackIndex);
      return;
    }

    // Get the queue to verify index is within bounds
    const queue = await TrackPlayer.getQueue();
    if (validIndex < 0 || validIndex >= queue.length) {
      console.error(
        'Track index out of bounds:',
        validIndex,
        'Queue length:',
        queue.length,
      );
      return;
    }

    const targetTrack = queue[validIndex];

    // Check if track needs stream (random song selection)
    const needsStream =
      targetTrack._needsStream ||
      targetTrack.url?.startsWith('ytmusic://') ||
      targetTrack.url?.includes('music.youtube.com');

    if (needsStream && !targetTrack._prefetched) {

      // FIRST: Check if SmartPrefetchManager has cached stream
      const cachedStream = smartPrefetchManager.getPrefetchedStream(
        targetTrack.id,
      );

      let streamData = cachedStream;

      if (cachedStream) {

      } else {

        // Use SmartPrefetchManager for on-demand fetch (with retry)
        streamData = await smartPrefetchManager.fetchOnDemand(targetTrack.id);
      }

      if (streamData && streamData.url) {
        // Replace track in queue with valid URL using SAFE non-blocking method
        await smartPrefetchManager.replaceTrackAndWait(
          validIndex,
          targetTrack,
          streamData,
        );
      } else {
        console.error('❌ Failed to get stream for track');
        ToastAndroid.show('Failed to load stream', ToastAndroid.SHORT);
        return;
      }
    }

    await TrackPlayer.skip(validIndex);

    // Small delay to ensure track is loaded before playing (prevents jump-back issues)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the new track and start tracking it
    const newTrack = await TrackPlayer.getActiveTrack();
    if (newTrack) {
      await historyManager.startTracking(newTrack);
    }

    await PlaySong();
  } catch (error) {
    console.error('Error in SkipToTrack:', error);
  } finally {
    isSkipInProgress = false;
  }
}

async function SetRepeatMode(mode) {
  await TrackPlayer.setRepeatMode(mode);
}

async function getIndexQuality() {
  const PlaybackQuality = [
    {value: '12kbps'},
    {value: '48kbps'},
    {value: '96kbps'},
    {value: '160kbps'},
    {value: '320kbps'},
  ];
  const data = await GetPlaybackQuality();
  let index = 4;
  PlaybackQuality.map((e, i) => {
    if (e.value === data) {
      index = i;
    }
  });
  return index;
}

async function AddOneSongToPlaylist(song) {
  try {


    // Import the bottom sheet playlist selector manager
    const {
      PlaylistSelectorBottomSheetManager,
    } = require('./Utils/PlaylistSelectorBottomSheetManager');

    // Validate song object
    if (!song || !song.id) {
      console.error(
        '❌ Invalid song object provided to AddOneSongToPlaylist:',
        song,
      );
      ToastAndroid.show('Invalid song data', ToastAndroid.SHORT);
      return false;
    }



    // Safe image URL extraction
    const getImageUrl = imageData => {
      if (!imageData) {
        return null;
      }
      if (typeof imageData === 'string') {
        return imageData;
      }
      if (Array.isArray(imageData)) {
        for (const img of imageData) {
          if (typeof img === 'string' && img.trim() !== '') {
            return img;
          }
          if (img && typeof img === 'object' && img.url) {
            return img.url;
          }
        }
      }
      if (imageData && typeof imageData === 'object' && imageData.url) {
        return imageData.url;
      }
      return null;
    };

    // Format song object for playlist compatibility if needed
    const formattedSong = {
      id: song.id,
      title: song.title || 'Unknown Title',
      artist: song.artist || 'Unknown Artist',
      artwork: getImageUrl(song.artwork) || getImageUrl(song.image) || null,
      url: song.url || '',
      duration: song.duration || 0,
      language: song.language || '',
      artistID: song.artistID || song.primaryArtistsId || song.primary_artists_id || '',
    };

    // Use the PlaylistSelectorBottomSheetManager to show the selection interface

    const result = PlaylistSelectorBottomSheetManager.show(formattedSong);
    return result;
  } catch (error) {
    console.error('❌ Error showing playlist selector bottom sheet:', error);
    ToastAndroid.show('Error opening playlist selector', ToastAndroid.SHORT);
    return false;
  }
}

export {
  PlayOneSong,
  PlaySong,
  PauseSong,
  SetProgressSong,
  PlayNextSong,
  AddPlaylist,
  PlayPreviousSong,
  AddSongsToQueue,
  PlayNextInQueue,
  SkipToTrack,
  SetRepeatMode,
  getIndexQuality,
  AddOneSongToPlaylist,
  PlaySongWithRelated,
  removeFromQueue,
};
