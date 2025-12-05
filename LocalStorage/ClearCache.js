import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer from "react-native-track-player";

const CACHE_KEYS = {
  SEARCH_HISTORY: 'SearchHistory',
  LIKED_SONGS: 'LikedSongs',
  LIKED_PLAYLISTS: 'LikedPlaylists',
  QUEUE: 'queue',
  LAST_SONG: 'LastSong',
  IMAGE_CACHE: 'ImageCache',
  // Settings are not included in cache clearing
};

async function GetCacheSizes() {
  try {
    const sizes = {};
    let totalSize = 0;

    for (const [key, value] of Object.entries(CACHE_KEYS)) {
      try {
        const data = await AsyncStorage.getItem(value);
        const size = data ? new Blob([data]).size : 0;
        sizes[key] = size;
        totalSize += size;
      } catch (e) {
        sizes[key] = 0;
      }
    }

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
    
    for (const key of selectedKeys) {
      if (CACHE_KEYS[key]) {
        keysToRemove.push(CACHE_KEYS[key]);
      }
    }

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      
      // If queue was cleared, stop playback
      if (selectedKeys.includes('QUEUE') || selectedKeys.includes('LAST_SONG')) {
        try {
          await TrackPlayer.reset();
        } catch (e) {
          console.log("TrackPlayer reset error (may not be initialized):", e);
        }
      }
      
      return true;
    }
    
    return false;
  } catch (e) {
    console.error("Error clearing selected cache:", e);
    return false;
  }
}

async function ClearAllCache() {
  try {
    const allKeys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(allKeys);
    
    // Stop playback
    try {
      await TrackPlayer.reset();
    } catch (e) {
      console.log("TrackPlayer reset error (may not be initialized):", e);
    }
    
    return true;
  } catch (e) {
    console.error("Error clearing all cache:", e);
    return false;
  }
}

export { GetCacheSizes, ClearSelectedCache, ClearAllCache, CACHE_KEYS };
