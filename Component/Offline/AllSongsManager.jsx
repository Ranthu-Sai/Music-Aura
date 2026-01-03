import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DeviceEventEmitter, Platform, PermissionsAndroid, ToastAndroid, Alert } from 'react-native';
import { StorageManager } from '../../Utils/StorageManager';
import { useDeviceLibrary } from '../../hooks/useDeviceLibrary';
import { scanLocalMusic } from '../../Utils/LocalMusicScanner';

/**
 * useAllSongsManager - Custom hook for managing both downloaded songs and local storage songs
 * Combines downloaded songs metadata with device library scanning
 */
const useAllSongsManager = ({
  onSongsChanged,
  onDownloadStatusChanged,
  autoCleanup = true,
  autoScanLocal = false,
  showHidden = false
}) => {
  const [allSongs, setAllSongs] = useState([]);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [localSongs, setLocalSongs] = useState([]);
  const [downloadedSongsMetadata, setDownloadedSongsMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Ref to store the latest functions
  const loadDownloadedSongsRef = useRef();
  const scanLocalSongsRef = useRef();

  // Memoize config to prevent hook from re-initializing and aborting scans on every render
  const deviceLibraryConfig = useMemo(() => ({
    autoScan: autoScanLocal,
    showHidden: showHidden,
    supportedFormats: ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.webm'],
    maxScanDepth: 10,
    batchSize: 10,
    enableArtwork: true,
    cacheMetadata: true
  }), [autoScanLocal, showHidden]);

  // Use the device library hook for local storage scanning
  const {
    tracks: deviceTracks,
    isLoading: isScanningLocal,
    isScanning,
    error: localScanError,
    hasPermission: localPermission,
    scanLibrary,
    requestPermissions: requestLocalPermissions,
    checkPermissions: checkLocalPermissions,
    getLibraryStats,
    clearLibrary,
    removeTrack
  } = useDeviceLibrary(deviceLibraryConfig);

  // Load all downloaded songs metadata
  const loadDownloadedSongs = useCallback(async () => {
    try {
      setIsLoading(true);

      // Clean up orphaned metadata if auto cleanup is enabled
      if (autoCleanup) {
        await StorageManager.cleanupOrphanedMetadata();
      }

      const allMetadata = await StorageManager.getAllDownloadedSongsMetadata();

      if (!allMetadata || Object.keys(allMetadata).length === 0) {
        setDownloadedSongs([]);
        setDownloadedSongsMetadata({});
        return [];
      }

      setDownloadedSongsMetadata(allMetadata);

      // Convert metadata to array format for easier handling
      const songsArray = [];

      for (const [songId, metadata] of Object.entries(allMetadata)) {
        try {
          // Verify the song file still exists
          const songExists = await StorageManager.isSongDownloaded(songId);

          if (songExists) {
            const songPath = await StorageManager.getSongPath(songId);

            songsArray.push({
              id: songId,
              title: metadata.title || 'Unknown Title',
              artist: metadata.artist || 'Unknown Artist',
              album: metadata.album || 'Unknown Album',
              duration: metadata.duration || 0,
              filePath: songPath,
              artwork: metadata.artwork,
              downloadDate: metadata.downloadDate,
              fileSize: metadata.fileSize,
              type: 'downloaded', // Mark as downloaded song
              metadata
            });
          } else {
            // Clean up metadata for non-existent files
            await StorageManager.removeDownloadedSongMetadata(songId);
          }
        } catch (error) {
          console.warn(`useAllSongsManager: Error processing downloaded song ${songId}:`, error);
        }
      }

      setDownloadedSongs(songsArray);
      return songsArray;
    } catch (error) {
      console.error('useAllSongsManager: Error loading downloaded songs:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [autoCleanup]);

  // Load local storage songs
  const loadLocalSongs = useCallback(async (forceScan = false) => {
    try {
      setIsLoading(true);

      // Check permissions first
      const permissionGranted = await checkLocalPermissions();
      if (!permissionGranted && !localPermission) {
        console.log('useAllSongsManager: No permission for local songs');
        setLocalSongs([]);
        return [];
      }

      let currentDeviceTracks = deviceTracks;

      // Scan device library if not already done or forced
      if ((deviceTracks.length === 0 || forceScan) && !isScanning) {
        console.log('useAllSongsManager: Starting local scan (forceScan:', forceScan, ')');
        const scannedResults = await scanLibrary();
        
        if (scannedResults && scannedResults.length > 0) {
          console.log('useAllSongsManager: Primary scanner found', scannedResults.length, 'songs');
          currentDeviceTracks = scannedResults;
        } else {
          // Fallback to legacy scanner if useDeviceLibrary found nothing
          console.log('useAllSongsManager: Primary scanner found nothing, trying legacy fallback...');
          const legacyResults = await scanLocalMusic();
          if (legacyResults && legacyResults.length > 0) {
              console.log('useAllSongsManager: Legacy scanner found', legacyResults.length, 'songs');
              // Map legacy results to current format
              currentDeviceTracks = legacyResults.map(s => ({
                  id: s.id,
                  title: s.title,
                  artist: s.artist,
                  filePath: s.url,
                  artwork: s.artwork,
                  type: 'local'
              }));
          } else {
              console.log('useAllSongsManager: Both scanners returned no results');
              currentDeviceTracks = [];
          }
        }
      }

      // Convert device tracks to our format
      const localSongsArray = currentDeviceTracks.map(track => ({
        id: track.id || `local_${track.filePath}`,
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        duration: track.duration || 0,
        filePath: track.filePath,
        artwork: track.artwork,
        fileSize: track.fileSize,
        type: 'local', // Mark as local storage song
        metadata: track
      }));

      setLocalSongs(localSongsArray);
      return localSongsArray;
    } catch (error) {
      console.error('useAllSongsManager: Error loading local songs:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [deviceTracks, isScanning, scanLibrary, checkLocalPermissions]);

  // Combine downloaded and local songs
  const combineAllSongs = useCallback(() => {
    const combined = [
      ...downloadedSongs.map(song => ({ ...song, type: 'downloaded' })),
      ...localSongs.map(song => ({ ...song, type: 'local' }))
    ];

    // Sort by title
    combined.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    setAllSongs(combined);
    return combined;
  }, [downloadedSongs, localSongs]);

  // Sync deviceTracks to localSongs
  useEffect(() => {
    const localSongsArray = deviceTracks.map(track => ({
      id: track.id || `local_${track.filePath}`,
      title: track.title || 'Unknown Title',
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      duration: track.duration || 0,
      filePath: track.filePath,
      artwork: track.artwork,
      fileSize: track.fileSize,
      type: 'local', // Mark as local storage song
      metadata: track
    }));
    setLocalSongs(localSongsArray);
  }, [deviceTracks]);

  // Load all songs (both downloaded and local)
  const loadAllSongs = useCallback(async (force = false) => {
    try {
      setIsLoading(true);

      // Load both downloaded and local songs in parallel
      const [downloaded, local] = await Promise.all([
        loadDownloadedSongs(),
        loadLocalSongs(force)
      ]);

      // Combine them
      const combined = [
        ...downloaded.map(song => ({ ...song, type: 'downloaded' })),
        ...local.map(song => ({ ...song, type: 'local' }))
      ];

      // Sort by title
      combined.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      setAllSongs(combined);

      // Notify parent component
      if (onSongsChanged) {
        onSongsChanged(combined);
      }

      return combined;
    } catch (error) {
      console.error('useAllSongsManager: Error loading all songs:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [loadDownloadedSongs, loadLocalSongs, onSongsChanged]);

  // Check if a song is downloaded
  const isSongDownloaded = useCallback(async (songId) => {
    return await StorageManager.isSongDownloaded(songId);
  }, []);

  // Remove a downloaded song
  const removeDownloadedSong = useCallback(async (songId) => {
    try {
      await StorageManager.removeDownloadedSongMetadata(songId);

      // Update local state
      setDownloadedSongs(prev => prev.filter(song => song.id !== songId));
      setDownloadedSongsMetadata(prev => {
        const updated = { ...prev };
        delete updated[songId];
        return updated;
      });

      // Recombine all songs
      combineAllSongs();

      // Notify listeners
      DeviceEventEmitter.emit('downloadedSongRemoved', songId);
      if (onDownloadStatusChanged) {
        onDownloadStatusChanged(songId, false);
      }

      return true;
    } catch (error) {
      console.error('useAllSongsManager: Error removing downloaded song:', error);
      return false;
    }
  }, [combineAllSongs, onDownloadStatusChanged]);

  // Remove a local song
  const removeLocalSong = useCallback(async (songId) => {
    removeTrack(songId);
    return true;
  }, [removeTrack]);

  // Request permissions for both downloaded and local songs
  const requestPermissions = useCallback(async () => {
    try {
      setIsRequestingPermission(true);

      if (Platform.OS === 'android') {
        const permissions = [];

        // For Android 13+ (API 33+)
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
        } else {
          // For older Android versions
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }

        console.log('useAllSongsManager: Requesting permissions:', permissions);
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        console.log('useAllSongsManager: Permission results:', granted);

        let permissionGranted = false;
        if (Platform.Version >= 33) {
          permissionGranted = granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          permissionGranted = granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
        }

        console.log('useAllSongsManager: Final permission status:', permissionGranted);
        setHasPermission(permissionGranted);

        if (permissionGranted) {
          ToastAndroid.show("Permission granted! Loading songs...", ToastAndroid.SHORT);
          // Load all songs after permission is granted
          if (loadAllSongsRef.current) {
            loadAllSongsRef.current();
          }
        } else {
          // Check if permission was denied permanently
          let shouldShowSettings = false;
          if (Platform.Version >= 33) {
            shouldShowSettings = !(await PermissionsAndroid.shouldShowRequestPermissionRationale(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO));
          } else {
            shouldShowSettings = !(await PermissionsAndroid.shouldShowRequestPermissionRationale(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE));
          }

          if (shouldShowSettings) {
            ToastAndroid.show("Permission denied. Please enable storage permission in app settings.", ToastAndroid.LONG);
            Alert.alert(
              "Permission Required",
              "Storage permission is required to access songs. Please enable it in app settings.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => {
                  // This would need to be implemented to open app settings
                  console.log('Open app settings');
                }}
              ]
            );
          } else {
            ToastAndroid.show("Permission denied. Please grant storage permission to access songs.", ToastAndroid.LONG);
          }
        }

        return permissionGranted;
      } else {
        // iOS permissions
        setHasPermission(true);
        return true;
      }
    } catch (error) {
      console.error('useAllSongsManager: Permission request failed:', error);
      setHasPermission(false);
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  // Get download statistics
  const getDownloadStats = useCallback(() => {
    return {
      totalDownloaded: downloadedSongs.length,
      totalLocal: localSongs.length,
      totalSize: downloadedSongs.reduce((sum, song) => sum + (song.fileSize || 0), 0),
      lastUpdated: Date.now()
    };
  }, [downloadedSongs, localSongs]);

  // Get all songs statistics
  const getAllSongsStats = useCallback(() => {
    const downloadStats = getDownloadStats();
    const localStats = getLibraryStats();

    return {
      ...downloadStats,
      totalSongs: allSongs.length,
      localArtists: localStats.artists || 0,
      localAlbums: localStats.albums || 0,
      lastLocalScan: localStats.lastScanTime
    };
  }, [getDownloadStats, getLibraryStats, allSongs]);

  // Update refs when functions change
  useEffect(() => {
    loadDownloadedSongsRef.current = loadDownloadedSongs;
    scanLocalSongsRef.current = loadLocalSongs;
  }, [loadDownloadedSongs, loadLocalSongs]);

  // Ref for loadAllSongs
  const loadAllSongsRef = useRef();
  useEffect(() => {
    loadAllSongsRef.current = loadAllSongs;
  }, [loadAllSongs]);

  // Listen for download/delete events
  useEffect(() => {
    const downloadListener = DeviceEventEmitter.addListener('songDownloaded', async (songData) => {
      console.log('useAllSongsManager: Song downloaded event received:', songData);

      // Reload downloaded songs
      if (loadDownloadedSongsRef.current) {
        await loadDownloadedSongsRef.current();
      }

      // Recombine all songs
      combineAllSongs();
    });

    const downloadedRemovedListener = DeviceEventEmitter.addListener('downloadedSongRemoved', async (songId) => {
      console.log('useAllSongsManager: Downloaded song removed event received:', songId);
      setDownloadedSongs(prev => prev.filter(song => song.id !== songId));
      combineAllSongs();
    });

    const localDeletedListener = DeviceEventEmitter.addListener('localSongDeleted', async (songId) => {
      console.log('useAllSongsManager: Local song deleted event received:', songId);
      removeTrack(songId);
    });

    const localUnhiddenListener = DeviceEventEmitter.addListener('localSongUnhidden', async (songId) => {
      console.log('useAllSongsManager: Local song unhidden event received:', songId);
      // Trigger refresh of device library
      if (deviceLibraryConfig.requestScan) {
        await deviceLibraryConfig.requestScan();
      }
    });

    return () => {
      downloadListener.remove();
      downloadedRemovedListener.remove();
      localDeletedListener.remove();
      localUnhiddenListener.remove();
    };
  }, [combineAllSongs, removeTrack, deviceLibraryConfig]);

  // Combine songs when either downloaded or local songs change
  useEffect(() => {
    combineAllSongs();
  }, [combineAllSongs]);

  // Initialize on mount
  useEffect(() => {
    let mounted = true;

    const initializeOnce = async () => {
      if (mounted) {
        // Check permissions first
        const permissionGranted = await checkLocalPermissions();
        setHasPermission(permissionGranted);

        if (permissionGranted) {
          await loadAllSongs(false);
        }
      }
    };

    initializeOnce();

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Combined data
    allSongs,
    downloadedSongs,
    localSongs,

    // Loading states
    isLoading: isLoading || isScanningLocal,
    isScanningLocal,
    isRequestingPermission,

    // Permissions
    hasPermission,

    // Actions
    loadAllSongs,
    loadDownloadedSongs,
    loadLocalSongs,
    removeDownloadedSong,
    removeLocalSong,
    requestPermissions,
    scanLibrary,

    // Utilities
    isSongDownloaded,
    getDownloadStats,
    getAllSongsStats,
    getLibraryStats,

    // Metadata
    downloadedSongsMetadata
  };
};

export default useAllSongsManager;