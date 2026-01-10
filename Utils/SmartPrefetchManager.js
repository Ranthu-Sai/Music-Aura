/**
 * SmartPrefetchManager
 *
 * YOUTUBE MUSIC ONLY - Saavn doesn't need prefetching as it provides direct stream URLs
 *
 * Fixed prefetch strategy that PREVENTS race conditions:
 *
 * 1. Listen for PlaybackState.Playing (not track change)
 * 2. Wait 2 seconds after playback starts
 * 3. Prefetch ONLY the next song (not 3)
 * 4. Handle playback errors with on-demand fetch fallback
 * 5. Cancel prefetch if track changes before completion
 *
 * This ensures tracks are ready BEFORE auto-progression occurs.
 */

import TrackPlayer, {Event, State} from 'react-native-track-player';
import youtubeStreamingService from './YouTubeStreamingService';
import {InteractionManager} from 'react-native';

// Constants for configuration
// Shorter prefetch delay to start fetching the immediate next track faster
const PREFETCH_DELAY_MS = 300; // 300 ms after playback starts
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache TTL
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

class SmartPrefetchManager {
  constructor() {
    // Cache and state management
    this.prefetchedTracks = new Map(); // id -> { url, headers, timestamp }
    this.prefetchInProgress = new Set(); // Currently prefetching IDs

    // Timing control
    this.prefetchTimer = null;
    this.currentTrackIndex = -1;
    this.isInitialized = false;

    // Error handling
    this.errorHandlerRegistered = false;

    // Circuit Breaker (Prevent looping storms)
    this.consecutiveErrors = 0;
    this.lastErrorTimestamp = 0;

    // Initialization grace period to prevent auto-skip on app reopen
    this.initializationTime = 0;
    this.INITIALIZATION_GRACE_PERIOD = 3000; // 3 seconds (overridden in headless)

    // Headless service mode flag
    this.isHeadless = false;

    // One-shot suppression of cleanup on next track change
    this.suppressNextCleanup = false;
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  /**
   * Initialize the prefetch manager with correct event listeners
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Record initialization time
    this.initializationTime = Date.now();

    // FIXED: Listen to PlaybackState instead of track change
    TrackPlayer.addEventListener(
      Event.PlaybackState,
      this._handlePlaybackState.bind(this),
    );

    // Listen for track changes to cancel pending prefetches
    TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      this._handleTrackChanged.bind(this),
    );

    // CRITICAL: Listen for playback errors to handle auto-completion failures
    TrackPlayer.addEventListener(
      Event.PlaybackError,
      this._handlePlaybackError.bind(this),
    );

    this.isInitialized = true;
    this.errorHandlerRegistered = true;
  }

  /**
   * Enable or disable headless mode (PlaybackService context)
   */
  setHeadlessMode(isHeadless) {
    this.isHeadless = !!isHeadless;
    // Disable grace period in headless to ensure immediate prefetch
    this.INITIALIZATION_GRACE_PERIOD = this.isHeadless ? 0 : 3000;
  }

  /**
   * Suppress cleanup for the next track change (used for manual jumps)
   */
  suppressCleanupNextChange() {
    this.suppressNextCleanup = true;
  }

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  /**
   * Handle playback state changes
   * Triggers prefetch 2 seconds after playback starts
   */
  /**
   * Handle playback state changes
   * Triggers N+2 prefetch 2 seconds after playback starts
   */
  async _handlePlaybackState(event) {
    if (event.state === State.Playing) {
      // Get current track index
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      // Cancel any pending prefetch
      this._cancelPendingPrefetch();

      // Store current index for validation
      this.currentTrackIndex = currentIndex;

      // Wait a short time, then prefetch multiple next songs (N+1, N+2, N+3)
      this.prefetchTimer = setTimeout(async () => {
        // Validate we're still on the same track
        const nowPlaying = await TrackPlayer.getActiveTrackIndex();
        if (nowPlaying === this.currentTrackIndex) {
          // Prefetch next 3 tracks
          for (let i = 1; i <= 3; i++) {
            await this._prefetchTrackAtIndex(nowPlaying + i);
          }
        }
      }, PREFETCH_DELAY_MS);
    }
  }

  /**
   * Handle track changes - cancel pending prefetch
   */
  /**
   * Handle track changes - IMMEDIATE N+1, N+2, N+3 prefetch + queue cleanup
   */
  async _handleTrackChanged(event) {
    // Skip processing during initialization grace period to prevent auto-skip on app reopen
    const timeSinceInit = Date.now() - this.initializationTime;
    if (timeSinceInit < this.INITIALIZATION_GRACE_PERIOD) {
      return;
    }

    if (event.index !== undefined && event.index !== null) {
      this._cancelPendingPrefetch();
      this.currentTrackIndex = event.index;

      // 🧹 QUEUE CLEANUP: Remove old tracks, keep only 5 previous
      // Skip cleanup if explicitly suppressed for manual jumps
      if (!this.suppressNextCleanup) {
        await this._cleanupOldTracks(event.index);
      } else {
        this.suppressNextCleanup = false; // reset one-shot flag
      }

      // 🚀 IMMEDIATE ACTION: Prefetch next 3 songs aggressively
      // This ensures auto-recommendation songs are ready before playback

      // Prefetch in parallel for speed
      Promise.all([
        this._prefetchTrackAtIndex(event.index + 1),
        this._prefetchTrackAtIndex(event.index + 2),
        this._prefetchTrackAtIndex(event.index + 3),
      ]).catch(err => {
        console.warn('Prefetch Promise.all failed', err);
      });
    }
  }

  /**
   * CRITICAL: Handle playback errors for auto-completion failures
   * This is the key fix - when TrackPlayer fails on placeholder URL,
   * we fetch on-demand and retry playback
   */
  async _handlePlaybackError(event) {
    const now = Date.now();

    // Circuit Breaker Reset (if error was long ago)
    if (now - this.lastErrorTimestamp > 5000) {
      this.consecutiveErrors = 0;
    }

    this.lastErrorTimestamp = now;
    this.consecutiveErrors++;

    // STOP if looping too fast (Max 3 retries in 5 seconds)
    if (this.consecutiveErrors > 3) {
      console.error(
        '⚡ CIRCUIT BREAKER TRIPPED: Stopping playback to prevent freeze.',
      );
      await TrackPlayer.pause();
      this.consecutiveErrors = 0;
      return;
    }

    try {
      const currentTrack = await TrackPlayer.getActiveTrack();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      // ... (rest of logic)

      if (!currentTrack) {
        return;
      }

      // Check if track needs stream (has placeholder URL)
      if (this.needsStream(currentTrack)) {
        // Fetch stream on-demand with forced fresh (bypass cache on error)
        const streamData = await this.fetchOnDemand(currentTrack.id, true);

        if (streamData && streamData.url) {
          // Replace current track with valid URL
          await this._replaceAndPlayTrack(
            currentIndex,
            currentTrack,
            streamData,
          );
        } else {
          // Failed to get stream - skip to next
          await this._skipToNextValidTrack(currentIndex);
        }
      }
    } catch (error) {
      console.error('❌ Error in playback error handler:', error.message);
    }
  }

  // ==========================================
  // PREFETCH OPERATIONS
  // ==========================================

  /**
   * Prefetch ONLY the next song (not multiple)
   */
  async _prefetchNextSong(currentIndex) {
    const nextIndex = currentIndex + 1;
    await this._prefetchTrackAtIndex(nextIndex);
  }

  /**
   * Prefetch a single track by queue index
   */
  async _prefetchTrackAtIndex(index) {
    try {
      const queue = await TrackPlayer.getQueue();

      if (index < 0 || index >= queue.length) {
        return; // Invalid index
      }

      const track = queue[index];

      // Skip if not a YouTube track or already has valid URL
      if (!this.needsStream(track)) {
        return;
      }

      // Skip if already prefetched and not expired
      const cached = this.getPrefetchedStream(track.id);
      if (cached) {
        // Still replace in queue if needed
        await this._replaceTrackInQueue(index, track, cached);
        return;
      }

      // Skip if already prefetching this track
      if (this.prefetchInProgress.has(track.id)) {
        return;
      }

      this.prefetchInProgress.add(track.id);

      const streamData = await youtubeStreamingService.getStreamUrl(track.id);

      if (streamData && streamData.url) {
        // Store prefetched data
        this._cacheStream(track.id, streamData);

        // Replace track in queue with valid URL
        await this._replaceTrackInQueue(index, track, streamData);
      }
    } catch (error) {
      console.error(`❌ Prefetch failed for index ${index}:`, error.message);
    } finally {
      // Clean up in-progress set
      const queue = await TrackPlayer.getQueue();
      if (index < queue.length) {
        this.prefetchInProgress.delete(queue[index]?.id);
      }
    }
  }

  // ==========================================
  // QUEUE OPERATIONS
  // ==========================================

  /**
   * Replace a track and WAIT for completion (for manual skips)
   * Wraps in InteractionManager but returns Promise that resolves after
   */
  async replaceTrackAndWait(index, originalTrack, streamData) {
    return new Promise(resolve => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const updatedTrack = this._createUpdatedTrack(
            originalTrack,
            streamData,
          );

          // Resolve current queue and index safety: ensure original track still exists
          const queue = await TrackPlayer.getQueue();
          let safeIndex = index;

          if (!Array.isArray(queue) || queue.length === 0) {
            // Queue empty - append and resolve
            await TrackPlayer.add(updatedTrack);
            return;
          }

          // If the provided index is out of range, try to find by id
          if (safeIndex < 0 || safeIndex >= queue.length || queue[safeIndex]?.id !== originalTrack?.id) {
            const found = queue.findIndex(t => t && t.id === originalTrack?.id);
            if (found >= 0) {
              safeIndex = found;
            } else {
              // Original track no longer in queue - append updated track instead
              console.warn('replaceTrackAndWait: original track not found in queue, appending updated track');
              await TrackPlayer.add(updatedTrack);
              return;
            }
          }

          // Remove old track and insert new one at same position (safe)
          await this._safeRemove(safeIndex);
          // Recompute queue length to avoid out-of-bounds insert
          const newQueue = await TrackPlayer.getQueue();
          const insertPos = Math.min(safeIndex, newQueue.length);
          await TrackPlayer.add(updatedTrack, insertPos);
        } catch (error) {
          console.error('Error replacing track:', error.message);
        } finally {
          resolve();
        }
      });
    });
  }

  /**
   * Replace a track immediately without InteractionManager (safe for headless service)
   */
  async replaceTrackImmediately(index, originalTrack, streamData) {
    try {
      const updatedTrack = this._createUpdatedTrack(originalTrack, streamData);

      // Resolve current queue and ensure safe index. This avoids "index out of bounds"
      const queue = await TrackPlayer.getQueue();
      if (!Array.isArray(queue) || queue.length === 0) {
        // Queue empty: append
        await TrackPlayer.add(updatedTrack);
        return;
      }

      let safeIndex = index;
      if (safeIndex < 0 || safeIndex >= queue.length || queue[safeIndex]?.id !== originalTrack?.id) {
        const found = queue.findIndex(t => t && t.id === originalTrack?.id);
        if (found >= 0) {
          safeIndex = found;
        } else {
          console.warn('replaceTrackImmediately: original track not found in queue, appending updated track');
          await TrackPlayer.add(updatedTrack);
          return;
        }
      }

      await this._safeRemove(safeIndex);
      const newQueue = await TrackPlayer.getQueue();
      const insertPos = Math.min(safeIndex, newQueue.length);
      await TrackPlayer.add(updatedTrack, insertPos);
    } catch (error) {
      console.error('Error in replaceTrackImmediately:', error.message);
    }
  }

  /**
   * Replace a track in queue with updated URL (non-blocking, fire-and-forget)
   */
  async _replaceTrackInQueue(index, originalTrack, streamData) {
    // In headless service, InteractionManager may not run; replace immediately
    if (this.isHeadless) {
      await this.replaceTrackImmediately(index, originalTrack, streamData);
      return;
    }
    // UI mode: reuse wait logic to avoid jank
    this.replaceTrackAndWait(index, originalTrack, streamData);
  }

  /**
   * Replace CURRENT track and restart playback (for error recovery)
   */
  async _replaceAndPlayTrack(index, originalTrack, streamData) {
    try {
      // Resolve current queue and try to locate the original track if index changed
      const currentQ = await TrackPlayer.getQueue();
      let safeIndex = index;
      if (!currentQ[safeIndex] || currentQ[safeIndex].id !== originalTrack.id) {
        const found = currentQ.findIndex(t => t && t.id === originalTrack.id);
        if (found >= 0) {
          safeIndex = found;
        } else {
          console.warn('⚠️ Race condition prevented: original track not found in queue during replaceAndPlay');
          return;
        }
      }

      const updatedTrack = this._createUpdatedTrack(originalTrack, streamData);

      // Remove current track (safe)
      await this._safeRemove(safeIndex);

      // Add updated track at same (or clamped) position
      const newQueue = await TrackPlayer.getQueue();
      const insertPos = Math.min(safeIndex, newQueue.length);
      await TrackPlayer.add(updatedTrack, insertPos);

      // Skip to it and play
      await TrackPlayer.skip(insertPos);
      await TrackPlayer.play();

      // Success - Reset breaker
      this.consecutiveErrors = 0;
    } catch (error) {
      console.error('Error in replaceAndPlayTrack:', error.message);
    }
  }

  /**
   * Skip to next valid track when current one fails completely
   */
  async _skipToNextValidTrack(failedIndex) {
    // Delay to prevent CPU spike (Cool-down)
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const queue = await TrackPlayer.getQueue();

      // Safety check
      if (failedIndex >= queue.length) {
        return;
      }

      // Remove the failed track (safe)
      await this._safeRemove(failedIndex);

      // Get new queue state
      const newQueue = await TrackPlayer.getQueue();

      if (newQueue.length === 0) {
        await TrackPlayer.stop();
        return;
      }

      // Try to play the next track (now at same index)
      const nextTrack = newQueue[failedIndex] || newQueue[0];

      if (nextTrack && this.needsStream(nextTrack)) {
        // Fetch stream on-demand for next track
        const streamData = await this.fetchOnDemand(nextTrack.id, true);
        if (streamData && streamData.url) {
          const nextIndex = failedIndex < newQueue.length ? failedIndex : 0;
          await this._replaceAndPlayTrack(nextIndex, nextTrack, streamData);
          return;
        }
      }

      // Just try to play whatever is next
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error skipping to next valid track:', error.message);
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Safe removal helper: filters indices against current queue and removes valid ones
   * Accepts a single index or array of indices.
   */
  async _safeRemove(indexOrIndexes) {
    try {
      const queue = await TrackPlayer.getQueue();
      if (!Array.isArray(queue) || queue.length === 0) {
        return;
      }

      const indexes = Array.isArray(indexOrIndexes)
        ? indexOrIndexes.slice()
        : [indexOrIndexes];
      // Filter and dedupe
      const valid = Array.from(new Set(indexes)).filter(
        i => Number.isInteger(i) && i >= 0 && i < queue.length,
      );
      if (valid.length === 0) {
        return;
      }

      // Sort descending to avoid shifting issues
      valid.sort((a, b) => b - a);
      await TrackPlayer.remove(valid);
    } catch (error) {
      const msg = error?.message || String(error);
      // Silently ignore common TrackPlayer "out of bounds" errors which can happen
      // due to race conditions when queue changes concurrently.
      if (msg && msg.toLowerCase().includes('out of bounds')) {
        // debug log only in development - avoid console warning noise in production
        if (__DEV__) {

        }
        return;
      }
      console.warn('Safe remove failed:', msg);
    }
  }

  /**
   * Create updated track object with stream data
   */
  _createUpdatedTrack(originalTrack, streamData) {
    return {
      ...originalTrack,
      url: streamData.url,
      headers: streamData.headers,
      userAgent: streamData.headers?.['User-Agent'],
      _needsStream: false,
      _prefetched: true,
    };
  }

  /**
   * Check if track needs stream fetching
   */
  needsStream(track) {
    if (!track) {
      return false;
    }

    // Check if it's a YouTube track needing stream
    const isYTMusic =
      track.id &&
      typeof track.id === 'string' &&
      track.id.length === 11 &&
      !track.isLocalMusic;

    if (!isYTMusic) {
      return false;
    }

    // Check if URL is placeholder or missing
    const url = track.url || '';
    return (
      !url || url.startsWith('ytmusic://') || url.includes('music.youtube.com')
    );
  }

  /**
   * Cancel pending prefetch timer
   */
  _cancelPendingPrefetch() {
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
  }

  /**
   * 🧹 QUEUE CLEANUP: Remove old tracks to save memory and prevent queue bloat
   * Keeps only 5 previous songs before current track
   */
  async _cleanupOldTracks(currentIndex) {
    try {
      // Keep only 5 previous songs (matches Orbit's behavior)
      if (currentIndex <= 5) {
        return;
      }

      const tracksToRemove = currentIndex - 5;

      // Remove tracks from the beginning of the queue
      const removeIndices = [];
      for (let i = 0; i < tracksToRemove; i++) {
        removeIndices.push(i);
      }

      if (removeIndices.length > 0) {
        await this._safeRemove(removeIndices);

        // Update current track index after removal
        this.currentTrackIndex = 5; // After cleanup, current is always at index 5
      }
    } catch (error) {
      console.error('Queue cleanup error:', error.message);
    }
  }

  // ==========================================
  // CACHE OPERATIONS
  // ==========================================

  /**
   * Cache stream data
   */
  _cacheStream(trackId, streamData) {
    this.prefetchedTracks.set(trackId, {
      url: streamData.url,
      headers: streamData.headers,
      timestamp: Date.now(),
    });
  }

  /**
   * Get prefetched stream for a track
   */
  getPrefetchedStream(trackId) {
    const cached = this.prefetchedTracks.get(trackId);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      this.prefetchedTracks.delete(trackId);
      return null;
    }

    return cached;
  }

  /**
   * On-demand fetch for random song selection (with retry)
   */
  async fetchOnDemand(trackId, forceFresh = false) {
    // Check prefetch cache first (unless forceFresh)
    if (!forceFresh) {
      const cached = this.getPrefetchedStream(trackId);
      if (cached) {
        return cached;
      }
    }

    // Fetch with retry
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const streamData = await youtubeStreamingService.getStreamUrl(
          trackId,
          forceFresh,
        );

        if (streamData && streamData.url) {
          // Cache it
          this._cacheStream(trackId, streamData);
          return streamData;
        }
      } catch (error) {
        console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);

        if (attempt < MAX_RETRY_ATTEMPTS) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    console.error(
      `❌ On-demand fetch failed after ${MAX_RETRY_ATTEMPTS} attempts: ${trackId}`,
    );
    return null;
  }

  /**
   * Clear all prefetched data
   */
  clearCache() {
    this._cancelPendingPrefetch();
    this.prefetchedTracks.clear();
    this.prefetchInProgress.clear();
    this.currentTrackIndex = -1;
  }
}

// Singleton instance
const smartPrefetchManager = new SmartPrefetchManager();

export default smartPrefetchManager;
