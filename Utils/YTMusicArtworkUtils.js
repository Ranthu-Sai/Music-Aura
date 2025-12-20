/**
 * YTMusicArtworkUtils.js
 * 
 * Utilities for upgrading YouTube Music artwork URLs to higher quality versions
 */

/**
 * Upgrade YouTube Music artwork URL to higher quality
 * Only upgrades googleusercontent.com URLs (to w500-h500 for smartphones)
 * Does NOT upgrade ytimg URLs - those will be upgraded progressively during playback
 * @param {string} url - Original artwork URL
 * @returns {string} - Upgraded high-quality URL
 */
export function upgradeArtworkQuality(url) {
    if (!url || typeof url !== 'string') {
        return url;
    }

    // Handle googleusercontent.com and ggpht.com URLs - upgrade size parameters
    // Use 800x800 for higher quality square images
    if (url.includes('.googleusercontent.com') || url.includes('.ggpht.com')) {
        // Replace any size parameters (w###-h###) with w800-h800
        // Use a more robust regex to catch various formats like =w120-h120-l90-rj
        return url.replace(/=w\d+-h\d+[^/]*/g, '=w800-h800-l90-rj');
    }

    // For ytimg.com URLs - DON'T upgrade automatically
    // This will be handled progressively during playback
    // Just return the original URL from API

    // Return unchanged for other URLs
    return url;
}

/**
 * Get fallback artwork URL if primary fails
 * @param {string} url - Original URL
 * @returns {string|null} - Fallback URL or null
 */
export function getArtworkFallback(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    // For ytimg.com maxresdefault, fallback to hqdefault
    if (url.includes('i.ytimg.com/vi/') && url.includes('maxresdefault.jpg')) {
        return url.replace('maxresdefault.jpg', 'hqdefault.jpg');
    }

    return null;
}

/**
 * Upgrade ytimg URL to higher quality (maxresdefault)
 * This is for progressive loading during playback
 * @param {string} url - Original ytimg URL
 * @returns {string} - Upgraded URL with maxresdefault
 */
export function upgradeYtimgQuality(url) {
    if (!url || typeof url !== 'string') {
        return url;
    }

    // Only upgrade ytimg.com URLs
    if (url.includes('i.ytimg.com/vi/')) {
        // Try maxresdefault first
        return url.replace(/(sd|mq|hq)default\.jpg/, 'maxresdefault.jpg');
    }

    return url;
}

export default {
    upgradeArtworkQuality,
    getArtworkFallback,
    upgradeYtimgQuality
};
