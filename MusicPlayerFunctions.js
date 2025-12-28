import TrackPlayer from "react-native-track-player";
import { GetPlaybackQuality } from "./LocalStorage/AppSettings";
import NetInfo from "@react-native-community/netinfo";
import { ToastAndroid, DeviceEventEmitter, InteractionManager } from "react-native";
import historyManager from "./Utils/HistoryManager";


import youtubeStreamingService from "./Utils/YouTubeStreamingService";
import queueManager from "./Utils/QueueManager";
import { enhanceYTMusicArtwork, getPrimaryArtworkUrl } from "./Utils/ArtworkEnhancer";
import autoRecommendations from "./Utils/AutoRecommendations";
import skipOperationManager from "./Utils/SkipOperationManager";
import streamFetchManager from "./Utils/StreamFetchManager";
import smartPrefetchManager from "./Utils/SmartPrefetchManager";

let isPlayerInitialized = false;

// Remove duplicate tracks in TrackPlayer queue (keep first occurrence)
async function removeDuplicateTracks() {
  try {
    const queue = await TrackPlayer.getQueue();
    if (!Array.isArray(queue) || queue.length === 0) { return; }

    // Collect indices of duplicate tracks (keep first occurrence)
    const seen = new Set();
    const indicesToRemove = [];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]?.id;
      if (!id) { continue; }
      if (seen.has(id)) {
        indicesToRemove.push(i);
      } else {
        seen.add(id);
      }
    }

    if (indicesToRemove.length === 0) { return; }

    // Sort descending to avoid shifting issues and use safe remove helper
    indicesToRemove.sort((a, b) => b - a);
    // Use SmartPrefetchManager safe remove if available, otherwise fallback to TrackPlayer.remove
    try {
      if (smartPrefetchManager && typeof smartPrefetchManager._safeRemove === 'function') {
        await smartPrefetchManager._safeRemove(indicesToRemove);
      } else {
        await TrackPlayer.remove(indicesToRemove);
      }
      console.log(`🧹 Removed ${indicesToRemove.length} duplicate tracks from queue`);
    } catch (e) {
      console.warn('Dedupe remove failed, will ignore to avoid interrupting playback', e?.message || e);
    }
  } catch (error) {
    console.error('Error removing duplicate tracks:', error?.message || error);
  }
}

// Helper to extract artwork URL from various formats
const extractArtwork = (song) => {
  // Direct artwork/image string
  if (song.artwork && typeof song.artwork === 'string' && song.artwork.length > 0) {
    return song.artwork;
  }
  if (song.image && typeof song.image === 'string' && song.image.length > 0) {
    return song.image;
  }

  // Object format with url/uri
  if (song.artwork && typeof song.artwork === 'object') {
    if (song.artwork.url) { return song.artwork.url; }
    if (song.artwork.uri) { return song.artwork.uri; }
  }

  // Array format (Saavn/OuterTune)
  if (song.image && Array.isArray(song.image)) {
    const bestImage = song.image[2] || song.image[song.image.length - 1] || song.image[0];
    if (bestImage?.url) { return bestImage.url; }
    if (bestImage?.link) { return bestImage.link; }
    if (typeof bestImage === 'string') { return bestImage; }
  }

  // Single Image Object format
  if (song.image && typeof song.image === 'object') {
    if (song.image.url) { return song.image.url; }
    if (song.image.uri) { return song.image.uri; }
  }

  // Thumbnail format (YTMusic)
  if (song.thumbnail) {
    if (typeof song.thumbnail === 'string') { return song.thumbnail; }
    if (typeof song.thumbnail === 'object' && song.thumbnail.url) { return song.thumbnail.url; }
  }

  if (song.thumbnails && Array.isArray(song.thumbnails)) {
    const bestThumb = song.thumbnails[song.thumbnails.length - 1] || song.thumbnails[0];
    if (bestThumb?.url) { return bestThumb.url; }
  }

  // Try to find any property that looks like a URL
  if (song.artwork?.uri) { return song.artwork.uri; }
  if (song.image?.uri) { return song.image.uri; }

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

    const response = await fetch(url, controller ? { signal: controller.signal } : {});
    if (timeoutId) { clearTimeout(timeoutId); }

    const contentType = response.headers?.get?.('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try { data = JSON.parse(text); } catch (e) { data = text; }
    }

    return { data, status: response.status };
  } catch (fetchErr) {
    throw fetchErr;
  }
};

export const setupPlayer = async () => {
  try {
    if (!isPlayerInitialized) {
      try {
        await TrackPlayer.setupPlayer({
          android: {
            appKilledPlaybackBehavior: 'ContinuePlayback',
            alwaysPauseOnInterruption: false,
          },
          autoHandleInterruptions: true,
          autoUpdateMetadata: true,
        });
        console.log('Player initialized successfully in MusicPlayerFunctions');

        // NOTE: Remote control listeners (play, pause, next, previous) are registered in service.js
        // to avoid duplicate event listeners. DO NOT add them here.

        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: 'ContinuePlayback',
            alwaysPauseOnInterruption: false,
          },
          capabilities: [
            'play',
            'pause',
            'stop',
            'seekTo',
            'skip',
            'skipToNext',
            'skipToPrevious',
          ],
          compactCapabilities: [
            'play',
            'pause',
            'stop',
            'seekTo',
            'skip',
            'skipToNext',
            'skipToPrevious',
          ],
          notificationCapabilities: [
            'play',
            'pause',
            'stop',
            'seekTo',
            'skip',
            'skipToNext',
            'skipToPrevious',
          ],
        });

        isPlayerInitialized = true;

        // Initialize SmartPrefetchManager for background prefetching
        smartPrefetchManager.initialize();

      } catch (setupError) {
        // Check if the error is about player already being initialized
        if (setupError.message && setupError.message.includes('player has already been initialized')) {
          console.log('Player already initialized in MusicPlayerFunctions');
          isPlayerInitialized = true;
          smartPrefetchManager.initialize();
        } else {
          console.error('Error setting up player in MusicPlayerFunctions:', setupError);
          throw setupError;
        }
      }
    } else {
      console.log('Player already initialized, skipping setup in MusicPlayerFunctions');
    }
  } catch (error) {
    console.error('Error in setupPlayer function:', error);
  }
};

async function PlayOneSong(song) {
  try {
    // Validate song object
    if (!song) {
      console.error('PlayOneSong: No song provided');
      return;
    }

    // Ensure player is initialized
    if (!isPlayerInitialized) {
      console.log('Player not initialized, setting up...');
      await setupPlayer();
    }

    // Get the appropriate URL based on playback quality setting
    // Prioritize downloadUrl for Saavn songs, fallback to url
    let playbackUrl = song.url;
    let updatedSong = { ...song };

    // If downloadUrl exists (Saavn songs), use it instead of url
    if (song.downloadUrl && Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
      playbackUrl = song.downloadUrl;
      updatedSong.url = song.downloadUrl; // Ensure url is set for downstream processing
    }

    // Handle case where `song.url` or `downloadUrl` is an array of quality objects
    // e.g. [{ quality: '12kbps', url: '...' }, { quality: '160kbps', url: '...' }]
    if (Array.isArray(playbackUrl)) {
      try {
        const qualityIndex = await getIndexQuality();
        // Prefer configured quality, fall back to highest available
        const preferred = playbackUrl[qualityIndex] && (playbackUrl[qualityIndex].url || playbackUrl[qualityIndex].link || playbackUrl[qualityIndex].download);
        if (preferred) {
          playbackUrl = preferred;
        } else {
          // Find highest-quality available by iterating from end
          for (let i = playbackUrl.length - 1; i >= 0; i--) {
            const candidate = playbackUrl[i];
            const candidateUrl = candidate && (candidate.url || candidate.link || candidate.download);
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
        console.warn('PlayOneSong: Failed to select quality from url array', err);
      }
    }

    // Check if this is a YouTube song (has videoId/id that looks like YouTube video ID)
    // Honor explicit flag `song.isYouTubeSong` when provided (e.g., callers that know the source)
    const isYouTubeSong = (song.isYouTubeSong === true) || (song.id && typeof song.id === 'string' && song.id.length === 11 && !song.isLocalMusic);

    if (isYouTubeSong) {
      try {
        console.log('Fetching YouTube stream for video ID:', song.id);

        // Use StreamFetchManager for deduplication and abort support
        const streamData = await streamFetchManager.fetchStream(
          song.id,
          async (videoId, signal) => {
            return await youtubeStreamingService.getStreamUrl(videoId, signal);
          }
        );

        if (streamData && streamData.url) {
          playbackUrl = streamData.url;
          // Update song with stream data and headers
          // IMPORTANT: Preserve artist from original song data
          updatedSong = {
            ...updatedSong,
            url: streamData.url,
            headers: streamData.headers,  // CRITICAL: Pass headers to TrackPlayer
            userAgent: streamData.headers?.['User-Agent'],  // Explicit for ExoPlayer
            artwork: streamData.thumbnail || updatedSong.artwork,
            duration: streamData.duration || updatedSong.duration,
            // Only use stream title if we don't have a good title already
            title: updatedSong.title || streamData.title,
            // Preserve artist from original song data (don't use stream artist)
            artist: updatedSong.artist || 'Unknown Artist',
          };
          console.log('YouTube stream URL fetched successfully');

          // Reset error counter on successful fetch
          skipOperationManager.resetErrorCounter();
        } else {
          console.error('Failed to get YouTube stream URL');
          ToastAndroid.show('Failed to load YouTube stream', ToastAndroid.SHORT);
          return;
        }
      } catch (error) {
        console.error('Error fetching YouTube stream:', error);

        // Don't show toast if operation was cancelled
        if (error.name !== 'AbortError') {
          ToastAndroid.show('Error loading YouTube stream', ToastAndroid.SHORT);
        }
        return;
      }
    }
    else {
      // If song has multiple quality URLs, select based on setting
      if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
        const qualityIndex = await getIndexQuality();
        if (song.downloadUrl[qualityIndex]?.url) {
          playbackUrl = song.downloadUrl[qualityIndex].url;
        } else {
          // Fallback to any available URL
          for (let i = song.downloadUrl.length - 1; i >= 0; i--) {
            if (song.downloadUrl[i]?.url) {
              playbackUrl = song.downloadUrl[i].url;
              break;
            }
          }
        }
      } else if (song.download_url && Array.isArray(song.download_url)) {
        // Alternative format
        const qualityIndex = await getIndexQuality();
        if (song.download_url[qualityIndex]?.url) {
          playbackUrl = song.download_url[qualityIndex].url;
        } else {
          // Fallback to any available URL
          for (let i = song.download_url.length - 1; i >= 0; i--) {
            if (song.download_url[i]?.url) {
              playbackUrl = song.download_url[i].url;
              break;
            }
          }
        }
      }
    }

    // Validate song URL - if missing, attempt a best-effort fetch for non-YouTube songs
    if (!playbackUrl || typeof playbackUrl !== 'string' || playbackUrl.trim() === '') {
      // Try to resolve missing URLs for non-YouTube tracks using API lookup + search fallback
      if (!isYouTubeSong && song.id) {
        try {
          const { getSongData } = require('./Api/Songs');
          const apiResp = await getSongData(song.id);

          let songInfo = apiResp;
          if (apiResp && apiResp.data) { songInfo = apiResp.data; }
          if (songInfo && songInfo.results && Array.isArray(songInfo.results) && songInfo.results.length > 0) {
            songInfo = songInfo.results[0];
          }

          const candidateDownload = songInfo?.downloadUrl || songInfo?.download_url || songInfo?.downloadUrls || songInfo?.media?.downloadUrl;
          const candidateUrl = songInfo?.url || songInfo?.stream_url || songInfo?.playUrl || songInfo?.downloadUrl || songInfo?.download_url;

          if (candidateDownload) {
            if (Array.isArray(candidateDownload)) {
              playbackUrl = candidateDownload[0] || (candidateDownload.find(d => d?.url)?.url) || playbackUrl;
            } else if (typeof candidateDownload === 'string') {
              playbackUrl = candidateDownload;
            }
          } else if (candidateUrl) {
            playbackUrl = candidateUrl;
          }

          // If still missing, try a Saavn-style search by title+artist
          if ((!playbackUrl || typeof playbackUrl !== 'string' || playbackUrl.trim() === '') && song.title) {
            try {
              const query = encodeURIComponent((song.title || '') + ' ' + (song.artist || ''));
              const searchUrl = `https://jiosavan-api-with-playlist.vercel.app/api/search/songs?query=${query}&limit=1`;
              const searchResp = await safeHttpGet(searchUrl, { timeout: 10000 });
              const respData = (searchResp && (searchResp.data || searchResp)) || {};
              const results = (respData && (respData.data?.results || respData.results)) || [];
              if (results && results.length > 0) {
                const first = results[0];
                const cand = first?.downloadUrl || first?.download_url || first?.url || first?.stream_url || first?.playUrl;
                if (cand) {
                  if (Array.isArray(cand)) { playbackUrl = cand[0] || (cand.find(d => d?.url)?.url) || playbackUrl; }
                  else if (typeof cand === 'string') { playbackUrl = cand; }
                }
                // Merge any improved metadata
                song.title = song.title || first.title || first.name || song.title;
                song.artist = song.artist || first.artist || first.artists || first.primary_artists || first.subtitle || song.artist;
                song.artwork = song.artwork || first.image || first.thumbnails || first.albumCover || first.cover || song.artwork;
              }
            } catch (e) {
              console.warn('PlayOneSong: search fallback failed', e?.message || e);
            }
          }

          if (playbackUrl && typeof playbackUrl === 'string' && playbackUrl.trim() !== '') {
            updatedSong.url = playbackUrl;
          }
        } catch (e) {
          console.warn('PlayOneSong: fallback fetch failed', e?.message || e);
        }
      }

      if (!playbackUrl || typeof playbackUrl !== 'string' || playbackUrl.trim() === '') {
        console.error('PlayOneSong: Invalid or missing song URL', song);
        ToastAndroid.show('Cannot play song - invalid URL', ToastAndroid.SHORT);
        return;
      }
    }

    // Check if the song is a local file (has a path or isLocalMusic property)
    const isLocalFile = song.isLocalMusic || song.path || playbackUrl.startsWith('file://');

    // If it's a local file, make sure the URL starts with file://
    if (isLocalFile && !playbackUrl.startsWith('file://') && song.path) {
      playbackUrl = `file://${song.path}`;
    }

    // Check network availability for non-local files
    if (!isLocalFile) {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('Cannot play online song while offline');
        // Return early or try to play a cached version
        return;
      }
    }

    // Start tracking this song in history
    await historyManager.startTracking(song);

    // Create a copy of the song with the selected playback URL and quality info
    const qualityIndex = await getIndexQuality();
    const qualityNames = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];
    const currentQuality = qualityNames[qualityIndex] || 'Unknown';

    // Enhance artwork to highest quality for playing song (w500)
    const enhancedArtwork = enhanceYTMusicArtwork(updatedSong.artwork || updatedSong.image, 'playing');
    const playingArtwork = getPrimaryArtworkUrl(enhancedArtwork) || updatedSong.artwork || updatedSong.image || undefined;

    const songForPlayback = {
      ...updatedSong,
      url: playbackUrl,
      currentPlayingQuality: currentQuality,
      artwork: playingArtwork && playingArtwork.trim() !== '' ? playingArtwork : undefined, // Ensure never empty string
    };

    await TrackPlayer.reset();
    await TrackPlayer.add([songForPlayback]);
    await TrackPlayer.play();

    // Signal that this is a single song playback (enable auto-recommendations)
    DeviceEventEmitter.emit('playback-mode-changed', { isPlaylist: false });

    // Auto-recommendations for individual YouTube Music song plays (search results, single songs)
    // This builds the initial queue - continuous monitor will refill when low
    // Reuse isYouTubeSong variable from line 161 (already declared)

    if (isYouTubeSong) {
      // Attempt a quick, non-blocking recommendation fetch so notification Next works
      (async () => {
        try {
          // Race the recommendation build against a short timeout so we don't block
          const quickFetch = queueManager.buildQueueFromRecommendations(song.id, 'ytmusic', 8);
          const recs = await Promise.race([
            quickFetch,
            new Promise(resolve => setTimeout(() => resolve(null), 600)),
          ]);

          if (recs && Array.isArray(recs) && recs.length > 0) {
            const filteredRecs = recs.filter(rec => rec.id !== song.id);
            if (filteredRecs.length > 0) {
              await AddSongsToQueue(filteredRecs);
              console.log(`✅ Quick-added ${filteredRecs.length} recommended songs to queue`);
            }
          }
        } catch (e) {
          console.warn('Quick recommendation fetch failed (non-fatal):', e?.message || e);
        }
      })();

      // Also schedule the heavier fetch after interactions as a fallback
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          try {
            console.log('🎵 Building queue from YTMusic recommendations for (deferred):', song.id);
            const recommendations = await queueManager.buildQueueFromRecommendations(song.id, 'ytmusic', 20);

            if (recommendations && recommendations.length > 0) {
              const filteredRecs = recommendations.filter(rec => rec.id !== song.id);
              if (filteredRecs.length > 0) {
                await AddSongsToQueue(filteredRecs);
                console.log(`✅ Added ${filteredRecs.length} recommended songs to queue (deferred)`);
              }
            }
          } catch (error) {
            console.error('Error building queue from recommendations (deferred):', error);
          }
        }, 1500);
      });
    }

    // Trigger prefetch for next song in queue (if any)
    setTimeout(() => {
      queueManager.prefetchNextTrack().catch(err =>
        console.error('Error prefetching next track:', err)
      );
    }, 3000); // Wait 3 seconds (after recommendations load)

    // Set up continuous queue monitoring - fetch more when near end
    queueManager.startContinuousQueueMonitor(song.id);
  } catch (error) {
    console.error('Error playing song:', error);
  }
}

async function PlaySongWithRelated(videoId, artwork, songData = {}) {
  try {

    // Create song object
    const song = {
      id: videoId,
      artwork: artwork,
      title: songData.title || 'Unknown Title',
      artist: songData.artist || 'Unknown Artist',
      url: songData.url || '',
      downloadUrl: songData.downloadUrl || undefined, // Accept downloadUrl from caller
      duration: songData.duration || 0,
      language: songData.language || 'Unknown',
      // Mark as YouTube song
      // Only mark as YouTube if it looks like a YouTube video id (11 chars)
      // or if the caller explicitly sets source='ytmusic'
      isYouTubeSong: (typeof videoId === 'string' && videoId.length === 11) || songData.source === 'ytmusic',
    };

    // If this is not a YouTube song and URL/download metadata is missing,
    // try to fetch Saavn song details from the API so we can obtain downloadUrl(s).
    const isUrlMissing = (!song.url || (typeof song.url === 'string' && song.url.trim() === '') || (Array.isArray(song.url) && song.url.length === 0));
    const isDownloadUrlMissing = !song.downloadUrl || (Array.isArray(song.downloadUrl) && song.downloadUrl.length === 0);

    if (!song.isYouTubeSong && isUrlMissing && isDownloadUrlMissing) {
      try {
        const { getSongData } = require('./Api/Songs');
        const apiResp = await getSongData(song.id);

        // Normalize response into songInfo object
        let songInfo = apiResp;

        // Handle case where data is directly an array (Saavn API format)
        if (apiResp && apiResp.data && Array.isArray(apiResp.data) && apiResp.data.length > 0) {
          songInfo = apiResp.data[0];
        }
        // Handle case where data.results is an array
        else if (apiResp && apiResp.data) {
          songInfo = apiResp.data;
        }

        // Handle nested results array
        if (songInfo && songInfo.results && Array.isArray(songInfo.results) && songInfo.results.length > 0) {
          songInfo = songInfo.results[0];
        }

        // Try common fields used across different APIs
        const candidateDownload = songInfo?.downloadUrl || songInfo?.download_url || songInfo?.downloadUrls || songInfo?.downloadUrls || songInfo?.media?.downloadUrl || songInfo?.media?.download_url;
        const candidateUrl = songInfo?.url || songInfo?.stream_url || songInfo?.playUrl || songInfo?.downloadUrl || songInfo?.download_url;

        if (candidateDownload) {
          // If API returned an array or single URL, attach appropriately
          if (Array.isArray(candidateDownload)) {
            song.downloadUrl = candidateDownload;
            // Keep song.url for backward compatibility (leave as array)
            song.url = candidateDownload;
          } else if (typeof candidateDownload === 'string' && candidateDownload.length > 0) {
            song.url = candidateDownload;
          }
        } else if (candidateUrl) {
          song.url = candidateUrl;
        }
        // If we found duration/title/artist from API, merge to improve metadata
        if (songInfo) {
          song.title = song.title || songInfo.title || songInfo.name;
          song.artist = song.artist || songInfo.primary_artists || songInfo.artist || songInfo.artists || songInfo.subtitle;
          song.duration = song.duration || songInfo.duration || songInfo.length || songInfo.track_length;
          song.artwork = song.artwork || songInfo.image || songInfo.thumbnails || songInfo.albumCover || songInfo.cover;
        }
        // If after the ID-based fetch we still don't have a usable URL,
        // try a Saavn-style search by title+artist against the provided
        // jiosavan API to locate a playable download URL.
        if ((!song.url || (typeof song.url === 'string' && song.url.trim() === '')) && song.title) {
          try {
            const query = encodeURIComponent((song.title || '') + ' ' + (song.artist || ''));
            const searchUrl = `https://jiosavan-api-with-playlist.vercel.app/api/search/songs?query=${query}&limit=1`;
            const searchResp = await safeHttpGet(searchUrl, { timeout: 10000 });
            const respData = (searchResp && (searchResp.data || searchResp)) || {};
            const results = (respData && (respData.data?.results || respData.results)) || [];
            if (results && results.length > 0) {
              const first = results[0];
              const cand = first?.downloadUrl || first?.download_url || first?.url || first?.stream_url || first?.playUrl;
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
              song.artist = song.artist || first.artist || first.artists || first.primary_artists || first.subtitle;
              song.artwork = song.artwork || first.image || first.thumbnails || first.albumCover || first.cover;
            }
          } catch (e) {
            // Non-fatal; continue without search results
            console.warn('PlaySongWithRelated: Saavn search fallback failed', e?.message || e);
          }
        }
      } catch (e) {
        // Non-fatal; proceed — PlayOneSong will handle missing URL gracefully
        console.warn('PlaySongWithRelated: failed to fetch song details for', song.id, e?.message || e);
      }
    }

    // Play the song
    await PlayOneSong(song);

    // Emit event to open queue when song is played from anywhere
    DeviceEventEmitter.emit('songPlayed', { songId: videoId });

    // Build queue based on song type
    if (song.isYouTubeSong) {
      // Start auto-recommendations for YouTube Music songs
      autoRecommendations.start(videoId);
    } else {
      // Build queue for JioSaavn songs using recommendations API
      (async () => {
        try {
          console.log('🎵 Building queue for Saavn song:', videoId);
          const { getRecommendedSongs } = require('./Api/Recommended');
          const recommendations = await getRecommendedSongs(videoId);

          // Parse recommendations response
          let songs = [];
          if (recommendations?.data) {
            songs = Array.isArray(recommendations.data) ? recommendations.data : [];
          } else if (Array.isArray(recommendations)) {
            songs = recommendations;
          }

          // Format and filter songs to ensure they have all required fields
          const formattedSongs = songs
            .filter(s => s && s.id && s.id !== videoId)
            .map(s => {
              // Extract artwork URL from image array
              let artworkUrl = '';
              if (Array.isArray(s.image) && s.image.length > 0) {
                // Get highest quality image (usually the last one)
                artworkUrl = s.image[s.image.length - 1]?.url ||
                  s.image[2]?.url ||
                  s.image[1]?.url ||
                  s.image[0]?.url || '';
              } else if (typeof s.image === 'string') {
                artworkUrl = s.image;
              }

              return {
                id: s.id,
                name: s.name || s.title || 'Unknown',
                title: s.name || s.title || 'Unknown',
                artist: s.artists?.primary?.map(a => a.name).join(', ') ||
                  s.primary_artists ||
                  s.artist ||
                  'Unknown Artist',
                artists: s.artists || { primary: [{ name: 'Unknown Artist' }] },
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
            console.log(`✅ Adding ${formattedSongs.length} Saavn recommendations to queue`);
            await AddSongsToQueue(formattedSongs);
          }
        } catch (error) {
          console.warn('Failed to build Saavn queue:', error?.message || error);
        }
      })();
    }
  } catch (error) {
    console.error('Error in PlaySongWithRelated:', error);
  }
}

async function AddPlaylist(songs, startSongId = null) {
  try {
    // Validate songs array
    if (!Array.isArray(songs) || songs.length === 0) {
      console.error('Invalid songs array provided to AddPlaylist');
      return;
    }

    // Filter/Slice if startSongId is provided
    let tracksToAdd = [...songs];
    if (startSongId) {
      const startIndex = songs.findIndex(s => s.id === startSongId || s.videoId === startSongId);
      if (startIndex !== -1) {
        console.log(`🎵 Playing from index ${startIndex} (Song ID: ${startSongId}), skipping previous ${startIndex} songs`);
        tracksToAdd = songs.slice(startIndex);
      } else {
        console.warn(`⚠️ Start song ID ${startSongId} not found in playlist, playing all`);
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

    const processedSongs = await Promise.all(tracksToAdd.map(async (song, index) => {
      let playbackUrl = song.url;
      let updatedSong = { ...song };

      // Check if this is a YouTube song
      const isYouTubeSong = song.id && typeof song.id === 'string' && song.id.length === 11 && !song.isLocalMusic;

      if (isYouTubeSong) {
        // Only fetch stream for the FIRST song immediately
        // All others get a placeholder and will be fetched on demand
        const isFirstSong = index === 0;

        if (isFirstSong) {
          try {
            console.log('Fetching YouTube stream for first playlist song:', song.id);
            const streamData = await youtubeStreamingService.getStreamUrl(song.id);

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
              };
            }
          } catch (error) {
            console.error('Error fetching YouTube stream for first playlist song:', error);
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
          updatedSong.url = song.downloadUrl[qualityIndex]?.url || song.downloadUrl.find(d => d?.url)?.url || song.url;
        } else if (song.download_url && Array.isArray(song.download_url)) {
          updatedSong.url = song.download_url[qualityIndex]?.url || song.download_url.find(d => d?.url)?.url || song.url;
        }
      }

      const artworkUrl = extractArtwork(song) || extractArtwork(updatedSong);

      return {
        ...updatedSong,
        url: playbackUrl || updatedSong.url,
        artwork: artworkUrl,
        image: artworkUrl,
        currentPlayingQuality: currentQuality,
      };
    }));

    // BATCHED PLAYLIST ADDITION
    // 1. Add first batch for instant playback
    const INITIAL_BATCH_SIZE = 20;
    const initialBatch = processedSongs.slice(0, INITIAL_BATCH_SIZE);

    await TrackPlayer.reset();
    await TrackPlayer.add(initialBatch);
    await TrackPlayer.play();

    // Signal that this is a playlist/album playback (disable auto-recommendations)
    DeviceEventEmitter.emit('playback-mode-changed', { isPlaylist: true });

    console.log(`✅ Playlist: Added initial ${initialBatch.length} songs and started playback`);

    // 2. Add remaining songs in background
    const remainingSongs = processedSongs.slice(INITIAL_BATCH_SIZE);

    if (remainingSongs.length > 0) {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const BATCH_SIZE = 50;
          for (let i = 0; i < remainingSongs.length; i += BATCH_SIZE) {
            const batch = remainingSongs.slice(i, i + BATCH_SIZE);

            // Small pause to let UI breathe
            if (i > 0) { await new Promise(resolve => setTimeout(resolve, 50)); }

            await TrackPlayer.add(batch);
            console.log(`✅ Playlist: Added background batch ${i / BATCH_SIZE + 1}`);
          }

          DeviceEventEmitter.emit('queue-updated', { count: processedSongs.length });
          // Cleanup duplicates introduced by concurrent adds
          try { await removeDuplicateTracks(); } catch (e) { console.warn('Dedupe failed after AddPlaylist', e); }
        } catch (batchError) {
          console.error('❌ Error adding background playlist batch:', batchError);
        }
      });
    } else {
      // No remaining songs - do a quick dedupe
      try { await removeDuplicateTracks(); } catch (e) { console.warn('Dedupe failed after AddPlaylist', e); }
    }

    // Prefetch next song check
    setTimeout(() => {
      queueManager.prefetchNextTrack().catch(err =>
        console.error('Error prefetching next track:', err)
      );
    }, 1000);

    // Add recommendations after album/playlist songs to enable continuous playback
    // This runs in the background after the album is loaded
    InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        try {
          // Get the last song from the original songs array to base recommendations on
          const lastSong = processedSongs[processedSongs.length - 1];
          if (!lastSong || !lastSong.id) { return; }

          console.log('🎵 Fetching recommendations for continuous playback after album/playlist');

          // Check if this is a YouTube Music song
          const isYouTubeSong = lastSong.id && typeof lastSong.id === 'string' && lastSong.id.length === 11 && !lastSong.isLocalMusic;

          if (isYouTubeSong) {
            // Fetch YouTube Music recommendations
            const recommendations = await queueManager.buildQueueFromRecommendations(lastSong.id, 'ytmusic', 20);
            if (recommendations && recommendations.length > 0) {
              await AddSongsToQueue(recommendations);
              console.log(`✅ Added ${recommendations.length} YTMusic recommendations after album`);
            }
          } else {
            // Fetch JioSaavn recommendations
            const { getRecommendedSongs } = require('./Api/Recommended');
            const recommendations = await getRecommendedSongs(lastSong.id);

            // Parse recommendations response
            let songs = [];
            if (recommendations?.data) {
              songs = Array.isArray(recommendations.data) ? recommendations.data : [];
            } else if (Array.isArray(recommendations)) {
              songs = recommendations;
            }

            // Format songs
            const formattedSongs = songs
              .filter(s => s && s.id)
              .map(s => {
                let artworkUrl = '';
                if (Array.isArray(s.image) && s.image.length > 0) {
                  artworkUrl = s.image[s.image.length - 1]?.url ||
                    s.image[2]?.url ||
                    s.image[1]?.url ||
                    s.image[0]?.url || '';
                } else if (typeof s.image === 'string') {
                  artworkUrl = s.image;
                }

                return {
                  id: s.id,
                  name: s.name || s.title || 'Unknown',
                  title: s.name || s.title || 'Unknown',
                  artist: s.artists?.primary?.map(a => a.name).join(', ') ||
                    s.primary_artists ||
                    s.artist ||
                    'Unknown Artist',
                  artists: s.artists || { primary: [{ name: 'Unknown Artist' }] },
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
              console.log(`✅ Added ${formattedSongs.length} Saavn recommendations after album`);
            }
          }
        } catch (error) {
          console.warn('Failed to add recommendations after album:', error?.message || error);
        }
      }, 2000); // Wait 2 seconds after album loads
    });
  } catch (error) {
    console.error('Error in AddPlaylist:', error);
  }
}

async function AddSongsToQueue(songs) {
  console.log(`🎵 AddSongsToQueue: Lazy loading ${songs.length} songs...`);

  const qualityIndex = await getIndexQuality();
  const qualityNames = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];
  const currentQuality = qualityNames[qualityIndex] || 'Unknown';

  const processedSongs = [];

  for (const song of songs) {
    const hasValidYouTubeId = song.id && typeof song.id === 'string' && song.id.length === 11;
    const isYTMusicSource = song.source === 'ytmusic' || song.isYTMusic === true;

    let processedSong = { ...song };

    if ((hasValidYouTubeId && !song.isLocalMusic) || isYTMusicSource) {
      // LAZY LOAD: Do NOT fetch stream here. Just set placeholder.
      const videoId = song.id || song.videoId;
      processedSong = {
        ...processedSong,
        url: `ytmusic://${videoId}`,
        _needsStream: true,
        isYTMusic: true,
        source: 'ytmusic',
        currentPlayingQuality: currentQuality,
        // Ensure artwork is set correctly using helper
        artwork: extractArtwork(song),
        image: extractArtwork(song),
        duration: song.duration,
      };



    } else {
      // Standard logic for downloads/local
      if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
        processedSong.url = song.downloadUrl[qualityIndex]?.url || song.downloadUrl.find(d => d?.url)?.url || song.url;
      } else if (song.download_url && Array.isArray(song.download_url)) {
        processedSong.url = song.download_url[qualityIndex]?.url || song.download_url.find(d => d?.url)?.url || song.url;
      }
      processedSong.currentPlayingQuality = currentQuality;
    }

    processedSongs.push(processedSong);
  }

  if (processedSongs.length > 0) {
    try {
      // DEDUPE: Remove songs that are already present in the current queue
      const existingQueue = await TrackPlayer.getQueue();
      const existingIds = new Set(existingQueue.map(s => s.id));

      const uniqueProcessed = [];
      const seen = new Set();
      for (const p of processedSongs) {
        if (!p || !p.id) { continue; }
        if (existingIds.has(p.id)) { continue; } // already in queue
        if (seen.has(p.id)) { continue; } // duplicate inside incoming batch
        uniqueProcessed.push(p);
        seen.add(p.id);
      }

      if (uniqueProcessed.length === 0) {
        console.log('⚠️ AddSongsToQueue: No new songs to add after deduplication');
        return;
      }

      const songsToAdd = uniqueProcessed;

      // BATCHED ADDITION STRATEGY
      // 1. Add first small batch immediately for instant UI response
      const INITIAL_BATCH_SIZE = 20;
      const initialBatch = songsToAdd.slice(0, INITIAL_BATCH_SIZE);

      await TrackPlayer.add(initialBatch);
      console.log(`✅ Queue: Added initial ${initialBatch.length} songs instantly`);

      // Emit event to update UI immediately
      DeviceEventEmitter.emit('queue-updated', { count: initialBatch.length });

      // 2. Add remaining songs in background batches
      const remainingSongs = songsToAdd.slice(INITIAL_BATCH_SIZE);

      if (remainingSongs.length > 0) {
        InteractionManager.runAfterInteractions(async () => {
          try {
            const BATCH_SIZE = 50;
            for (let i = 0; i < remainingSongs.length; i += BATCH_SIZE) {
              const batch = remainingSongs.slice(i, i + BATCH_SIZE);

              // Small delay to allow UI frame updates between batches
              if (i > 0) { await new Promise(resolve => setTimeout(resolve, 50)); }

              await TrackPlayer.add(batch);
              console.log(`✅ Queue: Added background batch ${i / BATCH_SIZE + 1} (${batch.length} songs)`);
            }

            // Final event to ensuring everything is synced
            DeviceEventEmitter.emit('queue-updated', { count: processedSongs.length });
            // Cleanup duplicates that may have been introduced by concurrent adds
            try { await removeDuplicateTracks(); } catch (e) { console.warn('Dedupe failed after AddSongsToQueue', e); }
          } catch (batchError) {
            console.error('❌ Error adding background batch:', batchError);
          }
        });
      } else {
        // No remaining songs - still attempt a quick dedupe to be safe
        try { await removeDuplicateTracks(); } catch (e) { console.warn('Dedupe failed after AddSongsToQueue', e); }
      }
    } catch (error) {
      console.error('❌ Failed to add songs to queue:', error.message);
    }
  }
}
async function PlaySong() {
  await TrackPlayer.play();
}
async function PauseSong() {
  await TrackPlayer.pause();
}

async function SetProgressSong(value) {
  try {
    // Ensure value is a valid number and within bounds
    const seekValue = Math.max(0, parseFloat(value) || 0);
    await TrackPlayer.seekTo(seekValue);
  } catch (error) {
    console.error('Error seeking to position:', error);
  }
}

async function PlayNextSong() {
  // Use SkipOperationManager to debounce and lock skip operations
  const executed = await skipOperationManager.executeSkip(async (signal) => {
    try {
      // Ensure player is initialized
      if (!isPlayerInitialized) {
        console.log('Player not initialized, setting up...');
        await setupPlayer();
      }

      // Stop tracking current song before switching
      await historyManager.stopTracking();

      // Get current track and queue info
      const currentTrack = await TrackPlayer.getCurrentTrack();
      const queue = await TrackPlayer.getQueue();

      console.log('⏭️ PlayNextSong - Current:', currentTrack, 'Queue:', queue.length);

      // If there's no next track, just return
      if (currentTrack >= queue.length - 1) {
        console.log('No next track available - attempting quick recommendation fill');
        try {
          // Try to quickly build a few recommendations to fill the queue
          const active = queue[currentTrack] || {};
          const videoIdForRecs = active.id || active.videoId;
          if (videoIdForRecs) {
            const quickRecs = await Promise.race([
              queueManager.buildQueueFromRecommendations(videoIdForRecs, 'ytmusic', 6),
              new Promise(resolve => setTimeout(() => resolve(null), 800)),
            ]);
            if (quickRecs && quickRecs.length > 0) {
              const filtered = quickRecs.filter(r => r.id !== (active.id || active.videoId));
              if (filtered.length > 0) {
                await AddSongsToQueue(filtered);
                console.log('✅ Quick-fill recommendations added to queue');
              }
            }
          }
        } catch (e) {
          console.warn('Quick recommendation fill failed', e?.message || e);
        }

        // Re-fetch queue and if still no next track, bail out
        const refreshed = await TrackPlayer.getQueue();
        if (currentTrack >= refreshed.length - 1) {
          console.log('Still no next track available after quick fill');
          return;
        }
      }

      const nextTrackIndex = currentTrack + 1;

      // Re-fetch queue to get the latest state (track may have been replaced by prefetch)
      const freshQueue = await TrackPlayer.getQueue();
      const nextTrack = freshQueue[nextTrackIndex];

      if (!nextTrack) {
        console.log('No next track available');
        return;
      }

      // Check if next track needs stream (wasn't prefetched or still has placeholder URL)
      const needsStream = nextTrack._needsStream ||
        nextTrack.url?.startsWith('ytmusic://') ||
        nextTrack.url?.includes('music.youtube.com');

      if (needsStream && !nextTrack._prefetched) {
        // FIRST: Check if SmartPrefetchManager has cached stream
        const cachedStream = smartPrefetchManager.getPrefetchedStream(nextTrack.id);

        let streamData = cachedStream;

        if (cachedStream) {
          console.log('✅ Using cached prefetched stream for skip');
        } else {
          console.log('🔄 Track not in cache, fetching on-demand...');
          // Use SmartPrefetchManager for on-demand fetch (with retry)
          streamData = await smartPrefetchManager.fetchOnDemand(nextTrack.id);
        }

        if (streamData && streamData.url) {
          // Replace track in queue with valid URL using SAFE non-blocking method
          await smartPrefetchManager.replaceTrackAndWait(nextTrackIndex, nextTrack, streamData);
          console.log('✅ Track replaced with valid URL');
        } else {
          // Failed to get stream - skip this track entirely
          console.error('❌ Failed to get stream, removing track');
          try {
            await smartPrefetchManager._safeRemove(nextTrackIndex);
          } catch (e) {
            const msg = e?.message || String(e);
            if (msg && msg.toLowerCase().includes('out of bounds')) {
              if (__DEV__) { console.debug('Safe remove ignored out-of-bounds in PlayNextSong fallback:', msg); }
            } else {
              console.warn('Safe remove failed in PlayNextSong fallback', msg);
            }
          }
          // Try to play the next one instead
          await TrackPlayer.skipToNext();
          return;
        }
      }

      // Skip to next track - should now have valid URL
      await TrackPlayer.skipToNext();

      // Get the new track and start tracking it
      const newTrack = await TrackPlayer.getActiveTrack();
      if (newTrack) {
        await historyManager.startTracking(newTrack);
        skipOperationManager.resetErrorCounter();
      }

      // Ensure playback starts
      const stateAfterSkip = await TrackPlayer.getState();
      if (stateAfterSkip !== TrackPlayer.STATE_PLAYING) {
        await TrackPlayer.play();
      }

    } catch (error) {
      if (error.message === 'AbortError') {
        console.log('⏭️ Skip cancelled');
      } else {
        console.error('❌ Error in PlayNextSong:', error);
      }
      throw error;
    }
  });

  if (!executed) {
    console.log('⏭️ Skip blocked - operation in progress');
  }
}

async function PlayPreviousSong() {
  // Use SkipOperationManager to debounce and lock skip operations
  const executed = await skipOperationManager.executeSkip(async (signal) => {
    try {
      // Ensure player is initialized
      if (!isPlayerInitialized) {
        console.log('Player not initialized, setting up...');
        await setupPlayer();
      }

      // Stop tracking current song before switching
      await historyManager.stopTracking();

      // Check if operation was cancelled
      if (signal.aborted) {
        throw new Error('AbortError');
      }

      await TrackPlayer.skipToPrevious();

      // Get the new track and start tracking it
      const newTrack = await TrackPlayer.getActiveTrack();
      if (newTrack) {
        await historyManager.startTracking(newTrack);
        // Reset error counter on successful track change
        skipOperationManager.resetErrorCounter();
      }

      PlaySong();
    } catch (error) {
      if (error.message === 'AbortError') {
        console.log('⏮️ Skip cancelled');
      } else {
        console.error('❌ Error in PlayPreviousSong:', error);
      }
      throw error;
    }
  });

  if (!executed) {
    console.log('⏮️ Skip blocked - operation already in progress');
  }
}
async function SkipToTrack(trackIndex) {
  try {
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
      console.error('Track index out of bounds:', validIndex, 'Queue length:', queue.length);
      return;
    }

    const targetTrack = queue[validIndex];

    // Check if track needs stream (random song selection)
    const needsStream = targetTrack._needsStream ||
      targetTrack.url?.startsWith('ytmusic://') ||
      targetTrack.url?.includes('music.youtube.com');

    if (needsStream && !targetTrack._prefetched) {
      console.log('🎯 Random track selection - checking cache...');

      // FIRST: Check if SmartPrefetchManager has cached stream
      const cachedStream = smartPrefetchManager.getPrefetchedStream(targetTrack.id);

      let streamData = cachedStream;

      if (cachedStream) {
        console.log('✅ Using cached prefetched stream for random selection');
      } else {
        console.log('🔄 Track not in cache, fetching on-demand...');
        // Use SmartPrefetchManager for on-demand fetch (with retry)
        streamData = await smartPrefetchManager.fetchOnDemand(targetTrack.id);
      }

      if (streamData && streamData.url) {
        // Replace track in queue with valid URL using SAFE non-blocking method
        await smartPrefetchManager.replaceTrackAndWait(validIndex, targetTrack, streamData);
        console.log('✅ Track replaced for random selection');
      } else {
        console.error('❌ Failed to get stream for random track');
        return;
      }
    }

    await TrackPlayer.skip(validIndex);

    // Get the new track and start tracking it
    const newTrack = await TrackPlayer.getActiveTrack();
    if (newTrack) {
      await historyManager.startTracking(newTrack);
    }

    await PlaySong();
  } catch (error) {
    console.error('Error in SkipToTrack:', error);
  }
}
async function SetRepeatMode(mode) {
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

async function AddOneSongToPlaylist(song) {
  try {
    console.log('🎵 AddOneSongToPlaylist called with song:', song?.title || 'Unknown');

    // Import the bottom sheet playlist selector manager
    const { PlaylistSelectorBottomSheetManager } = require('./Utils/PlaylistSelectorBottomSheetManager');

    // Validate song object
    if (!song || !song.id) {
      console.error('❌ Invalid song object provided to AddOneSongToPlaylist:', song);
      ToastAndroid.show('Invalid song data', ToastAndroid.SHORT);
      return false;
    }

    console.log('✅ Song validation passed, song ID:', song.id);

    console.log('AddOneSongToPlaylist called with song (bottom sheet):', song.title);

    // Safe image URL extraction
    const getImageUrl = (imageData) => {
      if (!imageData) { return null; }
      if (typeof imageData === 'string') { return imageData; }
      if (Array.isArray(imageData)) {
        for (const img of imageData) {
          if (typeof img === 'string' && img.trim() !== '') { return img; }
          if (img && typeof img === 'object' && img.url) { return img.url; }
        }
      }
      if (imageData && typeof imageData === 'object' && imageData.url) { return imageData.url; }
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
      artistID: song.artistID || song.primary_artists_id || '',
    };

    // Use the PlaylistSelectorBottomSheetManager to show the selection interface
    console.log('📱 Attempting to show playlist selector...');
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
  SkipToTrack,
  SetRepeatMode,
  getIndexQuality,
  AddOneSongToPlaylist,
  PlaySongWithRelated,
}
