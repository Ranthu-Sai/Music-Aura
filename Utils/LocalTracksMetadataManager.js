import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileOperationErrorHandler } from './FileOperationErrorHandler';

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
    this.errorHandler = new FileOperationErrorHandler();
  }

  /**
   * Initialize the metadata manager
   * Loads cached metadata from storage
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('LocalTracksMetadataManager: Initializing...');
      const version = await AsyncStorage.getItem(METADATA_VERSION_KEY);
      console.log('LocalTracksMetadataManager: Stored version:', version);

      // Check if we need to migrate data
      if (version !== CURRENT_VERSION) {
        console.log('LocalTracksMetadataManager: Version mismatch, migrating...');
        await this.migrateMetadata(version);
      }

      const cachedMetadata = await AsyncStorage.getItem(METADATA_STORAGE_KEY);
      console.log('LocalTracksMetadataManager: Cached metadata exists:', !!cachedMetadata);
      
      if (cachedMetadata) {
        const metadata = JSON.parse(cachedMetadata);
        this.metadataCache = new Map(Object.entries(metadata));
        console.log('LocalTracksMetadataManager: Loaded', this.metadataCache.size, 'cached tracks');
      }

      this.isInitialized = true;
      console.log('LocalTracksMetadataManager: Initialization complete');
    } catch (error) {
      console.warn('LocalTracksMetadataManager: Failed to load cached metadata:', error);
      this.errorHandler.handleError(error, 'metadata_load');
      this.metadataCache = new Map();
      this.isInitialized = true;
    }
  }

  /**
   * Migrate metadata from old versions
   */
  async migrateMetadata(oldVersion) {
    try {
      if (!oldVersion) {
        // No version means fresh install, no migration needed
        return;
      }

      // Future migration logic can be added here
      console.log(`LocalTracksMetadataManager: Migrating metadata from ${oldVersion} to ${CURRENT_VERSION}`);
      
      // For now, just clear old data if versions don't match
      await AsyncStorage.removeItem(METADATA_STORAGE_KEY);
      await AsyncStorage.setItem(METADATA_VERSION_KEY, CURRENT_VERSION);
    } catch (error) {
      console.error('LocalTracksMetadataManager: Migration failed:', error);
      this.errorHandler.handleError(error, 'metadata_migration');
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
      console.error(`LocalTracksMetadataManager: Failed to get metadata for ${trackId}:`, error);
      this.errorHandler.handleError(error, 'metadata_get');
      return null;
    }
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
        version: CURRENT_VERSION
      };

      this.metadataCache.set(trackId, enrichedMetadata);
      await this.saveMetadata(trackId, enrichedMetadata);
    } catch (error) {
      console.error(`LocalTracksMetadataManager: Failed to set metadata for ${trackId}:`, error);
      this.errorHandler.handleError(error, 'metadata_set');
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
        version: CURRENT_VERSION
      };

      this.metadataCache.set(trackId, updatedMetadata);
      await this.saveMetadata(trackId, updatedMetadata);
    } catch (error) {
      console.error(`LocalTracksMetadataManager: Failed to update metadata for ${trackId}:`, error);
      this.errorHandler.handleError(error, 'metadata_update');
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
      console.error(`LocalTracksMetadataManager: Failed to remove metadata for ${trackId}:`, error);
      this.errorHandler.handleError(error, 'metadata_remove');
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
      console.error('LocalTracksMetadataManager: Failed to get bulk metadata:', error);
      this.errorHandler.handleError(error, 'metadata_bulk_get');
      return {};
    }
  }

  /**
   * Clear all cached metadata
   */
  async clearAllMetadata() {
    try {
      this.metadataCache.clear();
      await AsyncStorage.multiRemove([METADATA_STORAGE_KEY, METADATA_VERSION_KEY]);
    } catch (error) {
      console.error('LocalTracksMetadataManager: Failed to clear metadata:', error);
      this.errorHandler.handleError(error, 'metadata_clear');
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
      averageAge: tracks.length > 0 
        ? tracks.reduce((sum, track) => sum + (now - track.lastModified), 0) / tracks.length 
        : 0,
      oldestTrack: tracks.length > 0 
        ? Math.min(...tracks.map(track => track.lastModified)) 
        : null,
      newestTrack: tracks.length > 0 
        ? Math.max(...tracks.map(track => track.lastModified)) 
        : null
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
        console.log(`LocalTracksMetadataManager: Cleaned up ${toRemove.length} old metadata entries`);
      }
    } catch (error) {
      console.error('LocalTracksMetadataManager: Failed to cleanup metadata:', error);
      this.errorHandler.handleError(error, 'metadata_cleanup');
    }
  }

  /**
   * Ensure the manager is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
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
      console.error('LocalTracksMetadataManager: Failed to schedule metadata save:', error);
      this.errorHandler.handleError(error, 'metadata_save');
    }
  }

  /**
   * Persist all metadata to storage
   */
  async persistAllMetadata() {
    try {
      const metadataObject = Object.fromEntries(this.metadataCache);
      await AsyncStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(metadataObject));
      await AsyncStorage.setItem(METADATA_VERSION_KEY, CURRENT_VERSION);
    } catch (error) {
      console.error('LocalTracksMetadataManager: Failed to persist metadata:', error);
      this.errorHandler.handleError(error, 'metadata_persist');
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
      return JSON.stringify({
        version: CURRENT_VERSION,
        exportDate: new Date().toISOString(),
        metadata: metadataObject
      }, null, 2);
    } catch (error) {
      console.error('LocalTracksMetadataManager: Failed to export metadata:', error);
      this.errorHandler.handleError(error, 'metadata_export');
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
      
      console.log(`LocalTracksMetadataManager: Imported ${this.metadataCache.size} metadata entries`);
    } catch (error) {
      console.error('LocalTracksMetadataManager: Failed to import metadata:', error);
      this.errorHandler.handleError(error, 'metadata_import');
      throw error;
    }
  }
}

// Singleton instance
export const localTracksMetadataManager = new LocalTracksMetadataManager();