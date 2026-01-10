import NetInfo from '@react-native-community/netinfo';
import {apiCache, lyricsCache} from './LRUCache';

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
        // Backfill missing provider info for lyrics so callers can identify source
        if (type === 'lyrics' && cachedData?.data && !cachedData.data.source) {
          // Prefer explicit source fields if present
          cachedData.data.source =
            cachedData.data.source ||
            cachedData.source ||
            (cachedData.data.attemptedSources && cachedData.data.attemptedSources[0]) ||
            (cachedData.attemptedSources && cachedData.attemptedSources[0]) ||
            'unknown';
        }

        // Invalidate cache entries that reference deprecated providers so they are refreshed.
        const DEPRECATED_LYRICS_PROVIDERS = ['RenderAPI', 'RenderAPI_Alt'];
        const providerName = (cachedData?.data?.source || cachedData?.source || '').toString();
        const isRequestedRenderAPI = key && key.toLowerCase().includes('_renderapi_');
        if (
          type === 'lyrics' &&
          providerName &&
          DEPRECATED_LYRICS_PROVIDERS.includes(providerName) &&
          !isRequestedRenderAPI
        ) {
          try {
            await manager.remove(key);

          } catch (e) {
            console.warn(`[CacheManager] Failed to remove deprecated cached lyrics for ${key}:`, e && e.message);
          }
          // Continue to fetch fresh data instead of returning the deprecated cache
        } else {
          // Check for likely incomplete cached lyrics and invalidate if necessary.
          if (type === 'lyrics' && cachedData?.data) {
            try {
              const plain = String(cachedData.data.lyrics || '').replace(/<br>/g, '').trim();
              const plainLen = plain.length;
              const timedArr = Array.isArray(cachedData.data.timed_lyrics)
                ? cachedData.data.timed_lyrics
                : Array.isArray(cachedData.timed_lyrics)
                ? cachedData.timed_lyrics
                : [];
              const timedCount = timedArr.length;

              // If cached lyrics are suspiciously short, invalidate and fetch fresh data.
              // Thresholds chosen conservatively: <100 chars or <3 timed lines look incomplete.
              if ((plainLen > 0 && plainLen < 100) || (timedCount > 0 && timedCount < 3)) {
                try {
                  await manager.remove(key);

                } catch (e) {
                  console.warn(`[CacheManager] Failed to remove incomplete cached lyrics for ${key}:`, e && e.message);
                }
                // Continue to fetch fresh data instead of returning the deprecated cache
              } else {
                // Return cached data if available (even if offline)
                return {...cachedData, fromCache: true, offline: !online};
              }
            } catch (e) {
              // If any error occurs during validation, fall back to returning cached data
              return {...cachedData, fromCache: true, offline: !online};
            }
          } else {
            // Return cached data if available (even if offline)
            return {...cachedData, fromCache: true, offline: !online};
          }
        }
      }
    }

    if (!online) {
      return {success: false, error: 'Network unavailable', offline: true};
    }

    const data = await fetchFunction();

    // Only cache successful responses
    if (data && data.success !== false && !data.error) {
      // Backfill source into lyrics data if missing so callers can read it directly
      if (type === 'lyrics' && data?.data && !data.data.source) {
        data.data.source = data.source || data.data.attemptedSources?.[0] || data.attemptedSources?.[0] || 'unknown';
      }
      await manager.set(key, data, expiration);
    }

    return data;
  } catch (error) {
    console.error(`[CacheManager] Error for ${key}:`, error);
    return {success: false, error: error.message};
  }
};

export const clearAllCache = async () => {
  await apiCache.clear();
  await lyricsCache.clear();
};
