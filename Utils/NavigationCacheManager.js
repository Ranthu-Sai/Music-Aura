/**
 * Navigation Cache Manager
 *
 * Centralized caching system for screen data, stream URLs, and UI state.
 * Eliminates unnecessary API calls on back navigation by providing
 * instant cached data when available.
 *
 * Features:
 * - In-memory cache with TTL per entry
 * - LRU cache eviction to prevent memory bloat
 * - Stream URL caching (3 hours for YTMusic/DAB)
 * - Scroll position preservation
 * - Search state persistence
 */

import { CACHE_TTL, CACHE_LIMITS, isCacheStale } from './CacheConfig';
const LOG_VERBOSE = false;
const debugLog = (...args) => { if (LOG_VERBOSE) { console.log(...args); } };

class NavigationCacheManager {
    constructor() {
        // Main data cache: { key: { data, timestamp, ttl } }
        this.cache = new Map();

        // Stream URL cache: { videoId: { url, timestamp, ttl, source } }
        this.streamCache = new Map();

        // Scroll position cache: { screenKey: position }
        this.scrollCache = new Map();

        // Search state cache: { query, results, filters, timestamp }
        this.searchState = null;

        // Access order for LRU eviction
        this.accessOrder = [];
    }

    // ============================================
    // MAIN DATA CACHE METHODS
    // ============================================

    /**
     * Get cached data
     * @param {string} key - Cache key
     * @returns {any|null} - Cached data or null if not found/stale
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if cache is stale
        if (isCacheStale(entry.timestamp, entry.ttl)) {
            this.cache.delete(key);
            this._removeFromAccessOrder(key);
            return null;
        }

        // Update access order for LRU
        this._updateAccessOrder(key);

        return entry.data;
    }

    /**
     * Set cache data with TTL
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time-to-live in milliseconds
     */
    set(key, data, ttl = CACHE_TTL.DEFAULT) {
        // Enforce cache size limit
        this._enforceLimit();

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });

        this._updateAccessOrder(key);
    }

    /**
     * Check if cache has valid (non-stale) data
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Invalidate specific cache entry
     * @param {string} key - Cache key to invalidate
     */
    invalidate(key) {
        this.cache.delete(key);
        this._removeFromAccessOrder(key);
    }

    /**
     * Invalidate all entries matching a prefix
     * @param {string} prefix - Key prefix to match
     */
    invalidateByPrefix(prefix) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
            }
        }
    }

    /**
     * Clear all cache data
     */
    invalidateAll() {
        this.cache.clear();
        this.accessOrder = [];
    }

    // ============================================
    // STREAM URL CACHE METHODS (3-hour TTL)
    // ============================================

    /**
     * Get cached stream URL
     * @param {string} videoId - Video/track ID
     * @param {string} source - 'ytmusic' or 'dab'
     * @returns {string|null} - Cached URL or null
     */
    getStreamUrl(videoId, source = 'ytmusic') {
        debugLog(`[CacheManager v2] Getting stream URL for ${source}:${videoId}`);
        const key = `${source}_${videoId}`;
        const entry = this.streamCache.get(key);

        if (!entry) {
            return null;
        }

        // Check if stream cache is stale
        if (isCacheStale(entry.timestamp, entry.ttl)) {
            this.streamCache.delete(key);
            return null;
        }

        // CRITICAL: Validate cached URL before returning
        if (!entry.url || typeof entry.url !== 'string') {
            console.warn(`[CacheManager] Invalid cached URL type for ${source}:${videoId}, clearing cache`);
            this.streamCache.delete(key);
            return null;
        }

        const url = entry.url.trim();
        if (!url) {
            console.warn(`[CacheManager] Empty cached URL for ${source}:${videoId}, clearing cache`);
            this.streamCache.delete(key);
            return null;
        }

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.warn(`[CacheManager] Invalid cached URL protocol for ${source}:${videoId}: ${url.substring(0, 50)}, clearing cache`);
            this.streamCache.delete(key);
            return null;
        }

        debugLog(`[CacheManager] Stream URL cache HIT for ${source}:${videoId}`);
        return url;
    }

    /**
     * Cache stream URL with 3-hour TTL
     * @param {string} videoId - Video/track ID
     * @param {string} url - Stream URL
     * @param {string} source - 'ytmusic' or 'dab'
     */
    setStreamUrl(videoId, url, source = 'ytmusic') {
        if (!videoId || !url) {
            console.warn('[CacheManager] Cannot cache stream URL: missing videoId or url');
            return;
        }

        // CRITICAL: Validate URL before caching
        if (typeof url !== 'string') {
            console.warn(`[CacheManager] Cannot cache stream URL: url must be a string, got ${typeof url}`);
            return;
        }

        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            console.warn('[CacheManager] Cannot cache stream URL: empty string');
            return;
        }

        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            console.warn(`[CacheManager] Cannot cache stream URL: invalid protocol: ${trimmedUrl.substring(0, 50)}`);
            return;
        }

        // Enforce stream cache limit
        this._enforceStreamLimit();

        const ttl = source === 'ytmusic' ? CACHE_TTL.YTMUSIC_STREAM : CACHE_TTL.DAB_STREAM;
        const key = `${source}_${videoId}`;

        this.streamCache.set(key, {
            url: trimmedUrl,  // Store validated URL
            timestamp: Date.now(),
            ttl,
            source,
        });

        debugLog(`[CacheManager] Stream URL cached for ${source}:${videoId} (TTL: ${ttl / 1000 / 60} minutes)`);
    }

    /**
     * Check if stream URL is cached and valid
     * @param {string} videoId - Video/track ID
     * @param {string} source - 'ytmusic' or 'dab'
     * @returns {boolean}
     */
    hasStreamUrl(videoId, source = 'ytmusic') {
        return this.getStreamUrl(videoId, source) !== null;
    }

    /**
     * Clear all stream URL cache
     */
    clearStreamCache() {
        this.streamCache.clear();
    }

    /**
     * Clear cached stream URL for a specific video
     * @param {string} videoId
     * @param {string} source
     */
    clearStreamUrl(videoId, source = 'ytmusic') {
        const key = `${source}_${videoId}`;
        if (this.streamCache.has(key)) {
            this.streamCache.delete(key);
            console.log(`[CacheManager] Cleared stream cache for ${source}:${videoId}`);
        }
    }
    // ============================================
    // SCROLL POSITION METHODS
    // ============================================

    /**
     * Get saved scroll position
     * @param {string} screenKey - Screen identifier
     * @returns {number} - Scroll position (0 if not found)
     */
    getScrollPosition(screenKey) {
        const entry = this.scrollCache.get(screenKey);

        if (!entry) {
            return 0;
        }

        // Check if scroll position is stale
        if (isCacheStale(entry.timestamp, CACHE_TTL.SCROLL_POSITION)) {
            this.scrollCache.delete(screenKey);
            return 0;
        }

        return entry.position;
    }

    /**
     * Save scroll position
     * @param {string} screenKey - Screen identifier
     * @param {number} position - Scroll position
     */
    setScrollPosition(screenKey, position) {
        // Limit scroll cache size
        if (this.scrollCache.size >= CACHE_LIMITS.MAX_SCROLL_ENTRIES) {
            const firstKey = this.scrollCache.keys().next().value;
            this.scrollCache.delete(firstKey);
        }

        this.scrollCache.set(screenKey, {
            position,
            timestamp: Date.now(),
        });
    }

    /**
     * Clear all scroll positions
     */
    clearScrollPositions() {
        this.scrollCache.clear();
    }

    // ============================================
    // SEARCH STATE METHODS
    // ============================================

    /**
     * Get saved search state
     * @returns {object|null} - Search state or null
     */
    getSearchState() {
        if (!this.searchState) {
            return null;
        }

        // Check if search state is stale
        if (isCacheStale(this.searchState.timestamp, CACHE_TTL.SEARCH_QUERY)) {
            this.searchState = null;
            return null;
        }

        return this.searchState;
    }

    /**
     * Save search state
     * @param {object} state - Search state to save
     */
    setSearchState(state) {
        this.searchState = {
            ...state,
            timestamp: Date.now(),
        };
    }

    /**
     * Clear search state
     */
    clearSearchState() {
        this.searchState = null;
    }

    // ============================================
    // INTERNAL HELPER METHODS
    // ============================================

    /**
     * Update LRU access order
     * @private
     */
    _updateAccessOrder(key) {
        this._removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * Remove key from access order
     * @private
     */
    _removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * Enforce main cache size limit using LRU eviction
     * @private
     */
    _enforceLimit() {
        while (this.cache.size >= CACHE_LIMITS.MAX_ENTRIES && this.accessOrder.length > 0) {
            const oldestKey = this.accessOrder.shift();
            this.cache.delete(oldestKey);
            console.log(`[CacheManager] LRU eviction: removed ${oldestKey}`);
        }
    }

    /**
     * Enforce stream cache size limit
     * @private
     */
    _enforceStreamLimit() {
        if (this.streamCache.size >= CACHE_LIMITS.MAX_STREAM_ENTRIES) {
            // Remove oldest entries (first inserted)
            const keysToRemove = Array.from(this.streamCache.keys()).slice(0, 10);
            keysToRemove.forEach(key => this.streamCache.delete(key));
            console.log(`[CacheManager] Stream cache cleanup: removed ${keysToRemove.length} entries`);
        }
    }

    // ============================================
    // DEBUG / MONITORING METHODS
    // ============================================

    /**
     * Get cache statistics
     * @returns {object} - Cache stats
     */
    getStats() {
        return {
            mainCacheSize: this.cache.size,
            streamCacheSize: this.streamCache.size,
            scrollCacheSize: this.scrollCache.size,
            hasSearchState: this.searchState !== null,
            accessOrderLength: this.accessOrder.length,
        };
    }

    /**
     * Log cache status for debugging
     */
    logStatus() {
        const stats = this.getStats();
        console.log('[CacheManager] Status:', JSON.stringify(stats, null, 2));
    }
}

// Export singleton instance
export const CacheManager = new NavigationCacheManager();

// Also export class for testing purposes
export default NavigationCacheManager;
