import {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {Platform, PermissionsAndroid} from 'react-native';
import RNFS from 'react-native-fs';
import {FileOperationErrorHandler} from '../Utils/FileOperationErrorHandler';
import {localTracksMetadataProcessor} from '../Utils/LocalTracksMetadataProcessor';
import {localTracksMetadataManager} from '../Utils/LocalTracksMetadataManager';

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

  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({current: 0, total: 0});
  const [hasPermission, setHasPermission] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);

  const abortController = useRef(null);

  // Default options
  const defaultOptions = useMemo(
    () => ({
      autoScan: false,
      showHidden: false,
      scanPaths: Platform.select({
        android: [
          RNFS.ExternalStorageDirectoryPath,
          RNFS.ExternalStorageDirectoryPath + '/Music',
          RNFS.ExternalStorageDirectoryPath + '/Download',
          RNFS.ExternalStorageDirectoryPath + '/Downloads',
          RNFS.ExternalStorageDirectoryPath + '/Documents',
          RNFS.ExternalStorageDirectoryPath + '/WhatsApp/Media/WhatsApp Audio',
          RNFS.ExternalStorageDirectoryPath + '/Telegram/Telegram Audio',
          '/storage/emulated/0/Music',
          '/storage/emulated/0/Download',
          '/storage/emulated/0/Downloads',
        ],
        ios: [RNFS.DocumentDirectoryPath, RNFS.LibraryDirectoryPath + '/Music'],
        default: [],
      }),
      supportedFormats: [
        '.mp3',
        '.m4a',
        '.aac',
        '.flac',
        '.wav',
        '.ogg',
        '.opus',
        '.webm',
      ],
      maxScanDepth: 10,
      batchSize: 10,
      enableArtwork: true,
      cacheMetadata: true,
      ...options,
    }),
    [options],
  );

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
          permissions.push(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          );
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        let permissionStatus = false;
        if (Platform.Version >= 33) {
          permissionStatus =
            granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;
        } else {
          permissionStatus =
            granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
            PermissionsAndroid.RESULTS.GRANTED;
        }


        setHasPermission(permissionStatus);
        return permissionStatus;
      } else {
        // iOS permissions are handled differently
        setHasPermission(true);
        return true;
      }
    } catch (err) {
      console.error('useDeviceLibrary: Permission request failed:', err);
      FileOperationErrorHandler.handleError(err, 'permission_request');
      setHasPermission(false);
      return false;
    }
  }, []);

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
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
          );
        } else {
          // Older Android versions use READ_EXTERNAL_STORAGE
          permissionGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          );
        }


        setHasPermission(permissionGranted);
        return permissionGranted;
      } else {
        setHasPermission(true);
        return true;
      }
    } catch (err) {
      console.error('useDeviceLibrary: Permission check failed:', err);
      setHasPermission(false);
      return false;
    }
  }, []);

  /**
   * Scan directory for audio files
   */
  const scanDirectory = useCallback(
    async (directoryPath, depth = 0) => {

      if (depth > defaultOptions.maxScanDepth) {

        return [];
      }
      if (abortController.current?.signal.aborted) {

        return [];
      }

      const audioFiles = [];

      try {

        const exists = await RNFS.exists(directoryPath);

        if (!exists) {

          return [];
        }

        const items = await RNFS.readDir(directoryPath);


        for (const item of items) {
          if (abortController.current?.signal.aborted) {
            break;
          }

          // Skip hidden files and directories
          if (item.name.startsWith('.')) {
            continue;
          }

          // Skip Android directory and some other system/heavy folders
          if (
            item.name === 'Android' ||
            item.name === 'data' ||
            item.name === 'obb'
          ) {
            continue;
          }

          // Skip Music Aura folder where downloaded songs are stored
          if (item.name === 'Music Aura') {
            continue;
          }

          if (item.isFile()) {
            const lastDotIndex = item.name.lastIndexOf('.');
            if (lastDotIndex !== -1) {
              const extension = item.name.substring(lastDotIndex).toLowerCase();
              if (defaultOptions.supportedFormats.includes(extension)) {
                audioFiles.push(item.path);
              }
            }
          } else if (
            item.isDirectory() &&
            depth < defaultOptions.maxScanDepth
          ) {
            // Recursively scan subdirectories
            const subFiles = await scanDirectory(item.path, depth + 1);
            audioFiles.push(...subFiles);
          }
        }
} catch (err) {
          console.warn(
            `useDeviceLibrary: Failed to scan directory ${directoryPath}:`,
            err,
        );
        // Don't throw error for individual directory failures
      }


      return audioFiles;
    },
    [defaultOptions],
  );

  /**
   * Process audio files in batches
   */
  const processFilesBatch = useCallback(
    async (filePaths, onProgress) => {
      const processedTracks = [];
      const errors = [];

      for (let i = 0; i < filePaths.length; i += defaultOptions.batchSize) {
        if (abortController.current?.signal.aborted) {
          break;
        }

        const batch = filePaths.slice(i, i + defaultOptions.batchSize);

        try {
          const batchResults = await localTracksMetadataProcessor.processFiles(
            batch,
            {
              extractArtwork: defaultOptions.enableArtwork,
            },
          );

          processedTracks.push(...batchResults.results);
          errors.push(...batchResults.errors);

          onProgress?.(i + batch.length, filePaths.length);
        } catch (err) {
          console.error('useDeviceLibrary: Batch processing failed:', err);
          errors.push({batch, error: err.message});
        }
      }

      return {processedTracks, errors};
    },
    [defaultOptions],
  );

  /**
   * Scan device for audio files
   */
  const scanLibrary = useCallback(async () => {

    if (isScanning) {

      return;
    }
    if (!hasPermission) {

      const permissionGranted = await requestPermissions();

      if (!permissionGranted) {
        setError(new Error('Storage permission required to scan local music'));
        return;
      }
    }

    setIsScanning(true);
    setIsLoading(true);
    setError(null);
    setScanProgress({current: 0, total: 0});
    abortController.current = new AbortController();

    try {
      const allAudioFiles = [];


      // Scan all configured paths and update UI incrementally
      for (const scanPath of defaultOptions.scanPaths) {
        if (abortController.current?.signal.aborted) {
          break;
        }
        try {
          const files = await scanDirectory(scanPath);
          if (files.length > 0) {

            files.forEach(f => allAudioFiles.push(f));

            // De-duplicate and update UI with basic tracks found so far
            const uniqueFiles = [...new Set(allAudioFiles)];
            const currentBasicTracks = uniqueFiles.map(filePath => {
              const fileName = filePath.split('/').pop().split('\\').pop();
              const title = fileName.replace(/\.[^/.]+$/, '');
              return {
                id: localTracksMetadataProcessor.generateTrackId(filePath),
                filePath,
                title,
                artist: 'Unknown Artist',
                album: 'Unknown Album',
                isLocal: true,
                type: 'local',
                isProcessed: false,
              };
            });

            setTracks(prev => {
              const trackMap = new Map(prev.map(t => [t.id, t]));
              currentBasicTracks.forEach(t => {
                if (!trackMap.has(t.id)) {
                  trackMap.set(t.id, t);
                }
              });
              return Array.from(trackMap.values()).sort((a, b) =>
                (a.title || '').localeCompare(b.title || ''),
              );
            });
          }
        } catch (err) {
          console.warn(
            `useDeviceLibrary: Failed to scan path ${scanPath}:`,
            err,
          );
        }
      }

      // De-duplicate files by path
      const uniqueFiles = [...new Set(allAudioFiles)];
      allAudioFiles.length = 0;
      allAudioFiles.push(...uniqueFiles);



      if (allAudioFiles.length === 0) {

        // Only clear tracks if this was a manual refresh/force scan
        // This prevents clearing cached results if an auto-scan fails temporarily
        setTracks(prev => (prev.length > 0 ? prev : []));
        setLastScanTime(Date.now());
        return [];
      }

      setScanProgress({current: 0, total: allAudioFiles.length});

      // Create basic track objects immediately from file paths

      const basicTracks = allAudioFiles.map(filePath => {
        const trackId = localTracksMetadataProcessor.generateTrackId(filePath);
        const fileName = filePath.split('/').pop().split('\\').pop();
        const title = fileName.replace(/\.[^/.]+$/, '');

        // Attempt to merge cached metadata if available
        const cached = localTracksMetadataManager.getMetadataSync
          ? localTracksMetadataManager.getMetadataSync(trackId)
          : null;

        return {
          id: trackId,
          filePath,
          title: cached?.title || title,
          artist: cached?.artist || 'Unknown Artist',
          album: cached?.album || 'Unknown Album',
          artwork: cached?.artwork || null,
          duration: cached?.duration || 0,
          isLocal: true,
          type: 'local',
          isProcessed: !!cached?.isProcessed,
          lastModified: cached?.lastModified || 0,
        };
      });

      // Filter out hidden files

      const {getHiddenFiles} = require('../LocalStorage/HiddenLocalFiles');
      const hiddenFiles = await getHiddenFiles();

      // Only filter if showHidden option is not enabled
      const visibleTracks = defaultOptions.showHidden
        ? basicTracks
        : basicTracks.filter(track => !hiddenFiles.includes(track.filePath));


      // Show basic results immediately
      visibleTracks.sort((a, b) =>
        (a.title || '').localeCompare(b.title || ''),
      );
      setTracks(visibleTracks);
      setLastScanTime(Date.now());

      // Start background metadata extraction via the manager (matches Orbit's logic)

      localTracksMetadataManager.sync(visibleTracks);

      return visibleTracks;
    } catch (err) {
      console.error('useDeviceLibrary: Scan failed:', err);
      FileOperationErrorHandler.handleError(err, 'library_scan', {
        showToast: false,
      });
      setError(err);
    } finally {
      setIsScanning(false);
      setIsLoading(false);
      setScanProgress({current: 0, total: 0});
      abortController.current = null;
    }
  }, [
    isScanning,
    hasPermission,
    requestPermissions,
    scanDirectory,
    defaultOptions,
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
    } catch (err) {
      console.error('useDeviceLibrary: Failed to clear metadata:', err);
    }
  }, []);

  /**
   * Get track by ID
   */
  const getTrackById = useCallback(
    trackId => {
      return tracks.find(track => track.id === trackId);
    },
    [tracks],
  );

  /**
   * Remove track by ID
   */
  const removeTrack = useCallback(trackId => {

    setTracks(prev => prev.filter(track => track.id !== trackId));
  }, []);

  /**
   * Search tracks
   */
  const searchTracks = useCallback(
    query => {
      if (!query) {
        return tracks;
      }

      const lowerQuery = query.toLowerCase();
      return tracks.filter(
        track =>
          (track.title || '').toLowerCase().includes(lowerQuery) ||
          (track.artist || '').toLowerCase().includes(lowerQuery) ||
          (track.album || '').toLowerCase().includes(lowerQuery),
      );
    },
    [tracks],
  );

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
      scanInProgress: isScanning,
    };

    return stats;
  }, [tracks, lastScanTime, isScanning]);

  // Initialize on mount or when autoScan/checkPermissions change
  useEffect(() => {
    let isMounted = true;

    const initializeHook = async () => {
      try {

        await localTracksMetadataManager.initialize();

        if (!isMounted) {
          return;
        }

        // Load cached tracks immediately
        const cachedTracks = await localTracksMetadataManager.getAllMetadata();

        if (cachedTracks.length > 0) {
          // Sort cached tracks before setting
          cachedTracks.sort((a, b) =>
            (a.title || '').localeCompare(b.title || ''),
          );
          setTracks(cachedTracks);
        }

        const hasPerm = await checkPermissions();

        if (defaultOptions.autoScan && hasPerm) {

          scanLibrary();
        }
      } catch (err) {
        console.error('useDeviceLibrary: Initialization error:', err);
        if (isMounted) {
          setError(err);
        }
      }
    };

    initializeHook();

    // Subscribe to metadata updates from manager
    const unsubscribe = localTracksMetadataManager.subscribe(updatedTracks => {
      if (isMounted && updatedTracks && updatedTracks.length > 0) {
        setTracks(prevTracks => {
          // Merge updated metadata into existing tracks
          const updatedMap = new Map(updatedTracks.map(t => [t.id, t]));
          return prevTracks.map(track => {
            if (updatedMap.has(track.id)) {
              return {...track, ...updatedMap.get(track.id)};
            }
            return track;
          });
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      stopScan();
    };
  }, [checkPermissions, defaultOptions.autoScan, scanLibrary, stopScan]);

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
    processFilesBatch,

    // Options
    options: defaultOptions,
  };
};
