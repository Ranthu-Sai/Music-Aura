import NetInfo from '@react-native-community/netinfo';
import { apiCache, lyricsCache } from './LRUCache';

const DEFAULT_CACHE_EXPIRATION = 60 * 24; // 24 hours

const isNetworkAvailable = async () => {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable;
};

/**
 * Get cached data or fetch from API
 * @param {string} key Cache key
 * @param {Function} fetchFunction Function to fetch data if not cached
 * @param {Object} options { expiration: minutes, forceRefresh: boolean, type: 'api'|'lyrics' }
 */
export const getCachedData = async (key, fetchFunction, options = {}) => {
    const {
        expiration = DEFAULT_CACHE_EXPIRATION,
        forceRefresh = false,
        type = 'api',
    } = options;

    const manager = type === 'lyrics' ? lyricsCache : apiCache;

    try {
        const online = await isNetworkAvailable();

        if (!forceRefresh) {
            const cachedData = await manager.get(key);
            if (cachedData) {
                // Return cached data if available (even if offline)
                return { ...cachedData, fromCache: true, offline: !online };
            }
        }

        if (!online) {
            return { success: false, error: 'Network unavailable', offline: true };
        }

        const data = await fetchFunction();

        // Only cache successful responses
        if (data && data.success !== false && !data.error) {
            await manager.set(key, data, expiration);
        }

        return data;
    } catch (error) {
        console.error(`[CacheManager] Error for ${key}:`, error);
        return { success: false, error: error.message };
    }
};

export const clearAllCache = async () => {
    await apiCache.clear();
    await lyricsCache.clear();
};
