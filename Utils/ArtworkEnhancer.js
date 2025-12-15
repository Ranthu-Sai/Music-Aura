/**
 * ArtworkEnhancer.js
 * 
 * Centralized utility for upgrading YTMusic artwork URLs to higher quality versions.
 * Handles two types of URLs:
 * 1. Google CDN (lh3.googleusercontent.com) - modify query parameters
 * 2. YouTube CDN (i.ytimg.com) - replace filename with higher quality variant
 * 
 * Context-based sizing ensures optimal quality vs performance balance:
 * - 'playing': 500x500 (highest quality for currently playing song)
 * - 'card': 400x400 (good quality for lists and search results)
 * - 'queue': 300x300 (optimized for queue items)
 * - 'thumbnail': 200x200 (small previews)
 */

/**
 * Main enhancement function - detects URL type and applies appropriate enhancement
 * @param {string|null} originalUrl - Original artwork URL from API
 * @param {string} context - Display context: 'playing', 'card', 'queue', 'thumbnail', 'playlist-header', 'album-header'
 * @returns {string|object|null} Enhanced URL or object with primary/fallback for YouTube thumbnails
 */
export const enhanceYTMusicArtwork = (originalUrl, context = 'card') => {
    // Return null for invalid input
    if (!originalUrl || typeof originalUrl !== 'string') {
        return null;
    }

    // Skip enhancement for playlist/album headers (already high quality)
    if (context === 'playlist-header' || context === 'album-header') {
        return originalUrl;
    }

    // Detect URL type and apply appropriate enhancement
    if (originalUrl.includes('googleusercontent.com')) {
        return enhanceGoogleCDN(originalUrl, context);
    }

    if (originalUrl.includes('i.ytimg.com')) {
        return enhanceYouTubeThumbnail(originalUrl, context);
    }

    // Return original for other sources (JioSaavn, local files, etc.)
    return originalUrl;
};

/**
 * Enhance Google CDN URLs by modifying size parameters
 * Example: =w60-h60-l90-rj → =w500-h500-l90-rj
 * @private
 */
const enhanceGoogleCDN = (url, context) => {
    const size = getSizeForContext(context);

    // Replace existing size parameters with enhanced ones
    // Preserves other parameters like -l90-rj (quality level, format)
    const enhanced = url.replace(
        /=w\d+-h\d+(-[^-&]*)*/,
        `=w${size}-h${size}-l90-rj`
    );

    return enhanced;
};

/**
 * Enhance YouTube thumbnail URLs by trying higher quality variants
 * Returns object with fallback chain: maxresdefault → hqdefault → original
 * @private
 */
const enhanceYouTubeThumbnail = (url, context) => {
    // Extract video ID from URL
    const videoIdMatch = url.match(/\/vi\/([^\/]+)\//);
    if (!videoIdMatch || !videoIdMatch[1]) {
        return url; // Can't extract video ID, return original
    }

    const videoId = videoIdMatch[1];

    // Build fallback chain
    // maxresdefault: 1280x720 (best quality, but not available for all videos)
    // hqdefault: 480x360 (good quality, widely available)
    // original: API-provided URL (fallback)
    return {
        primary: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        fallback: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        original: url,
        needsCrop: true, // YouTube thumbnails are 16:9, need center crop to 1:1
        isYouTubeThumbnail: true
    };
};

/**
 * Get appropriate size based on display context
 * @private
 */
const getSizeForContext = (context) => {
    const sizeMap = {
        'playing': 500,      // Currently playing song (highest quality)
        'card': 400,         // Song cards in playlists, albums, search
        'queue': 300,        // Queue items (balance quality vs performance)
        'thumbnail': 200,    // Small thumbnails
        'default': 400       // Safe default
    };

    return sizeMap[context] || sizeMap['default'];
};

/**
 * Helper: Check if artwork is a YouTube thumbnail object (needs special handling)
 * @param {*} artwork - Artwork URL or object
 * @returns {boolean}
 */
export const isYouTubeThumbnailObject = (artwork) => {
    return artwork && typeof artwork === 'object' && artwork.isYouTubeThumbnail === true;
};

/**
 * Helper: Get primary URL from artwork (handles both string and object)
 * @param {string|object} artwork - Artwork URL or YouTube thumbnail object
 * @returns {string|null}
 */
export const getPrimaryArtworkUrl = (artwork) => {
    if (!artwork) return null;

    if (typeof artwork === 'string') {
        return artwork;
    }

    if (isYouTubeThumbnailObject(artwork)) {
        return artwork.primary; // Try maxresdefault first
    }

    return null;
};

/**
 * Helper: Get fallback URL from YouTube thumbnail object
 * @param {object} artwork - YouTube thumbnail object
 * @returns {string|null}
 */
export const getFallbackArtworkUrl = (artwork) => {
    if (isYouTubeThumbnailObject(artwork)) {
        return artwork.fallback;
    }
    return null;
};
