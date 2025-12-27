/**
 * StreamFetchManager
 *
 * Manages stream URL fetching with abort support and deduplication
 * to prevent multiple concurrent fetches for the same track.
 *
 * Features:
 * - Request deduplication
 * - Abort controller support
 * - Request caching with strict TTL validation
 * - Automatic cleanup of cancelled requests
 */

class StreamFetchManager {
    constructor() {
        this.activeRequests = new Map(); // videoId -> { promise, abortController, timestamp }
        this.requestCache = new Map(); // videoId -> { url, headers, timestamp }
        // YouTube stream URLs expire quickly - cache for max 2 minutes
        this.cacheTTL = 2 * 60 * 1000; // 2 minutes (reduced from 5 for URL freshness)
    }

    /**
     * Fetch stream URL with deduplication and abort support
     *
     * @param {string} videoId - YouTube video ID
     * @param {Function} fetchFunction - Function that performs the actual fetch
     * @param {AbortSignal} signal - Optional abort signal from parent operation
     * @returns {Promise<{url: string, headers: object, thumbnail?: string, duration?: number}>}
     */
    async fetchStream(videoId, fetchFunction, signal = null) {
        // Check cache first
        const cached = this.getCachedStream(videoId);
        if (cached) {
            return cached;
        }

        // Check if already fetching
        if (this.activeRequests.has(videoId)) {
            console.log(`⏳ Reusing in-flight request for ${videoId}`);
            const activeRequest = this.activeRequests.get(videoId);

            // If parent operation was cancelled, cancel this request too
            if (signal?.aborted) {
                activeRequest.abortController.abort();
                this.activeRequests.delete(videoId);
                throw new Error('AbortError');
            }

            return await activeRequest.promise;
        }

        // Create new fetch request
        const abortController = new AbortController();

        // Removed timeout limit for native streaming
        // const REQUEST_TIMEOUT_MS = 8000; // 8 seconds
        // const timeoutId = setTimeout(() => {
        //     try { abortController.abort(); } catch (e) { }
        // }, REQUEST_TIMEOUT_MS);

        // Link parent abort signal if provided
        if (signal) {
            signal.addEventListener('abort', () => {
                abortController.abort();
            });
        }

        const fetchPromise = (async () => {
            try {
                const result = await fetchFunction(videoId, abortController.signal);

                // Validate result before caching
                if (!result || !result.url || result.url.startsWith('ytmusic://')) {
                    console.error(`❌ Invalid stream URL received for ${videoId}`);
                    throw new Error('Invalid stream URL');
                }

                // Cache the result
                this.cacheStream(videoId, result);

                return result;
            } catch (error) {
                // Don't cache errors
                throw error;
            } finally {
                // Clean up active request
                this.activeRequests.delete(videoId);
                // Removed timeout cleanup since timeout is disabled
                // try { clearTimeout(timeoutId); } catch (e) {}
            }
        })();

        // Store active request
        this.activeRequests.set(videoId, {
            promise: fetchPromise,
            abortController,
            timestamp: Date.now(),
        });

        return fetchPromise;
    }

    /**
     * Get cached stream if available and not expired
     * @private
     */
    getCachedStream(videoId) {
        const cached = this.requestCache.get(videoId);
        if (!cached) {return null;}

        // Check if expired
        const age = Date.now() - cached.timestamp;
        if (age > this.cacheTTL) {
            console.log(`🗑️ Cache expired for ${videoId} (age: ${Math.round(age / 1000)}s)`);
            this.requestCache.delete(videoId);
            return null;
        }

        // Validate URL still looks correct (not a placeholder)
        if (!cached.url || cached.url.startsWith('ytmusic://')) {
            console.log(`❌ Invalid cached URL for ${videoId}`);
            this.requestCache.delete(videoId);
            return null;
        }

        console.log(`✅ Cache hit for ${videoId} (age: ${Math.round(age / 1000)}s)`);
        return {
            url: cached.url,
            headers: cached.headers,
            thumbnail: cached.thumbnail,
            duration: cached.duration,
        };
    }

    /**
     * Cache stream result
     * @private
     */
    cacheStream(videoId, result) {
        this.requestCache.set(videoId, {
            url: result.url,
            headers: result.headers,
            thumbnail: result.thumbnail,
            duration: result.duration,
            timestamp: Date.now(),
        });
    }

    /**
     * Cancel all active requests
     */
    cancelAllRequests() {
        console.log(`🚫 Cancelling ${this.activeRequests.size} active stream requests`);

        for (const [videoId, request] of this.activeRequests.entries()) {
            request.abortController.abort();
        }

        this.activeRequests.clear();
    }

    /**
     * Cancel specific request
     */
    cancelRequest(videoId) {
        const request = this.activeRequests.get(videoId);
        if (request) {
            request.abortController.abort();
            this.activeRequests.delete(videoId);
            console.log(`🚫 Cancelled stream request for ${videoId}`);
        }
    }

    /**
     * Clear expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        let cleared = 0;
        for (const [videoId, cached] of this.requestCache.entries()) {
            if (now - cached.timestamp > this.cacheTTL) {
                this.requestCache.delete(videoId);
                cleared++;
            }
        }
        if (cleared > 0) {
            console.log(`🗑️ Cleaned ${cleared} expired cache entries`);
        }
    }

    /**
     * Clear all cache and active requests
     */
    reset() {
        this.cancelAllRequests();
        this.requestCache.clear();
        console.log('🔄 StreamFetchManager reset complete');
    }
}

// Singleton instance
const streamFetchManager = new StreamFetchManager();

// Auto cleanup every 2 minutes (matching TTL)
setInterval(() => {
    streamFetchManager.cleanupCache();
}, 2 * 60 * 1000);

export default streamFetchManager;
