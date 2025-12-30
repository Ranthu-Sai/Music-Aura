import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { GetDownloadPath } from '../LocalStorage/AppSettings';

/**
 * StorageManager - Manages downloaded songs metadata and file operations
 *
 * This utility handles:
 * - Storing/retrieving downloaded song metadata
 * - File existence checking
 * - Path management for songs and artwork
 * - Cleanup of orphaned metadata
 */
export class StorageManager {
  static METADATA_KEY = 'downloadedSongsMetadata';

  /**
   * Get all downloaded songs metadata
   * @returns {Promise<Object>} Object with songId as keys and metadata as values
   */
  static async getAllDownloadedSongsMetadata() {
    try {
      const data = await AsyncStorage.getItem(this.METADATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('StorageManager: Error getting downloaded songs metadata:', error);
      return {};
    }
  }

  /**
   * Save metadata for a downloaded song
   * @param {string} songId - Unique song identifier
   * @param {Object} metadata - Song metadata
   */
  static async saveDownloadedSongMetadata(songId, metadata) {
    try {
      const allMetadata = await this.getAllDownloadedSongsMetadata();
      allMetadata[songId] = {
        ...metadata,
        downloadTime: metadata.downloadTime || Date.now(),
        lastAccessed: Date.now()
      };

      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(allMetadata));
      console.log(`StorageManager: Saved metadata for song ${songId}`);
    } catch (error) {
      console.error(`StorageManager: Error saving metadata for song ${songId}:`, error);
      throw error;
    }
  }

  /**
   * Remove metadata for a downloaded song
   * @param {string} songId - Unique song identifier
   */
  static async removeDownloadedSongMetadata(songId) {
    try {
      const allMetadata = await this.getAllDownloadedSongsMetadata();
      const metadata = allMetadata[songId];
      const { GetDownloadPath } = require('../LocalStorage/AppSettings');

      // Also try to remove the actual files
      try {
        const downloadPath = await GetDownloadPath();
        const dirs = ReactNativeBlobUtil.fs.dirs;
        const baseDir = (downloadPath === "Downloads") ? dirs.LegacyDownloadDir : dirs.LegacyMusicDir;
        
        if (metadata && metadata.fileName) {
          const fileName = metadata.fileName;
          const songPath = `${baseDir}/Music Aura/${fileName}`;
          const decodedPath = decodeURI(songPath);
          
          console.log(`StorageManager: Attempting to delete: ${songPath}`);

          if (await ReactNativeBlobUtil.fs.exists(songPath)) {
            await ReactNativeBlobUtil.fs.unlink(songPath);
          } else if (await ReactNativeBlobUtil.fs.exists(decodedPath)) {
            await ReactNativeBlobUtil.fs.unlink(decodedPath);
          }

          // Force scan to update MediaStore
          ReactNativeBlobUtil.fs.scanFile([{ path: songPath }]);
          ReactNativeBlobUtil.fs.scanFile([{ path: decodedPath }]);

          // Cleanup artwork
          const artworkPath = songPath.replace(/\.[^/.]+$/, '.jpg');
          const decodedArtworkPath = decodeURI(artworkPath);
          if (await ReactNativeBlobUtil.fs.exists(artworkPath)) {
            await ReactNativeBlobUtil.fs.unlink(artworkPath);
          } else if (await ReactNativeBlobUtil.fs.exists(decodedArtworkPath)) {
            await ReactNativeBlobUtil.fs.unlink(decodedArtworkPath);
          }
        }
      } catch (fileError) {
        console.warn(`StorageManager: Could not remove files for song ${songId}:`, fileError);
      }

      delete allMetadata[songId];
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(allMetadata));
      console.log(`StorageManager: Removed metadata for song ${songId}`);
    } catch (error) {
      console.error(`StorageManager: Error removing metadata for song ${songId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a song is downloaded
   * @param {string} songId - Unique song identifier
   * @returns {Promise<boolean>} True if song exists
   */
  static async isSongDownloaded(songId) {
    try {
      const songPath = await this.getSongPath(songId);
      if (!songPath) return false;

      const exists = await ReactNativeBlobUtil.fs.exists(songPath);
      return exists;
    } catch (error) {
      console.error(`StorageManager: Error checking if song ${songId} is downloaded:`, error);
      return false;
    }
  }

  /**
   * Get the file path for a downloaded song
   * @param {string} songId - Unique song identifier
   * @returns {Promise<string|null>} File path or null if not found
   */
  static async getSongPath(songId) {
    try {
      const metadata = await this.getDownloadedSongMetadata(songId);
      if (!metadata) return null;

      // If we have a specific filePath saved in metadata, use it first
      if (metadata.filePath) {
        if (await ReactNativeBlobUtil.fs.exists(metadata.filePath)) {
          return metadata.filePath;
        }
      }

      if (!metadata.fileName) return null;

      const downloadPathPreference = await GetDownloadPath();
      const dirs = ReactNativeBlobUtil.fs.dirs;
      
      // Robust base directory selection - Prefer Legacy paths as they are usually public /storage/emulated/0
      let baseDir;
      if (downloadPathPreference === "Downloads") {
          baseDir = dirs.LegacyDownloadDir || dirs.DownloadDir || '/storage/emulated/0/Download';
      } else {
          baseDir = dirs.LegacyMusicDir || dirs.MusicDir || '/storage/emulated/0/Music';
      }

      // Ensure baseDir is not empty and is a public path (matching DownloadHelper.js logic)
      if (!baseDir || baseDir.includes('data/user') || baseDir.includes('com.music_aura')) {
          baseDir = '/storage/emulated/0/' + (downloadPathPreference === "Downloads" ? "Download" : "Music");
      }

      const songPath = `${baseDir}/Music Aura/${metadata.fileName}`;
      
      // Check both original and encoded/decoded versions
      if (await ReactNativeBlobUtil.fs.exists(songPath)) return songPath;
      
      const decodedPath = decodeURI(songPath);
      if (await ReactNativeBlobUtil.fs.exists(decodedPath)) return decodedPath;

      return songPath; // Fallback to constructed path
    } catch (error) {
      console.error(`StorageManager: Error getting song path for ${songId}:`, error);
      return null;
    }
  }

  /**
   * Get the artwork path for a downloaded song
   * @param {string} songId - Unique song identifier
   * @returns {Promise<string|null>} Artwork path or null if not found
   */
  static async getArtworkPath(songId) {
    try {
      const songPath = await this.getSongPath(songId);
      if (!songPath) return null;

      // Assume artwork has same name as song but with .jpg extension
      const artworkPath = songPath.replace(/\.[^/.]+$/, '.jpg');
      const exists = await ReactNativeBlobUtil.fs.exists(artworkPath);

      return exists ? artworkPath : null;
    } catch (error) {
      console.error(`StorageManager: Error getting artwork path for ${songId}:`, error);
      return null;
    }
  }

  /**
   * Get metadata for a specific downloaded song
   * @param {string} songId - Unique song identifier
   * @returns {Promise<Object|null>} Song metadata or null
   */
  static async getDownloadedSongMetadata(songId) {
    try {
      const allMetadata = await this.getAllDownloadedSongsMetadata();
      return allMetadata[songId] || null;
    } catch (error) {
      console.error(`StorageManager: Error getting metadata for song ${songId}:`, error);
      return null;
    }
  }

  /**
   * Clean up orphaned metadata (metadata for songs that no longer exist)
   * @returns {Promise<number>} Number of orphaned entries removed
   */
  static async cleanupOrphanedMetadata() {
    try {
      const allMetadata = await this.getAllDownloadedSongsMetadata();
      const songIds = Object.keys(allMetadata);
      let removedCount = 0;

      for (const songId of songIds) {
        const exists = await this.isSongDownloaded(songId);
        if (!exists) {
          delete allMetadata[songId];
          removedCount++;
          console.log(`StorageManager: Removed orphaned metadata for song ${songId}`);
        }
      }

      if (removedCount > 0) {
        await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(allMetadata));
      }

      console.log(`StorageManager: Cleaned up ${removedCount} orphaned metadata entries`);
      return removedCount;
    } catch (error) {
      console.error('StorageManager: Error cleaning up orphaned metadata:', error);
      return 0;
    }
  }

  /**
   * Update last accessed time for a song
   * @param {string} songId - Unique song identifier
   */
  static async updateLastAccessed(songId) {
    try {
      const metadata = await this.getDownloadedSongMetadata(songId);
      if (metadata) {
        metadata.lastAccessed = Date.now();
        await this.saveDownloadedSongMetadata(songId, metadata);
      }
    } catch (error) {
      console.error(`StorageManager: Error updating last accessed for ${songId}:`, error);
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  static async getStorageStats() {
    try {
      const allMetadata = await this.getAllDownloadedSongsMetadata();
      const songIds = Object.keys(allMetadata);

      let totalSize = 0;
      let validSongs = 0;

      for (const songId of songIds) {
        const exists = await this.isSongDownloaded(songId);
        if (exists) {
          const metadata = allMetadata[songId];
          totalSize += metadata.fileSize || 0;
          validSongs++;
        }
      }

      return {
        totalSongs: songIds.length,
        validSongs,
        orphanedSongs: songIds.length - validSongs,
        totalSize
      };
    } catch (error) {
      console.error('StorageManager: Error getting storage stats:', error);
      return {
        totalSongs: 0,
        validSongs: 0,
        orphanedSongs: 0,
        totalSize: 0
      };
    }
  }
}