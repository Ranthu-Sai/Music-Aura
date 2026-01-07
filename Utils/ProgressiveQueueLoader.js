/**
 * ProgressiveQueueLoader.js
 *
 * A service that manages progressive loading of large playlists to prevent UI lag.
 * Loads songs in batches based on playback position, ensuring smooth UI while
 * maintaining seamless playback experience.
 */

import TrackPlayer, {Event} from 'react-native-track-player';
import {InteractionManager, DeviceEventEmitter} from 'react-native';
import {getIndexQuality} from '../MusicPlayerFunctions';

// Configuration constants
const INITIAL_BATCH_SIZE = 20; // First batch for instant playback
const BACKGROUND_BATCH_SIZE = 15; // Subsequent batches
const LOAD_THRESHOLD = 5; // Load more when 5 songs from end of loaded queue
const BATCH_DELAY_MS = 50; // Delay between batch additions for UI responsiveness

class ProgressiveQueueLoader {
  constructor() {
    this.sourceSongs = []; // Full playlist (potentially shuffled)
    this.loadedCount = 0; // How many songs have been added to queue
    this.totalCount = 0; // Total songs in playlist
    this.isLoading = false; // Prevent concurrent batch loads
    this.trackChangeListener = null; // Event listener reference
    this.isActive = false; // Whether progressive loading is active
    this.qualityIndex = 4; // Default to 320kbps
    this.processSingleSong = null; // Song processing function reference
  }

  /**
   * Initialize progressive queue loading
   * @param {Array} songs - Full array of songs to load (can be pre-shuffled)
   * @param {Function} processSingleSong - Function to process a song for playback
   * @param {number} startIndex - Index to start from (for individual song play)
   */
  async initialize(songs, processSingleSong, startIndex = 0) {
    // Cleanup any existing state
    this.cleanup();

    if (!songs || songs.length === 0) {
      return {initialBatch: [], success: false};
    }

    // Store state
    this.sourceSongs = songs.slice(startIndex); // Songs from start index onwards
    this.totalCount = this.sourceSongs.length;
    this.loadedCount = 0;
    this.isActive = true;
    this.processSingleSong = processSingleSong;

    // Get quality setting
    this.qualityIndex = await getIndexQuality();

    // Calculate initial batch size (don't exceed total)
    const initialSize = Math.min(INITIAL_BATCH_SIZE, this.totalCount);
    const initialSongs = this.sourceSongs.slice(0, initialSize);

    // Process initial batch - first song gets stream, rest get placeholder
    const processedInitial = await Promise.all(
      initialSongs.map((song, index) =>
        processSingleSong(song, index, index === 0),
      ),
    );
    const validInitialSongs = processedInitial.filter(song => song !== null);

    this.loadedCount = validInitialSongs.length;

    // Setup track change listener for threshold-based loading
    this._setupTrackChangeListener();

    return {
      initialBatch: validInitialSongs,
      success: true,
      hasMore: this.loadedCount < this.totalCount,
    };
  }

  /**
   * Setup listener for track changes to trigger batch loading
   */
  _setupTrackChangeListener() {
    // Remove any existing listener
    if (this.trackChangeListener) {
      this.trackChangeListener.remove();
    }

    this.trackChangeListener = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async event => {
        if (!this.isActive || this.loadedCount >= this.totalCount) {
          return;
        }

        const currentIndex = event.index;
        if (currentIndex === undefined || currentIndex === null) {
          return;
        }

        // Check if we need to load more songs
        // Load when current position is within LOAD_THRESHOLD of loaded count
        const remainingLoaded = this.loadedCount - currentIndex - 1;

        if (remainingLoaded <= LOAD_THRESHOLD) {
          await this._loadNextBatch();
        }
      },
    );
  }

  /**
   * Load the next batch of songs
   */
  async _loadNextBatch() {
    if (
      this.isLoading ||
      !this.isActive ||
      this.loadedCount >= this.totalCount
    ) {
      return;
    }

    this.isLoading = true;

    try {
      // Use InteractionManager to avoid blocking UI
      await new Promise(resolve => {
        InteractionManager.runAfterInteractions(() => {
          resolve();
        });
      });

      // Calculate batch range
      const batchStart = this.loadedCount;
      const batchEnd = Math.min(
        batchStart + BACKGROUND_BATCH_SIZE,
        this.totalCount,
      );
      const batchSongs = this.sourceSongs.slice(batchStart, batchEnd);

      if (batchSongs.length === 0) {
        this.isLoading = false;
        return;
      }

      // Small delay to ensure UI stays responsive
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

      // Process batch - no songs need stream fetch (lazy load)
      const processedBatch = await Promise.all(
        batchSongs.map((song, batchIndex) =>
          this.processSingleSong(song, batchStart + batchIndex, false),
        ),
      );
      const validBatch = processedBatch.filter(song => song !== null);

      if (validBatch.length > 0) {
        await TrackPlayer.add(validBatch);
        this.loadedCount += validBatch.length;

        // Emit event for UI updates (debounced in ContextState)
        DeviceEventEmitter.emit('queue-updated', {
          count: this.loadedCount,
          total: this.totalCount,
          isProgressiveBatch: true,
        });
      }
    } catch (error) {
      console.error(
        '❌ ProgressiveQueueLoader: Error loading batch:',
        error.message,
      );
    } finally {
      this.isLoading = false;

      // Check if more songs need to be loaded immediately
      // (in case user skipped ahead quickly)
      if (this.loadedCount < this.totalCount) {
        const currentIndex = await TrackPlayer.getActiveTrackIndex();
        if (currentIndex !== null) {
          const remainingLoaded = this.loadedCount - currentIndex - 1;
          if (remainingLoaded <= LOAD_THRESHOLD) {
            // Schedule another batch load
            setImmediate(() => this._loadNextBatch());
          }
        }
      }
    }
  }

  /**
   * Force load remaining songs (e.g., for queue view)
   */
  async loadAllRemaining() {
    if (!this.isActive || this.loadedCount >= this.totalCount) {
      return;
    }
    while (this.loadedCount < this.totalCount && this.isActive) {
      await this._loadNextBatch();
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get current loading status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      loadedCount: this.loadedCount,
      totalCount: this.totalCount,
      isLoading: this.isLoading,
      progress: this.totalCount > 0 ? this.loadedCount / this.totalCount : 0,
    };
  }

  /**
   * Cleanup and reset state
   */
  cleanup() {
    if (this.trackChangeListener) {
      this.trackChangeListener.remove();
      this.trackChangeListener = null;
    }

    this.sourceSongs = [];
    this.loadedCount = 0;
    this.totalCount = 0;
    this.isLoading = false;
    this.isActive = false;
    this.processSingleSong = null;
  }
}

// Export singleton instance
export default new ProgressiveQueueLoader();
