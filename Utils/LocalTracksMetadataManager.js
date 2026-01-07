import AsyncStorage from '@react-native-async-storage/async-storage';
import {InteractionManager} from 'react-native';
import {FileOperationErrorHandler} from './FileOperationErrorHandler';
import {localTracksMetadataProcessor} from './LocalTracksMetadataProcessor';

/**
 * LocalTracksMetadataManager - Persistent metadata management for local tracks
 *
 * This class handles:
 * - Caching track metadata to avoid repeated file reads
 * - Managing metadata persistence across app sessions
 * - Providing efficient metadata retrieval and updates
 * - Handling metadata corruption and recovery
 */

const METADATA_STORAGE_KEY = '@local_tracks_metadata';
const METADATA_VERSION_KEY = '@local_tracks_metadata_version';
const CURRENT_VERSION = '1.0.0';

export class LocalTracksMetadataManager {
  constructor() {
    this.metadataCache = new Map();
    this.isInitialized = false;
    this.initializationPromise = null;
    this.subscribers = new Set();
    this.processingQueue = [];
    this.isProcessing = false;
    this.BATCH_SIZE = 5;
    this.BATCH_DELAY = 1000;
  }

  /**
   * Ensure the manager is initialized before any operation
   */
  async ensureInitialized() {
    if (this.isInitialized) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    return this.initialize();
  }

  /**
   * Subscribe to metadata changes
   * @param {Function} callback - Function to call on updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of changes
   */
  notifySubscribers() {
    const allMetadata = Array.from(this.metadataCache.values());
    this.subscribers.forEach(callback => callback(allMetadata));
  }

  /**
   * Initialize the metadata manager
   * Loads cached metadata from storage
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        console.log('LocalTracksMetadataManager: Initializing...');
        const version = await AsyncStorage.getItem(METADATA_VERSION_KEY);
        console.log('LocalTracksMetadataManager: Stored version:', version);

        // Check if we need to migrate data
        if (version !== CURRENT_VERSION) {
          console.log(
            'LocalTracksMetadataManager: Version mismatch, migrating...',
          );
          try {
            await this.migrateMetadata(version);
          } catch (migrateError) {
            console.warn(
              'LocalTracksMetadataManager: Migration failed, will continue with empty cache:',
              migrateError,
            );
          }
        }

        const cachedMetadata = await AsyncStorage.getItem(METADATA_STORAGE_KEY);
        console.log(
          'LocalTracksMetadataManager: Cached metadata exists:',
          !!cachedMetadata,
        );

        if (cachedMetadata) {
          try {
            const metadata = JSON.parse(cachedMetadata);
            this.metadataCache = new Map(Object.entries(metadata));
            console.log(
              'LocalTracksMetadataManager: Loaded',
              this.metadataCache.size,
              'cached tracks',
            );
          } catch (parseError) {
            console.error(
              'LocalTracksMetadataManager: Corrupted metadata detected:',
              parseError,
            );
            // Silent failure for parse error - just start fresh
            this.metadataCache = new Map();
            await AsyncStorage.removeItem(METADATA_STORAGE_KEY);
          }
        }

        this.isInitialized = true;
        console.log('LocalTracksMetadataManager: Initialization complete');
      } catch (error) {
        console.warn(
          'LocalTracksMetadataManager: Initialization error:',
          error,
        );
        // Categorize error but don't throw if we can still function with empty cache
        FileOperationErrorHandler.handleError(error, 'metadata_load', {
          showToast: false,
        });
        this.metadataCache = new Map();
        this.isInitialized = true;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Migrate metadata from old versions
   */
  async migrateMetadata(oldVersion) {
    try {
      console.log(
        `LocalTracksMetadataManager: Migrating metadata from ${oldVersion} to ${CURRENT_VERSION}`,
      );

      if (oldVersion) {
        // If we have an old version, clear old data as format might have changed
        await AsyncStorage.removeItem(METADATA_STORAGE_KEY);
      }

      // Always set the current version after migration check
      await AsyncStorage.setItem(METADATA_VERSION_KEY, CURRENT_VERSION);
    } catch (error) {
      console.error('LocalTracksMetadataManager: Migration failed:', error);
      FileOperationErrorHandler.handleError(error, 'metadata_migration', {
        showToast: false,
      });
    }
  }

  /**
   * Get metadata for a track
   * @param {string} trackId - Unique track identifier
   * @returns {Promise<Object|null>} Track metadata or null if not found
   */
  async getMetadata(trackId) {
    await this.ensureInitialized();

    try {
      const metadata = this.metadataCache.get(trackId);

      if (metadata) {
        // Update last accessed timestamp
        metadata.lastAccessed = Date.now();
        await this.saveMetadata(trackId, metadata);
      }

      return metadata || null;
    } catch (error) {
      console.error(
        `LocalTracksMetadataManager: Failed to get metadata for ${trackId}:`,
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_get', {
        showToast: false,
      });
      return null;
    }
  }

  /**
   * Get metadata for a track synchronously from memory cache
   * @param {string} trackId - Unique track identifier
   * @returns {Object|null} The cached metadata or null
   */
  getMetadataSync(trackId) {
    if (!this.isInitialized) {
      return null;
    }
    return this.metadataCache.get(trackId) || null;
  }

  /**
   * Set metadata for a track
   * @param {string} trackId - Unique track identifier
   * @param {Object} metadata - Track metadata
   */
  async setMetadata(trackId, metadata) {
    await this.ensureInitialized();

    try {
      const enrichedMetadata = {
        ...metadata,
        lastModified: Date.now(),
        lastAccessed: Date.now(),
        version: CURRENT_VERSION,
      };

      this.metadataCache.set(trackId, enrichedMetadata);
      await this.saveMetadata(trackId, enrichedMetadata);
      this.notifySubscribers();
    } catch (error) {
      console.error(
        `LocalTracksMetadataManager: Failed to set metadata for ${trackId}:`,
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_set', {
        showToast: false,
      });
      throw error;
    }
  }

  /**
   * Update specific fields of track metadata
   * @param {string} trackId - Unique track identifier
   * @param {Object} updates - Fields to update
   */
  async updateMetadata(trackId, updates) {
    await this.ensureInitialized();

    try {
      const existingMetadata = this.metadataCache.get(trackId) || {};
      const updatedMetadata = {
        ...existingMetadata,
        ...updates,
        lastModified: Date.now(),
        lastAccessed: Date.now(),
        version: CURRENT_VERSION,
      };

      this.metadataCache.set(trackId, updatedMetadata);
      await this.saveMetadata(trackId, updatedMetadata);
    } catch (error) {
      console.error(
        `LocalTracksMetadataManager: Failed to update metadata for ${trackId}:`,
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_update', {
        showToast: false,
      });
      throw error;
    }
  }

  /**
   * Remove metadata for a track
   * @param {string} trackId - Unique track identifier
   */
  async removeMetadata(trackId) {
    await this.ensureInitialized();

    try {
      this.metadataCache.delete(trackId);
      await this.persistAllMetadata();
    } catch (error) {
      console.error(
        `LocalTracksMetadataManager: Failed to remove metadata for ${trackId}:`,
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_remove', {
        showToast: false,
      });
      throw error;
    }
  }

  /**
   * Check if metadata exists for a track
   * @param {string} trackId - Unique track identifier
   * @returns {Promise<boolean>} True if metadata exists
   */
  async hasMetadata(trackId) {
    await this.ensureInitialized();
    return this.metadataCache.has(trackId);
  }

  /**
   * Get all track IDs with metadata
   * @returns {Promise<string[]>} Array of track IDs
   */
  async getAllTrackIds() {
    await this.ensureInitialized();
    return Array.from(this.metadataCache.keys());
  }

  /**
   * Get metadata for multiple tracks
   * @param {string[]} trackIds - Array of track IDs
   * @returns {Promise<Object>} Object with trackId as key and metadata as value
   */
  async getBulkMetadata(trackIds) {
    await this.ensureInitialized();

    try {
      const result = {};

      for (const trackId of trackIds) {
        const metadata = await this.getMetadata(trackId);
        if (metadata) {
          result[trackId] = metadata;
        }
      }

      return result;
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to get bulk metadata:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_bulk_get', {
        showToast: false,
      });
      return {};
    }
  }

  /**
   * Get all tracks metadata as an array
   * @returns {Promise<Object[]>} Array of all track metadata
   */
  async getAllMetadata() {
    await this.ensureInitialized();
    return Array.from(this.metadataCache.values());
  }

  /**
   * Sync scanned tracks with manifest and start background processing
   * Matches Orbit's robust sync logic
   * @param {Array} scannedTracks - Tracks found during file scan
   */
  async sync(scannedTracks) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(
      'LocalTracksMetadataManager: Syncing',
      scannedTracks.length,
      'tracks',
    );
    const currentTrackIds = new Set(scannedTracks.map(t => t.id));

    // Remove entries for deleted files
    let hasChanges = false;
    for (const [trackId] of this.metadataCache) {
      if (!currentTrackIds.has(trackId)) {
        this.metadataCache.delete(trackId);
        hasChanges = true;
      }
    }

    // Queue tracks that need processing (never processed or force reload)
    for (const track of scannedTracks) {
      const existing = this.metadataCache.get(track.id);
      if (!existing || !existing.isProcessed) {
        this.addToQueue(track);
      }
    }

    if (hasChanges) {
      await this.persistAllMetadata();
    }

    // Always notify subscribers after sync to ensure they have the latest cached/basic tracks
    this.notifySubscribers();

    // Start background processing
    this.startBackgroundProcessing();
  }

  /**
   * Add track to background processing queue
   */
  addToQueue(track) {
    if (!this.processingQueue.find(t => t.id === track.id)) {
      this.processingQueue.push(track);
    }
  }

  /**
   * Start background processing using InteractionManager
   */
  startBackgroundProcessing() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      this.processQueueInBatches();
    });
  }

  /**
   * Process queue in small batches with delays to keep UI smooth
   */
  async processQueueInBatches() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(
      'LocalTracksMetadataManager: Background processing started for',
      this.processingQueue.length,
      'tracks',
    );

    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, this.BATCH_SIZE);

      for (const track of batch) {
        try {
          const enriched = await localTracksMetadataProcessor.extractMetadata(
            track.filePath,
          );
          if (enriched) {
            // Extract usable artwork URI
            const artworkInfo =
              await localTracksMetadataProcessor.extractArtwork(
                track.filePath,
                enriched,
              );

            const updatedMetadata = {
              ...track,
              ...enriched,
              artwork: artworkInfo ? artworkInfo.uri : null,
              isProcessed: true,
              lastModified: Date.now(),
            };
            this.metadataCache.set(track.id, updatedMetadata);
          } else {
            // Mark as processed even if failed to avoid re-processing
            this.metadataCache.set(track.id, {...track, isProcessed: true});
          }
        } catch (error) {
          console.warn(
            `LocalTracksMetadataManager: Failed to process ${track.id}:`,
            error,
          );
        }
      }

      await this.persistAllMetadata();
      this.notifySubscribers();

      if (this.processingQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }

    this.isProcessing = false;
    console.log('LocalTracksMetadataManager: Background processing complete');
  }

  /**
   * Clear all cached metadata
   */
  async clearAllMetadata() {
    try {
      this.metadataCache.clear();
      await AsyncStorage.multiRemove([
        METADATA_STORAGE_KEY,
        METADATA_VERSION_KEY,
      ]);
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to clear metadata:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_clear', {
        showToast: false,
      });
      throw error;
    }
  }

  /**
   * Get metadata statistics
   * @returns {Promise<Object>} Statistics about cached metadata
   */
  async getMetadataStats() {
    await this.ensureInitialized();

    const tracks = Array.from(this.metadataCache.values());
    const now = Date.now();

    return {
      totalTracks: tracks.length,
      totalSize: JSON.stringify(Object.fromEntries(this.metadataCache)).length,
      averageAge:
        tracks.length > 0
          ? tracks.reduce((sum, track) => sum + (now - track.lastModified), 0) /
            tracks.length
          : 0,
      oldestTrack:
        tracks.length > 0
          ? Math.min(...tracks.map(track => track.lastModified))
          : null,
      newestTrack:
        tracks.length > 0
          ? Math.max(...tracks.map(track => track.lastModified))
          : null,
    };
  }

  /**
   * Clean up old or invalid metadata
   * @param {number} maxAge - Maximum age in milliseconds (default: 30 days)
   */
  async cleanupMetadata(maxAge = 30 * 24 * 60 * 60 * 1000) {
    await this.ensureInitialized();

    try {
      const now = Date.now();
      const toRemove = [];

      for (const [trackId, metadata] of this.metadataCache) {
        if (now - metadata.lastAccessed > maxAge) {
          toRemove.push(trackId);
        }
      }

      for (const trackId of toRemove) {
        this.metadataCache.delete(trackId);
      }

      if (toRemove.length > 0) {
        await this.persistAllMetadata();
        console.log(
          `LocalTracksMetadataManager: Cleaned up ${toRemove.length} old metadata entries`,
        );
      }
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to cleanup metadata:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_cleanup', {
        showToast: false,
      });
    }
  }

  /**
   * Save metadata to persistent storage
   */
  async saveMetadata(trackId, metadata) {
    try {
      // Debounce saves to avoid excessive storage writes
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }

      this.saveTimeout = setTimeout(async () => {
        await this.persistAllMetadata();
      }, 1000); // Save after 1 second of inactivity
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to schedule metadata save:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_save', {
        showToast: false,
      });
    }
  }

  /**
   * Persist all metadata to storage
   */
  async persistAllMetadata() {
    try {
      const metadataObject = Object.fromEntries(this.metadataCache);
      await AsyncStorage.setItem(
        METADATA_STORAGE_KEY,
        JSON.stringify(metadataObject),
      );
      await AsyncStorage.setItem(METADATA_VERSION_KEY, CURRENT_VERSION);
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to persist metadata:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_persist', {
        showToast: false,
      });
      throw error;
    }
  }

  /**
   * Export metadata for backup
   * @returns {Promise<string>} JSON string of all metadata
   */
  async exportMetadata() {
    await this.ensureInitialized();

    try {
      const metadataObject = Object.fromEntries(this.metadataCache);
      return JSON.stringify(
        {
          version: CURRENT_VERSION,
          exportDate: new Date().toISOString(),
          metadata: metadataObject,
        },
        null,
        2,
      );
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to export metadata:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_export', {
        showToast: false,
      });
      throw error;
    }
  }

  /**
   * Import metadata from backup
   * @param {string} jsonData - JSON string of metadata
   */
  async importMetadata(jsonData) {
    try {
      const importData = JSON.parse(jsonData);

      if (importData.version !== CURRENT_VERSION) {
        throw new Error(`Incompatible metadata version: ${importData.version}`);
      }

      this.metadataCache = new Map(Object.entries(importData.metadata));
      await this.persistAllMetadata();

      console.log(
        `LocalTracksMetadataManager: Imported ${this.metadataCache.size} metadata entries`,
      );
    } catch (error) {
      console.error(
        'LocalTracksMetadataManager: Failed to import metadata:',
        error,
      );
      FileOperationErrorHandler.handleError(error, 'metadata_import', {
        showToast: false,
      });
      throw error;
    }
  }
}

// Singleton instance
export const localTracksMetadataManager = new LocalTracksMetadataManager();
