/**
 * Stream Cache Utilities
 * 
 * Helper functions for caching stream URLs from YTMusic and DAB.
 * Stream URLs are cached for 3 hours as per user specification.
 * 
 * Usage:
 * import { getCachedStreamUrl, cacheStreamUrl } from '../Utils/StreamCacheUtils';
 * 
 * // Before fetching stream URL:
 * const cachedUrl = getCachedStreamUrl(videoId, 'ytmusic');
 * if (cachedUrl) {
 *   return cachedUrl; // Use cached URL
 * }
 * 
 * // After fetching stream URL:
 * const freshUrl = await fetchStreamUrl(videoId);
 * cacheStreamUrl(videoId, freshUrl, 'ytmusic');
 */

import { CacheManager } from './NavigationCacheManager';

/**
 * Get cached stream URL if available
 * @param {string} videoId - Video/track ID
 * @param {string} source - 'ytmusic' or 'dab'
 * @returns {string|null} - Cached URL or null
 */
export function getCachedStreamUrl(videoId, source = 'ytmusic') {
    if (!videoId) return null;
    return CacheManager.getStreamUrl(videoId, source);
}

/**
 * Cache a stream URL
 * @param {string} videoId - Video/track ID
 * @param {string} url - Stream URL to cache
 * @param {string} source - 'ytmusic' or 'dab'
 */
export function cacheStreamUrl(videoId, url, source = 'ytmusic') {
    if (!videoId || !url) return;
    CacheManager.setStreamUrl(videoId, url, source);
}

/**
 * Check if stream URL is cached
 * @param {string} videoId - Video/track ID
 * @param {string} source - 'ytmusic' or 'dab'
 * @returns {boolean}
 */
export function hasStreamUrl(videoId, source = 'ytmusic') {
    return CacheManager.hasStreamUrl(videoId, source);
}

/**
 * Get or fetch stream URL with caching
 * This is a convenience wrapper that checks cache first
 * 
 * @param {string} videoId - Video/track ID
 * @param {function} fetchFn - Async function to fetch URL if not cached
 * @param {string} source - 'ytmusic' or 'dab'
 * @returns {Promise<string|null>} - Stream URL or null
 */
export async function getOrFetchStreamUrl(videoId, fetchFn, source = 'ytmusic') {
    if (!videoId) return null;

    // Check cache first
    const cached = getCachedStreamUrl(videoId, source);
    if (cached) {
        console.log(`[StreamCache] Using cached URL for ${source}:${videoId}`);
        return cached;
    }

    // Fetch fresh URL
    try {
        console.log(`[StreamCache] Fetching fresh URL for ${source}:${videoId}`);
        const freshUrl = await fetchFn();

        if (freshUrl) {
            // Cache for 3 hours
            cacheStreamUrl(videoId, freshUrl, source);
            return freshUrl;
        }

        return null;
    } catch (error) {
        console.error(`[StreamCache] Error fetching stream URL:`, error);
        return null;
    }
}

/**
 * Clear all stream cache
 */
export function clearAllStreamCache() {
    CacheManager.clearStreamCache();
}

/**
 * Batch cache multiple stream URLs
 * @param {Array<{videoId: string, url: string, source: string}>} streams
 */
export function batchCacheStreamUrls(streams) {
    if (!Array.isArray(streams)) return;

    streams.forEach(({ videoId, url, source = 'ytmusic' }) => {
        if (videoId && url) {
            CacheManager.setStreamUrl(videoId, url, source);
        }
    });

    console.log(`[StreamCache] Batch cached ${streams.length} stream URLs`);
}
