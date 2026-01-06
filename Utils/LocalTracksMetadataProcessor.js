import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { FileOperationErrorHandler } from './FileOperationErrorHandler';
import { localTracksMetadataManager } from './LocalTracksMetadataManager';
import AudioMetadataParser from './ID3Parser';

/**
 * LocalTracksMetadataProcessor - Processes and extracts metadata from local audio files
 *
 * This class handles:
 * - Reading audio file metadata (ID3 tags, etc.)
 * - Extracting track information (title, artist, album, etc.)
 * - Processing album artwork
 * - Handling various audio formats
 * - Caching processed metadata
 */

export class LocalTracksMetadataProcessor {
  constructor() {
    this.supportedFormats = [
      '.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.webm', '.wma',
    ];
  }

  /**
   * Process a single audio file and extract metadata
   * @param {string} filePath - Path to the audio file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed track metadata
   */
  async processFile(filePath, options = {}) {
    console.log('LocalTracksMetadataProcessor: Processing file:', filePath);
    try {
      // Validate file path and format
      if (!await this.validateFile(filePath)) {
        console.log('LocalTracksMetadataProcessor: File validation failed for:', filePath);
        throw new Error(`Invalid or unsupported file: ${filePath}`);
      }

      // Check cache first
      const cacheKey = this.generateTrackId(filePath);
      console.log('LocalTracksMetadataProcessor: Cache key for', filePath, 'is', cacheKey);

      // Ensure metadata manager is initialized
      if (!localTracksMetadataManager.isInitialized) {
        await localTracksMetadataManager.initialize();
      }

      let metadata = await localTracksMetadataManager.getMetadata(cacheKey);
      console.log('LocalTracksMetadataProcessor: Cached metadata found:', !!metadata);

      if (metadata && !options.forceRefresh) {
        console.log('LocalTracksMetadataProcessor: Using cached metadata for:', filePath);
        // Check if file has been modified since last processing
        const fileStats = await RNFS.stat(filePath);
        if (metadata.fileModified === fileStats.mtime) {
          return metadata;
        }
      }

      console.log('LocalTracksMetadataProcessor: Extracting fresh metadata for:', filePath);
      // Extract metadata
      metadata = await this.extractMetadata(filePath, options);

      // Add file system information
      const fileStats = await RNFS.stat(filePath);
      metadata.filePath = filePath;
      metadata.fileSize = fileStats.size;
      metadata.fileModified = fileStats.mtime;
      metadata.dateAdded = Date.now();

      // Process artwork if available
      if (options.extractArtwork !== false) {
        metadata.artwork = await this.extractArtwork(filePath, metadata);
      }

      // Cache the metadata
      await localTracksMetadataManager.setMetadata(cacheKey, metadata);
      console.log('LocalTracksMetadataProcessor: Successfully processed:', filePath);

      return metadata;
    } catch (error) {
      console.error(`LocalTracksMetadataProcessor: Failed to process ${filePath}:`, error);
      FileOperationErrorHandler.handleError(error, 'metadata_processing', { showToast: false });
      throw error;
    }
  }

  /**
   * Process multiple files in batch
   * @param {string[]} filePaths - Array of file paths
   * @param {Object} options - Processing options
   * @returns {Promise<Object[]>} Array of processed metadata
   */
  async processFiles(filePaths, options = {}) {
    const results = [];
    const errors = [];

    for (const filePath of filePaths) {
      try {
        const metadata = await this.processFile(filePath, options);
        results.push(metadata);
      } catch (error) {
        errors.push({ filePath, error: error.message });
        console.warn(`LocalTracksMetadataProcessor: Skipping ${filePath}:`, error.message);
      }
    }

    return {
      results,
      errors,
      successCount: results.length,
      errorCount: errors.length,
    };
  }

  /**
   * Extract metadata from audio file
   * @param {string} filePath - Path to the audio file
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(filePath, options = {}) {
    try {
      const fileName = this.getFileName(filePath);
      const fileExtension = this.getFileExtension(filePath);

      // Try to extract real metadata first
      let result = null;
      try {
        console.log(`LocalTracksMetadataProcessor: Extracting metadata for ${filePath}`);
        result = await AudioMetadataParser.extractMetadata(filePath);
      } catch (e) {
        console.warn('LocalTracksMetadataProcessor: AudioMetadataParser failed', e);
      }

      if (result && result.metadata && (result.metadata.title || result.metadata.artist)) {
        console.log(`LocalTracksMetadataProcessor: Found metadata for ${fileName}:`, result.metadata.title);
        return {
          id: this.generateTrackId(filePath),
          title: result.metadata.title || fileName.replace(/\.[^/.]+$/, ''),
          artist: result.metadata.artist || 'Unknown Artist',
          album: result.metadata.album || 'Unknown Album',
          duration: 0,
          genre: result.metadata.genre || 'Unknown',
          year: result.metadata.year || null,
          fileExtension,
          fileType: this.getFileType(fileExtension),
          embeddedArtwork: result.artwork,
        };
      }

      // Fallback to parsing filename
      const parsedInfo = this.parseFileName(fileName);

      return {
        id: this.generateTrackId(filePath),
        title: parsedInfo.title || fileName.replace(/\.[^/.]+$/, ''),
        artist: parsedInfo.artist || 'Unknown Artist',
        album: parsedInfo.album || 'Unknown Album',
        duration: 0,
        genre: 'Unknown',
        year: null,
        fileExtension,
        fileType: this.getFileType(fileExtension),
      };
    } catch (error) {
      console.error(`LocalTracksMetadataProcessor: Failed to extract metadata from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract artwork from audio file
   * @param {string} filePath - Path to the audio file
   * @param {Object} metadata - Track metadata
   * @returns {Promise<Object|null>} Artwork information
   */
  async extractArtwork(filePath, metadata) {
    try {
      // If we already have embedded artwork from extractMetadata step
      if (metadata.embeddedArtwork && metadata.embeddedArtwork.base64) {
        return {
          uri: `data:${metadata.embeddedArtwork.mimeType || 'image/jpeg'};base64,${metadata.embeddedArtwork.base64}`,
          type: 'embedded',
          source: 'embedded',
        };
      }

      // Check for external artwork file
      const artworkPath = this.findArtworkFile(filePath);
      if (artworkPath && await RNFS.exists(artworkPath)) {
        return {
          uri: `file://${artworkPath}`,
          type: 'external',
          source: 'file',
        };
      }

      return null;
    } catch (error) {
      console.warn(`LocalTracksMetadataProcessor: Could not extract artwork from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract additional metadata using native capabilities
   * @param {string} filePath - Path to the audio file
   * @returns {Promise<Object>} Additional metadata
   */
  async extractAdditionalMetadata(filePath) {
    // This would use a native module or TrackPlayer's metadata extraction
    // For now, return empty object
    return {};
  }

  /**
   * Validate if file exists and is supported
   * @param {string} filePath - Path to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateFile(filePath) {
    try {
      // Check if file exists
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return false;
      }

      // Check if it's a supported format
      const extension = this.getFileExtension(filePath).toLowerCase();
      return this.supportedFormats.includes(extension);
    } catch (error) {
      console.error(`LocalTracksMetadataProcessor: File validation failed for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Parse filename to extract basic track information
   * @param {string} fileName - Filename without path
   * @returns {Object} Parsed information
   */
  parseFileName(fileName) {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // Common patterns:
    // Artist - Title
    // Artist - Album - Title
    // Title

    const patterns = [
      // Artist - Title
      /^(.+?)\s*-\s*(.+)$/,
      // Artist - Album - Title
      /^(.+?)\s*-\s*(.+?)\s*-\s*(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        if (match.length === 3) {
          return {
            artist: match[1].trim(),
            title: match[2].trim(),
          };
        } else if (match.length === 4) {
          return {
            artist: match[1].trim(),
            album: match[2].trim(),
            title: match[3].trim(),
          };
        }
      }
    }

    // No pattern matched, use whole name as title
    return {
      title: nameWithoutExt,
      artist: null,
      album: null,
    };
  }

  /**
   * Find artwork file alongside audio file
   * @param {string} filePath - Audio file path
   * @returns {string|null} Artwork file path or null
   */
  findArtworkFile(filePath) {
    const directory = this.getDirectory(filePath);
    const baseName = this.getFileName(filePath).replace(/\.[^/.]+$/, '');

    const artworkNames = [
      'cover.jpg',
      'cover.png',
      'folder.jpg',
      'folder.png',
      'artwork.jpg',
      'artwork.png',
      `${baseName}.jpg`,
      `${baseName}.png`,
    ];

    for (const name of artworkNames) {
      const artworkPath = `${directory}/${name}`;
      // Note: We can't check existence here as it's async
      // The caller should check existence
      return artworkPath;
    }

    return null;
  }

  /**
   * Generate unique track ID from file path
   * @param {string} filePath - File path
   * @returns {string} Unique ID
   */
  generateTrackId(filePath) {
    // Simple hash function for React Native compatibility
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate cache key for metadata
   * @param {string} filePath - File path
   * @returns {string} Cache key
   */
  generateCacheKey(filePath) {
    return `track_${this.generateTrackId(filePath)}`;
  }

  /**
   * Get file name from path
   * @param {string} filePath - File path
   * @returns {string} File name
   */
  getFileName(filePath) {
    return filePath.split('/').pop().split('\\').pop();
  }

  /**
   * Get file extension
   * @param {string} filePath - File path
   * @returns {string} File extension with dot
   */
  getFileExtension(filePath) {
    const match = filePath.match(/\.([^/.]+)$/);
    return match ? `.${match[1]}` : '';
  }

  /**
   * Get directory from file path
   * @param {string} filePath - File path
   * @returns {string} Directory path
   */
  getDirectory(filePath) {
    return filePath.substring(0, filePath.lastIndexOf('/'));
  }

  /**
   * Get file type from extension
   * @param {string} extension - File extension
   * @returns {string} File type
   */
  getFileType(extension) {
    const types = {
      '.mp3': 'MPEG Audio',
      '.m4a': 'MPEG-4 Audio',
      '.aac': 'Advanced Audio Coding',
      '.flac': 'Free Lossless Audio Codec',
      '.wav': 'Waveform Audio',
      '.ogg': 'Ogg Vorbis',
      '.opus': 'Opus Audio',
      '.webm': 'WebM Audio',
      '.wma': 'Windows Media Audio',
    };

    return types[extension.toLowerCase()] || 'Unknown';
  }

  /**
   * Clean up processor resources
   */
  cleanup() {
    // Clean up any resources if needed
  }
}

// Singleton instance
export const localTracksMetadataProcessor = new LocalTracksMetadataProcessor();
