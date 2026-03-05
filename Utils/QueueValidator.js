/**
 * QueueValidator.js
 *
 * Advanced queue validation and sanitization utility for Music-Aura
 * Handles queue corruption, expired URLs, invalid data, and size limits
 */

import TrackPlayer from 'react-native-track-player';

// Configuration
const MAX_QUEUE_SIZE = 500; // Prevent memory issues
const MAX_STORAGE_SIZE_MB = 5; // AsyncStorage limit
const URL_EXPIRY_TIME_MS = 6 * 60 * 60 * 1000; // 6 hours for YouTube URLs

class QueueValidator {
  constructor() {
    this.validationCache = new Map();
    this.lastValidationTime = 0;
  }

  /**
   * Validate a single track object
   * @param {Object} track - Track object to validate
   * @returns {Object} - {isValid: boolean, errors: string[], sanitized: Object}
   */
  validateTrack(track) {
    const errors = [];

    if (!track) {
      return {isValid: false, errors: ['Track is null or undefined'], sanitized: null};
    }

    // Required fields validation
    if (!track.id || typeof track.id !== 'string' || track.id.trim() === '') {
      errors.push('Missing or invalid track ID');
    }

    if (!track.title || typeof track.title !== 'string' || track.title.trim() === '') {
      errors.push('Missing or invalid title');
    }

    if (!track.url || typeof track.url !== 'string') {
      // Allow tracks that have downloadUrl array (URL can be resolved at playback time)
      const hasDownloadUrl = track.downloadUrl &&
        Array.isArray(track.downloadUrl) &&
        track.downloadUrl.length > 0;
      if (!hasDownloadUrl) {
        errors.push('Missing or invalid URL');
      }
    }

    // URL validation for YouTube Music
    if (track.url && this._isYouTubeUrl(track.url)) {
      // Check if URL might be expired (placeholder URLs are okay)
      if (!this._isPlaceholderUrl(track.url) && track._addedAt) {
        const age = Date.now() - track._addedAt;
        if (age > URL_EXPIRY_TIME_MS) {
          errors.push('YouTube URL likely expired');
        }
      }
    }

    // Create sanitized version
    const sanitized = {
      id: track.id?.toString() || '',
      title: track.title?.toString() || 'Unknown Track',
      artist: track.artist?.toString() || 'Unknown Artist',
      artwork: track.artwork || track.image || '',
      url: track.url || '',
      duration: typeof track.duration === 'number' ? track.duration : 0,
      language: track.language || 'unknown',
      downloadUrl: track.downloadUrl || track.url,
      image: track.image || track.artwork || '',
      source: track.source || 'unknown',
      isYTMusic: track.isYTMusic || this._isYouTubeId(track.id),
      _needsStream: track._needsStream || false,
      _addedAt: track._addedAt || Date.now(),
      _validated: Date.now(),
    };

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * Validate entire queue
   * @param {Array} queue - Array of track objects
   * @param {Object} options - Validation options
   * @returns {Object} - {isValid, validTracks, invalidTracks, errors, stats}
   */
  async validateQueue(queue, options = {}) {
    const {
      removeInvalid = false,
      removeDuplicates = true,
      enforceMaxSize = true,
    } = options;

    if (!Array.isArray(queue)) {
      return {
        isValid: false,
        validTracks: [],
        invalidTracks: [],
        errors: ['Queue is not an array'],
        stats: {total: 0, valid: 0, invalid: 0, duplicates: 0},
      };
    }

    const validTracks = [];
    const invalidTracks = [];
    const errors = [];
    const seenIds = new Set();
    const seenSignatures = new Set();

    for (let i = 0; i < queue.length; i++) {
      const track = queue[i];
      const validation = this.validateTrack(track);

      if (!validation.isValid) {
        invalidTracks.push({index: i, track, errors: validation.errors});
        errors.push(`Track ${i}: ${validation.errors.join(', ')}`);

        if (!removeInvalid && validation.sanitized) {
          // Try to use sanitized version even if invalid
          validTracks.push(validation.sanitized);
        }
        continue;
      }

      // Duplicate detection
      const trackId = validation.sanitized.id;
      const signature = this._createTrackSignature(validation.sanitized);

      if (removeDuplicates) {
        if (seenIds.has(trackId)) {
          invalidTracks.push({index: i, track, errors: ['Duplicate ID']});
          continue;
        }

        if (seenSignatures.has(signature)) {
          invalidTracks.push({index: i, track, errors: ['Duplicate track (title+artist)']});
          continue;
        }
      }

      seenIds.add(trackId);
      seenSignatures.add(signature);
      validTracks.push(validation.sanitized);
    }

    // Enforce max size
    let truncated = false;
    if (enforceMaxSize && validTracks.length > MAX_QUEUE_SIZE) {
      truncated = true;
      validTracks.splice(MAX_QUEUE_SIZE);
      errors.push(`Queue truncated from ${queue.length} to ${MAX_QUEUE_SIZE} tracks`);
    }

    const stats = {
      total: queue.length,
      valid: validTracks.length,
      invalid: invalidTracks.length,
      duplicates: seenIds.size < queue.length ? queue.length - seenIds.size : 0,
      truncated,
    };

    return {
      isValid: invalidTracks.length === 0 && !truncated,
      validTracks,
      invalidTracks,
      errors,
      stats,
    };
  }

  /**
   * Validate queue size for AsyncStorage
   * @param {Array} queue - Queue to check
   * @returns {Object} - {withinLimit, sizeInMB, estimatedSizeInMB}
   */
  checkStorageSize(queue) {
    try {
      const jsonString = JSON.stringify(queue);
      const sizeInBytes = new Blob([jsonString]).size;
      const sizeInMB = sizeInBytes / (1024 * 1024);

      return {
        withinLimit: sizeInMB < MAX_STORAGE_SIZE_MB,
        sizeInMB: sizeInMB.toFixed(2),
        maxSizeMB: MAX_STORAGE_SIZE_MB,
        truncationNeeded: sizeInMB >= MAX_STORAGE_SIZE_MB,
      };
    } catch (e) {
      return {
        withinLimit: false,
        sizeInMB: 'unknown',
        maxSizeMB: MAX_STORAGE_SIZE_MB,
        truncationNeeded: true,
        error: e.message,
      };
    }
  }

  /**
   * Compress queue for storage by removing unnecessary data
   * @param {Array} queue - Full queue
   * @returns {Array} - Compressed queue
   */
  compressQueueForStorage(queue) {
    if (!Array.isArray(queue)) {
      return [];
    }

    return queue.map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.url,
      artwork: track.artwork || track.image,
      duration: track.duration,
      language: track.language,
      downloadUrl: track.downloadUrl,
      source: track.source,
      isYTMusic: track.isYTMusic,
      _needsStream: track._needsStream,
      _addedAt: track._addedAt || Date.now(),
    }));
  }

  /**
   * Restore and validate queue from storage with retry logic
   * @param {Function} getStoredQueue - Function to retrieve stored queue
   * @param {Object} options - Restoration options
   * @returns {Object} - {success, queue, errors}
   */
  async restoreQueueWithValidation(getStoredQueue, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 500,
      fallbackToEmpty = true,
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Queue restore attempt ${attempt}/${maxRetries}`);

        const storedQueue = await getStoredQueue();

        if (!storedQueue || storedQueue.length === 0) {
          console.log('📭 No stored queue found');
          return {success: true, queue: [], errors: ['No stored queue']};
        }

        // Validate the stored queue
        const validation = await this.validateQueue(storedQueue, {
          removeInvalid: true,
          removeDuplicates: true,
          enforceMaxSize: true,
        });

        if (validation.validTracks.length === 0) {
          throw new Error('No valid tracks in stored queue');
        }

        console.log(`✅ Queue restored: ${validation.validTracks.length} valid tracks`);

        if (validation.invalidTracks.length > 0) {
          console.warn(`⚠️ Removed ${validation.invalidTracks.length} invalid tracks`);
        }

        return {
          success: true,
          queue: validation.validTracks,
          errors: validation.errors,
          stats: validation.stats,
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Queue restore attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed
    if (fallbackToEmpty) {
      console.log('📭 Falling back to empty queue after all retries failed');
      return {
        success: false,
        queue: [],
        errors: [`All restore attempts failed: ${lastError?.message}`],
      };
    }

    throw lastError;
  }

  /**
   * Monitor queue health and report issues
   * @returns {Object} - Health report
   */
  async monitorQueueHealth() {
    try {
      const queue = await TrackPlayer.getQueue();
      const activeTrack = await TrackPlayer.getActiveTrack();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      const validation = await this.validateQueue(queue, {
        removeInvalid: false,
        checkExpiredUrls: true,
      });

      const health = {
        timestamp: Date.now(),
        queueLength: queue.length,
        activeTrackIndex: activeIndex,
        activeTrackValid: activeTrack ? this.validateTrack(activeTrack).isValid : false,
        validTracksCount: validation.validTracks.length,
        invalidTracksCount: validation.invalidTracks.length,
        duplicatesCount: validation.stats.duplicates,
        issues: [],
        status: 'healthy',
      };

      // Check for issues
      if (queue.length === 0) {
        health.issues.push('Queue is empty');
        health.status = 'warning';
      }

      if (validation.invalidTracks.length > 0) {
        health.issues.push(`${validation.invalidTracks.length} invalid tracks detected`);
        health.status = 'warning';
      }

      if (validation.invalidTracks.length > queue.length * 0.2) {
        health.issues.push('More than 20% of queue is invalid');
        health.status = 'critical';
      }

      if (activeIndex !== null && activeIndex >= queue.length - 5) {
        health.issues.push('Near end of queue, may need refill');
        health.status = 'warning';
      }

      return health;
    } catch (error) {
      return {
        timestamp: Date.now(),
        status: 'error',
        issues: [`Health check failed: ${error.message}`],
        error: error.message,
      };
    }
  }

  // Helper methods

  _isYouTubeUrl(url) {
    return url && (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('music.youtube.com')
    );
  }

  _isPlaceholderUrl(url) {
    return url && (
      url.includes('music.youtube.com/watch?v=') ||
      url.startsWith('http') === false
    );
  }

  _isYouTubeId(id) {
    return id && typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
  }

  _createTrackSignature(track) {
    const title = track.title?.toLowerCase().trim() || '';
    const artist = track.artist?.toLowerCase().trim() || '';
    return `${title}|||${artist}`;
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    this.lastValidationTime = 0;
  }
}

// Export singleton instance
const queueValidator = new QueueValidator();
export default queueValidator;
