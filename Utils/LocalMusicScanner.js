import ReactNativeBlobUtil from 'react-native-blob-util';
import {Platform, PermissionsAndroid} from 'react-native';


const AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'flac',
  'aac',
  'webm',
  'amr',
  'opus',
  'aiff',
];

/**
 * Request storage permission for scanning
 */
async function requestStoragePermission() {
  if (Platform.OS === 'ios') {
    return true;
  }

  try {
    const permissions = [];
    if (Platform.Version >= 33) {
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
    } else {
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    }

    const granted = await PermissionsAndroid.requestMultiple(permissions);

    if (Platform.Version >= 33) {
      return (
        granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      return (
        granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    }
  } catch (err) {
    return false;
  }
}

/**
 * Scan a specific directory for audio files recursively
 */
async function scanDirectory(path, depth = 0) {
  if (depth > 10) {
    return [];
  } // Increased depth for deeper scans
  let results = [];
  try {
    const isDir = await ReactNativeBlobUtil.fs.isDir(path);
    if (!isDir) {
      return [];
    }

    const files = await ReactNativeBlobUtil.fs.ls(path);
    for (const file of files) {
      const filePath = `${path}/${file}`;

      // Optimization: Skip system/heavy folders
      if (file === 'data' || file.startsWith('.')) {
        continue;
      }

      // Skip Music Aura folder where downloaded songs are stored
      if (file === 'Music Aura') {
        continue;
      }

      try {
        const stat = await ReactNativeBlobUtil.fs.stat(filePath);
        if (stat.type === 'directory') {
          const subFiles = await scanDirectory(filePath, depth + 1);
          results = results.concat(subFiles);
        } else {
          const ext = file.split('.').pop().toLowerCase();
          if (AUDIO_EXTENSIONS.includes(ext)) {
            results.push({
              id: filePath,
              url: filePath,
              title: file.replace(/\.[^/.]+$/, ''),
              artist: 'Local storage',
              artwork: null,
              duration: 0,
              image: null,
              isLocal: true,
            });
          }
        }
      } catch (statErr) {
        // Ignore errors
      }
    }
  } catch (e) {
    // console.warn('Error scanning directory:', path);
  }
  return results;
}

/**
 * Main scan function
 */
export async function scanLocalMusic() {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    return [];
  }

  const dirs = ReactNativeBlobUtil.fs.dirs;
  const scanPaths = [
    dirs.SDCardDir, // Root of internal storage /storage/emulated/0
    dirs.DownloadDir, // Downloads folder
    dirs.MusicDir, // Music folder
    `${dirs.SDCardDir}/Music`, // Explicit Music folder
    `${dirs.SDCardDir}/Download`, // Explicit Download folder
    `${dirs.SDCardDir}/Downloads`, // Downloads folder
  ];

  // Some devices might have external SD card path mounted differently
  // In many cases SDCardDir covers the primary shared storage.

  let allSongs = [];
  for (const path of scanPaths) {
    const songs = await scanDirectory(path);
    allSongs = allSongs.concat(songs);
  }

  // Filter duplicates by path and sort alphabetically
  const seen = new Set();
  return allSongs
    .filter(song => {
      if (seen.has(song.url)) {
        return false;
      }
      seen.add(song.url);
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Check if file is deletable (not in protected system directories)
 */
export function isFileDeletable(filePath) {
  const protectedPaths = [
    '/Alarms',
    '/Notifications',
    '/Ringtones',
    '/Podcasts',
    '/system',
    '/Android/data',
    '/Android/obb',
  ];

  return !protectedPaths.some(protectedPath =>
    filePath.includes(protectedPath),
  );
}

/**
 * Delete a local file
 */
export async function deleteLocalSong(filePath) {
  try {
    console.log('deleteLocalSong: Starting deletion for path:', filePath);

    if (!filePath) {
      console.error('deleteLocalSong: No file path provided');
      return {success: false, error: 'No file path provided'};
    }

    // Normalize path: remove file:// prefix if exists
    let cleanPath = filePath;
    if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.replace('file://', '');
    }

    // Decode URI if it's encoded
    try {
      cleanPath = decodeURI(cleanPath);
    } catch (decodeError) {
      console.warn('deleteLocalSong: Failed to decode URI:', decodeError);
    }

    console.log('deleteLocalSong: Normalized path:', cleanPath);

    const exists = await ReactNativeBlobUtil.fs.exists(cleanPath);
    console.log('deleteLocalSong: File exists:', exists);

    if (!exists) {
      console.log('deleteLocalSong: File does not exist at path:', cleanPath);
      // Still try to clean up metadata cache
      try {
        const {
          localTracksMetadataProcessor,
        } = require('./LocalTracksMetadataProcessor');
        const {
          localTracksMetadataManager,
        } = require('./LocalTracksMetadataManager');
        const trackId = localTracksMetadataProcessor.generateTrackId(cleanPath);
        await localTracksMetadataManager.removeMetadata(trackId);
        console.log(
          'deleteLocalSong: Cleaned up metadata for non-existent file',
        );
      } catch (metaError) {
        console.warn(
          'deleteLocalSong: Failed to remove metadata for non-existent file:',
          metaError,
        );
      }
      return {success: true, alreadyDeleted: true};
    }

    // Generate track ID before deleting
    const {
      localTracksMetadataProcessor,
    } = require('./LocalTracksMetadataProcessor');
    const {
      localTracksMetadataManager,
    } = require('./LocalTracksMetadataManager');
    const trackId = localTracksMetadataProcessor.generateTrackId(cleanPath);

    // Check if file is deletable (not in protected directories)
    if (!isFileDeletable(cleanPath)) {
      console.warn(
        'deleteLocalSong: File is in protected/system directory:',
        cleanPath,
      );
      return {
        success: false,
        error:
          'Cannot delete files in system directories (Alarms, Ringtones, Notifications, etc.). Please use your device file manager.',
        isProtected: true,
      };
    }

    console.log('deleteLocalSong: Attempting to unlink file...');

    // Check if it's a directory
    try {
      const stat = await ReactNativeBlobUtil.fs.stat(cleanPath);
      console.log('deleteLocalSong: File stat:', stat);

      if (stat.type === 'directory') {
        console.error('deleteLocalSong: Path is a directory, not a file');
        return {
          success: false,
          error: 'Cannot delete directories. Please delete individual files.',
        };
      }
    } catch (statError) {
      console.warn('deleteLocalSong: Could not stat file:', statError);
    }

    // Try direct deletion
    try {
      await ReactNativeBlobUtil.fs.unlink(cleanPath);
      console.log('deleteLocalSong: Unlink successful');
    } catch (unlinkError) {
      console.error('deleteLocalSong: Direct unlink failed:', unlinkError);

      // Parse error to provide better message
      const errorMsg = unlinkError.message || unlinkError.toString();
      if (
        errorMsg.includes('EACCES') ||
        errorMsg.includes('Permission denied')
      ) {
        return {
          success: false,
          error:
            'Permission denied. Try using your device file manager or grant storage permissions.',
        };
      } else if (errorMsg.includes('EISDIR')) {
        return {
          success: false,
          error: 'Cannot delete folders, only files.',
        };
      } else if (errorMsg.includes('EBUSY')) {
        return {
          success: false,
          error: 'File is currently in use.',
        };
      }

      throw unlinkError;
    }

    // Force refresh Android MediaStore
    if (Platform.OS === 'android') {
      try {
        await ReactNativeBlobUtil.fs.scanFile([
          {path: cleanPath, mime: 'audio/*'},
        ]);
        console.log('deleteLocalSong: MediaStore scan completed');
      } catch (scanError) {
        console.warn('deleteLocalSong: MediaStore scan failed:', scanError);
      }
    }

    // Verify deletion with a small delay
    await new Promise(resolve => setTimeout(resolve, 150));
    const stillExists = await ReactNativeBlobUtil.fs.exists(cleanPath);
    console.log(
      'deleteLocalSong: File still exists after deletion:',
      stillExists,
    );

    if (stillExists) {
      console.error(
        'deleteLocalSong: File still exists after unlink:',
        cleanPath,
      );
      return {
        success: false,
        error:
          'Permission denied. Try deleting from your file manager instead.',
      };
    }

    // Remove from metadata cache
    try {
      await localTracksMetadataManager.removeMetadata(trackId);
      console.log('deleteLocalSong: Metadata cache cleared for:', trackId);
    } catch (metaError) {
      console.warn(
        'deleteLocalSong: Failed to remove metadata cache:',
        metaError,
      );
    }

    console.log('deleteLocalSong: Deletion completed successfully');
    return {success: true};
  } catch (e) {
    console.error('deleteLocalSong: Error deleting file:', e);
    console.error('deleteLocalSong: Error details:', e.message, e.code);

    let errorMessage = 'Permission denied';
    if (e.message && e.message.includes('ENOENT')) {
      errorMessage = 'File not found';
    } else if (e.message && e.message.includes('EACCES')) {
      errorMessage = 'Permission denied. Cannot delete files in this location.';
    } else if (e.message && e.message.includes('EBUSY')) {
      errorMessage = 'File is in use';
    } else if (e.message) {
      errorMessage = e.message;
    }

    return {success: false, error: errorMessage};
  }
}
