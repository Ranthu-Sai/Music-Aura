import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer from "react-native-track-player";

import ReactNativeBlobUtil from "react-native-blob-util";

const CACHE_KEYS = {
  SEARCH_HISTORY: ['SearchHistory'],
  RECENTLY_PLAYED: ['orbit_listening_history', 'orbit_weekly_stats'],
  LIKED_SONGS: ['LikedSongs'],
  LIKED_PLAYLISTS: ['LikedPlaylists'],
  USER_PLAYLISTS: ['user_playlists'],
  QUEUE: ['queue'],
  LAST_SONG: ['LastSong'],
  IMAGE_CACHE: ['ImageCache'],
};

async function GetCacheSizes() {
  try {
    const sizes = {
      SEARCH_HISTORY: 0,
      RECENTLY_PLAYED: 0,
      LIKED_SONGS: 0,
      LIKED_PLAYLISTS: 0,
      USER_PLAYLISTS: 0,
      QUEUE: 0,
      LAST_SONG: 0,
      IMAGE_CACHE: 0,
      SONG_CACHE: 0,
      OFFLINE_DOWNLOADS: 0,
    };

    // 1. AsyncStorage sizes (Optimized with multiGet)
    const allStorageKeys = [];
    const keyMap = {}; // Map storage key back to category key

    Object.entries(CACHE_KEYS).forEach(([cat, keys]) => {
      keys.forEach(k => {
        allStorageKeys.push(k);
        keyMap[k] = cat;
      });
    });

    const results = await AsyncStorage.multiGet(allStorageKeys);

    results.forEach(([key, value]) => {
      const cat = keyMap[key];
      if (value) {
        // Calculate size in bytes (string length is approximate byte size)
        const size = new Blob([value]).size || value.length;
        sizes[cat] = (sizes[cat] || 0) + size;
      }
    });

    // 2. Filesystem sizes
    const { getAppStorageDynamics } = require('../Utils/StorageUtils');
    const dynamic = await getAppStorageDynamics();

    sizes.SONG_CACHE = dynamic.songCache || 0;
    sizes.OFFLINE_DOWNLOADS = dynamic.downloads || 0;
    sizes.IMAGE_CACHE = (sizes.IMAGE_CACHE || 0) + (dynamic.imageCache || 0);

    // Calculate total
    sizes.TOTAL = Object.keys(sizes).reduce((total, key) => {
      if (key !== 'TOTAL') {
        return total + (sizes[key] || 0);
      }
      return total;
    }, 0);

    return sizes;
  } catch (e) {
    console.error("Error getting cache sizes:", e);
    return {
      TOTAL: 0,
      SEARCH_HISTORY: 0,
      RECENTLY_PLAYED: 0,
      LIKED_SONGS: 0,
      LIKED_PLAYLISTS: 0,
      USER_PLAYLISTS: 0,
      QUEUE: 0,
      LAST_SONG: 0,
      IMAGE_CACHE: 0,
      SONG_CACHE: 0,
      OFFLINE_DOWNLOADS: 0,
    };
  }
}

async function ClearSelectedCache(selectedKeys) {
  try {
    const storageKeysToRemove = [];
    const dirs = ReactNativeBlobUtil.fs.dirs;
    const FastImage = require('react-native-fast-image');

    for (const key of selectedKeys) {
      if (CACHE_KEYS[key]) {
        storageKeysToRemove.push(...CACHE_KEYS[key]);

        // Specific logic for Image Cache (native side)
        if (key === 'IMAGE_CACHE') {
          try {
            await FastImage.clearDiskCache();
            await FastImage.clearMemoryCache();

            // Also manually clear image directories identified in StorageUtils
            const imageDirs = [
              `${dirs.CacheDir}/image_manager_disk_cache`,
              `${dirs.CacheDir}/com.bumptech.glide.manager`,
              `${dirs.CacheDir}/ImageCache`,
            ];
            for (const path of imageDirs) {
              if (await ReactNativeBlobUtil.fs.exists(path)) {
                await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
              }
            }
          } catch (e) { }
        }
      }

      if (key === 'SONG_CACHE' || key === 'IMAGE_CACHE') {
        // Targeted filesystem clearing based on the same logic as counting
        try {
          if (await ReactNativeBlobUtil.fs.exists(dirs.CacheDir)) {
             const files = await ReactNativeBlobUtil.fs.ls(dirs.CacheDir);

             for (const fileName of files) {
               const filePath = `${dirs.CacheDir}/${fileName}`;
               const stats = await ReactNativeBlobUtil.fs.stat(filePath).catch(() => null);
               if (!stats) {continue;}

               let shouldRemove = false;

               if (key === 'IMAGE_CACHE') {
                 // Remove small files or image-related directories
                 if (stats.type === 'file' && parseInt(stats.size) < 1024 * 1024) {
                   shouldRemove = true;
                 } else if (stats.type === 'directory' && (fileName.includes('image') || fileName.includes('cache'))) {
                   shouldRemove = true;
                 }
               } else if (key === 'SONG_CACHE') {
                 // Remove larger files or other directories
                 if (stats.type === 'file' && parseInt(stats.size) >= 1024 * 1024) {
                   shouldRemove = true;
                 } else if (stats.type === 'directory' && !fileName.includes('image') && !fileName.includes('cache')) {
                   shouldRemove = true;
                 }
               }

               if (shouldRemove) {
                 await ReactNativeBlobUtil.fs.unlink(filePath).catch(() => {});
               }
             }
          }
        } catch (e) { }
      } else if (key === 'OFFLINE_DOWNLOADS') {
        // Delete both possible dedicated downloads folders
        const paths = [
          `${dirs.LegacyDownloadDir}/Music Aura`,
          `${dirs.LegacyMusicDir}/Music Aura`,
        ];

        for (const downloadPath of paths) {
          try {
            if (await ReactNativeBlobUtil.fs.exists(downloadPath)) {
              // Delete the directory and its contents
              await ReactNativeBlobUtil.fs.unlink(downloadPath);
              // Recreate empty directory
              await ReactNativeBlobUtil.fs.mkdir(downloadPath);
              // Scan to update MediaStore
              await ReactNativeBlobUtil.fs.scanFile([{ path: downloadPath }]);
              console.log(`Cleared offline downloads at: ${downloadPath}`);
            }
          } catch (err) {
            console.warn(`Failed to clear downloads at ${downloadPath}:`, err);
          }
        }

        // Clear downloaded songs metadata from AsyncStorage
        try {
          await AsyncStorage.removeItem('downloadedSongsMetadata');
          console.log('Cleared downloaded songs metadata');
        } catch (err) {
          console.warn('Failed to clear downloaded songs metadata:', err);
        }
      }
    }

    if (storageKeysToRemove.length > 0) {
      await AsyncStorage.multiRemove(storageKeysToRemove);
    }

    // Performance/State updates
    if (selectedKeys.includes('QUEUE') || selectedKeys.includes('LAST_SONG') || selectedKeys.includes('SONG_CACHE')) {
      try {
        await TrackPlayer.reset();
      } catch (e) { }
    }

    return true;
  } catch (e) {
    console.error("Error clearing selected cache:", e);
    return false;
  }
}

async function ClearAllCache() {
  try {
    const allKeys = Object.keys(CACHE_KEYS);
    // Add the virtual filesystem keys
    return await ClearSelectedCache([...allKeys, 'SONG_CACHE', 'OFFLINE_DOWNLOADS']);
  } catch (e) {
    console.error("Error clearing all cache:", e);
    return false;
  }
}

export { GetCacheSizes, ClearSelectedCache, ClearAllCache, CACHE_KEYS };
