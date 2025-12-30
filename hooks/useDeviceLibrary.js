import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { FileOperationErrorHandler } from '../Utils/FileOperationErrorHandler';
import { localTracksMetadataProcessor } from '../Utils/LocalTracksMetadataProcessor';
import { localTracksMetadataManager } from '../Utils/LocalTracksMetadataManager';

/**
 * useDeviceLibrary - Custom hook for managing device local music library
 * 
 * This hook provides:
 * - Scanning device for audio files
 * - Managing local tracks state
 * - Permission handling
 * - Metadata processing
 * - Error handling and recovery
 */

export const useDeviceLibrary = (options = {}) => {
  console.log('useDeviceLibrary: Hook called with options:', options);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [hasPermission, setHasPermission] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);

  const errorHandler = useRef(new FileOperationErrorHandler()).current;
  const abortController = useRef(null);

  // Default options
  const defaultOptions = useMemo(() => ({
    autoScan: false,
    scanPaths: Platform.select({
      android: [
        RNFS.ExternalStorageDirectoryPath, // Root external storage
        RNFS.ExternalStorageDirectoryPath + '/Music',
        RNFS.ExternalStorageDirectoryPath + '/Download',
        RNFS.ExternalStorageDirectoryPath + '/Documents',
        '/storage/emulated/0/Music', // Alternative path
        '/storage/emulated/0/Download',
        '/storage/emulated/0',
      ],
      ios: [
        RNFS.DocumentDirectoryPath,
        RNFS.LibraryDirectoryPath + '/Music',
      ],
      default: []
    }),
    supportedFormats: ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg'],
    maxScanDepth: 3,
    batchSize: 10,
    enableArtwork: true,
    cacheMetadata: true,
    ...options
  }), [options]);

  /**
   * Request storage permissions
   */
  const requestPermissions = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const permissions = [];
        
        // For Android 13+ (API 33+)
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
        } else {
          // For older Android versions
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }

        console.log('useDeviceLibrary: Requesting permissions:', permissions);
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        console.log('useDeviceLibrary: Permission results:', granted);

        let hasPermission = false;
        if (Platform.Version >= 33) {
          hasPermission = granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          hasPermission = granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
        }

        console.log('useDeviceLibrary: Final permission status:', hasPermission);
        setHasPermission(hasPermission);
        return hasPermission;
      } else {
        // iOS permissions are handled differently
        setHasPermission(true);
        return true;
      }
    } catch (error) {
      console.error('useDeviceLibrary: Permission request failed:', error);
      errorHandler.handleError(error, 'permission_request');
      setHasPermission(false);
      return false;
    }
  }, [errorHandler]);

  /**
   * Check if permissions are granted
   */
  const checkPermissions = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        let permissionGranted = false;
        
        if (Platform.Version >= 33) {
          // Android 13+ uses READ_MEDIA_AUDIO
          permissionGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          );
        } else {
          // Older Android versions use READ_EXTERNAL_STORAGE
          permissionGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
          );
        }

        console.log('useDeviceLibrary: Permission check result:', permissionGranted);
        setHasPermission(permissionGranted);
        return permissionGranted;
      } else {
        setHasPermission(true);
        return true;
      }
    } catch (error) {
      console.error('useDeviceLibrary: Permission check failed:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  /**
   * Scan directory for audio files
   */
  const scanDirectory = useCallback(async (directoryPath, depth = 0) => {
    console.log('useDeviceLibrary: scanDirectory called with path:', directoryPath, 'depth:', depth);
    if (depth > defaultOptions.maxScanDepth) {
      console.log('useDeviceLibrary: Max depth reached');
      return [];
    }
    if (abortController.current?.signal.aborted) {
      console.log('useDeviceLibrary: Scan aborted');
      return [];
    }

    const audioFiles = [];

    try {
      console.log('useDeviceLibrary: Reading directory:', directoryPath);
      const exists = await RNFS.exists(directoryPath);
      console.log('useDeviceLibrary: Directory exists:', exists);
      
      if (!exists) {
        console.log('useDeviceLibrary: Directory does not exist, skipping');
        return [];
      }
      
      const items = await RNFS.readDir(directoryPath);
      console.log('useDeviceLibrary: Found', items.length, 'items in directory');

      for (const item of items) {
        if (abortController.current?.signal.aborted) break;

        if (item.isFile()) {
          const extension = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
          console.log('useDeviceLibrary: Checking file:', item.name, 'extension:', extension);
          if (defaultOptions.supportedFormats.includes(extension)) {
            console.log('useDeviceLibrary: Found audio file:', item.path);
            audioFiles.push(item.path);
          }
        } else if (item.isDirectory() && depth < defaultOptions.maxScanDepth) {
          console.log('useDeviceLibrary: Scanning subdirectory:', item.path);
          // Recursively scan subdirectories
          const subFiles = await scanDirectory(item.path, depth + 1);
          audioFiles.push(...subFiles);
        }
      }
    } catch (error) {
      console.warn(`useDeviceLibrary: Failed to scan directory ${directoryPath}:`, error);
      // Don't throw error for individual directory failures
    }

    console.log('useDeviceLibrary: scanDirectory returning', audioFiles.length, 'audio files');
    return audioFiles;
  }, [defaultOptions]);

  /**
   * Process audio files in batches
   */
  const processFilesBatch = useCallback(async (filePaths, onProgress) => {
    const processedTracks = [];
    const errors = [];

    for (let i = 0; i < filePaths.length; i += defaultOptions.batchSize) {
      if (abortController.current?.signal.aborted) break;

      const batch = filePaths.slice(i, i + defaultOptions.batchSize);
      
      try {
        const batchResults = await localTracksMetadataProcessor.processFiles(batch, {
          extractArtwork: defaultOptions.enableArtwork
        });

        processedTracks.push(...batchResults.results);
        errors.push(...batchResults.errors);

        onProgress?.(i + batch.length, filePaths.length);
      } catch (error) {
        console.error('useDeviceLibrary: Batch processing failed:', error);
        errors.push({ batch, error: error.message });
      }
    }

    return { processedTracks, errors };
  }, [defaultOptions]);

  /**
   * Scan device for audio files
   */
  const scanLibrary = useCallback(async () => {
    console.log('useDeviceLibrary: scanLibrary called, isScanning:', isScanning, 'hasPermission:', hasPermission);
    if (isScanning) {
      console.log('useDeviceLibrary: Already scanning, returning');
      return;
    }
    if (!hasPermission) {
      console.log('useDeviceLibrary: No permission, requesting...');
      const permissionGranted = await requestPermissions();
      console.log('useDeviceLibrary: Permission granted:', permissionGranted);
      if (!permissionGranted) {
        setError(new Error('Storage permission required to scan local music'));
        return;
      }
    }

    setIsScanning(true);
    setIsLoading(true);
    setError(null);
    setScanProgress({ current: 0, total: 0 });
    abortController.current = new AbortController();

    try {
      const allAudioFiles = [];
      console.log('useDeviceLibrary: Starting scan with paths:', defaultOptions.scanPaths);

      // Scan all configured paths
      for (const scanPath of defaultOptions.scanPaths) {
        console.log('useDeviceLibrary: Scanning path:', scanPath);
        if (abortController.current?.signal.aborted) break;

        try {
          const files = await scanDirectory(scanPath);
          console.log('useDeviceLibrary: Found', files.length, 'files in', scanPath);
          allAudioFiles.push(...files);
        } catch (error) {
          console.warn(`useDeviceLibrary: Failed to scan path ${scanPath}:`, error);
        }
      }

      console.log('useDeviceLibrary: Total audio files found:', allAudioFiles.length);

      if (allAudioFiles.length === 0) {
        console.log('useDeviceLibrary: No audio files found');
        setTracks([]);
        setLastScanTime(Date.now());
        return;
      }

      setScanProgress({ current: 0, total: allAudioFiles.length });

      // Process files in batches
      console.log('useDeviceLibrary: Processing', allAudioFiles.length, 'files...');
      const { processedTracks, errors } = await processFilesBatch(
        allAudioFiles,
        (current, total) => {
          setScanProgress({ current, total });
        }
      );

      console.log('useDeviceLibrary: Processing complete. Tracks:', processedTracks.length, 'Errors:', errors.length);

      // Sort tracks by title
      processedTracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      setTracks(processedTracks);
      setLastScanTime(Date.now());

      if (errors.length > 0) {
        console.warn(`useDeviceLibrary: ${errors.length} files failed to process`);
      }

    } catch (error) {
      console.error('useDeviceLibrary: Scan failed:', error);
      errorHandler.handleError(error, 'library_scan');
      setError(error);
    } finally {
      setIsScanning(false);
      setIsLoading(false);
      setScanProgress({ current: 0, total: 0 });
      abortController.current = null;
    }
  }, [
    isScanning, 
    hasPermission, 
    requestPermissions, 
    scanDirectory, 
    processFilesBatch, 
    errorHandler,
    defaultOptions
  ]);

  /**
   * Stop ongoing scan
   */
  const stopScan = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  /**
   * Refresh library (force rescan)
   */
  const refreshLibrary = useCallback(async () => {
    await scanLibrary();
  }, [scanLibrary]);

  /**
   * Clear library data
   */
  const clearLibrary = useCallback(async () => {
    setTracks([]);
    setLastScanTime(null);
    setError(null);
    
    try {
      await localTracksMetadataManager.clearAllMetadata();
    } catch (error) {
      console.error('useDeviceLibrary: Failed to clear metadata:', error);
    }
  }, []);

  /**
   * Get track by ID
   */
  const getTrackById = useCallback((trackId) => {
    return tracks.find(track => track.id === trackId);
  }, [tracks]);

  /**
   * Remove track by ID
   */
  const removeTrack = useCallback((trackId) => {
    console.log('useDeviceLibrary: Removing track:', trackId);
    setTracks(prev => prev.filter(track => track.id !== trackId));
  }, []);

  /**
   * Search tracks
   */
  const searchTracks = useCallback((query) => {
    if (!query) return tracks;
    
    const lowerQuery = query.toLowerCase();
    return tracks.filter(track => 
      (track.title || '').toLowerCase().includes(lowerQuery) ||
      (track.artist || '').toLowerCase().includes(lowerQuery) ||
      (track.album || '').toLowerCase().includes(lowerQuery)
    );
  }, [tracks]);

  /**
   * Get library statistics
   */
  const getLibraryStats = useCallback(() => {
    const stats = {
      totalTracks: tracks.length,
      totalSize: tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0),
      artists: new Set(tracks.map(track => track.artist).filter(Boolean)).size,
      albums: new Set(tracks.map(track => track.album).filter(Boolean)).size,
      lastScanTime,
      scanInProgress: isScanning
    };

    return stats;
  }, [tracks, lastScanTime, isScanning]);

  // Initialize on mount
  useEffect(() => {
    const initializeHook = async () => {
      try {
        console.log('useDeviceLibrary: Initializing...');
        console.log('useDeviceLibrary: RNFS paths:', {
          ExternalStorageDirectoryPath: RNFS.ExternalStorageDirectoryPath,
          DocumentDirectoryPath: RNFS.DocumentDirectoryPath,
          LibraryDirectoryPath: RNFS.LibraryDirectoryPath,
        });

        // Initialize metadata manager
        await localTracksMetadataManager.initialize();
        console.log('useDeviceLibrary: Metadata manager initialized');

        const hasPerm = await checkPermissions();
        console.log('useDeviceLibrary: Permissions checked, hasPermission:', hasPerm);
        if (defaultOptions.autoScan && hasPerm) {
          console.log('useDeviceLibrary: Auto-scanning enabled, starting scan...');
          scanLibrary();
        } else {
          console.log('useDeviceLibrary: Auto-scan disabled or no permissions');
        }
      } catch (error) {
        console.error('useDeviceLibrary: Initialization error:', error);
        setError(error);
      }
    };

    initializeHook();

    return () => {
      stopScan();
    };
  }, [checkPermissions, defaultOptions.autoScan, scanLibrary, stopScan]);

  console.log('useDeviceLibrary: Returning hook result');

  return {
    // State
    tracks,
    isLoading,
    isScanning,
    error,
    scanProgress,
    hasPermission,
    lastScanTime,

    // Actions
    scanLibrary,
    stopScan,
    refreshLibrary,
    clearLibrary,
    requestPermissions,
    checkPermissions,

    // Utilities
    getTrackById,
    searchTracks,
    getLibraryStats,
    removeTrack,

    // Options
    options: defaultOptions
  };
};