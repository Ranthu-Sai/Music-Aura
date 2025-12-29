import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer from "react-native-track-player";

import ReactNativeBlobUtil from "react-native-blob-util";

const CACHE_KEYS = {
  SEARCH_HISTORY: 'SearchHistory',
  LIKED_SONGS: 'LikedSongs',
  LIKED_PLAYLISTS: 'LikedPlaylists',
  QUEUE: 'queue',
  LAST_SONG: 'LastSong',
  IMAGE_CACHE: 'ImageCache',
};

async function GetCacheSizes() {
  try {
    const sizes = {};
    let totalSize = 0;

    // 1. AsyncStorage sizes
    for (const [key, value] of Object.entries(CACHE_KEYS)) {
      try {
        const data = await AsyncStorage.getItem(value);
        // AsyncStorage stores strings, so length is a good byte approximation
        const size = data ? data.length : 0;
        sizes[key] = size;
        totalSize += size;
      } catch (e) {
        sizes[key] = 0;
      }
    }

    // 2. Filesystem sizes
    const { getAppStorageDynamics } = require('../Utils/StorageUtils');
    const dynamic = await getAppStorageDynamics();

    sizes['SONG_CACHE'] = dynamic.songCache || 0;
    sizes['OFFLINE_DOWNLOADS'] = dynamic.downloads || 0;

    totalSize += sizes['SONG_CACHE'];
    totalSize += sizes['OFFLINE_DOWNLOADS'];

    sizes.TOTAL = totalSize;
    return sizes;
  } catch (e) {
    console.error("Error getting cache sizes:", e);
    return { TOTAL: 0 };
  }
}

async function ClearSelectedCache(selectedKeys) {
  try {
    const keysToRemove = [];
    const dirs = ReactNativeBlobUtil.fs.dirs;
    const FastImage = require('react-native-fast-image');

    for (const key of selectedKeys) {
      if (CACHE_KEYS[key]) {
        keysToRemove.push(CACHE_KEYS[key]);

        // Specific logic for Image Cache (native side)
        if (key === 'IMAGE_CACHE') {
          try {
            await FastImage.clearDiskCache();
            await FastImage.clearMemoryCache();
          } catch (e) {
            console.log("FastImage clear error:", e);
          }
        }
      } else if (key === 'SONG_CACHE') {
        // Clear everything in the app cache directory (temporary files)
        try {
          const files = await ReactNativeBlobUtil.fs.ls(dirs.CacheDir);
          for (const file of files) {
            // Don't delete the folder itself, just contents
            await ReactNativeBlobUtil.fs.unlink(`${dirs.CacheDir}/${file}`).catch(() => { });
          }
        } catch (e) { }
      } else if (key === 'OFFLINE_DOWNLOADS') {
        // Delete the dedicated downloads folder
        const downloadPath = `${dirs.LegacyDownloadDir}/Music Aura`;
        if (await ReactNativeBlobUtil.fs.exists(downloadPath)) {
          await ReactNativeBlobUtil.fs.unlink(downloadPath);
          // Re-create the empty directory to avoid issues
          await ReactNativeBlobUtil.fs.mkdir(downloadPath).catch(() => { });
        }
      }
    }

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
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
