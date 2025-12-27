/**
 * YTMusicArtworkUtils.js
 *
 * Utilities for upgrading YouTube Music artwork URLs to higher quality versions
 */

/**
 * Upgrade YouTube Music artwork URL to higher quality
 * Upgrades googleusercontent.com URLs (to w1000-h1000) and ytimg URLs (to maxresdefault)
 * @param {string} url - Original artwork URL
 * @returns {string} - Upgraded high-quality URL
 */
export function upgradeArtworkQuality(url) {
    if (!url || typeof url !== 'string') {
        return url;
    }

    // Handle googleusercontent.com and ggpht.com URLs - upgrade size parameters
    // Using 1000x1000 for high-quality display in full-screen player
    if (url.includes('.googleusercontent.com') || url.includes('.ggpht.com')) {
        // Replace any size parameters (w###-h###) with w1000-h1000
        return url.replace(/[=]w\d+-h\d+[^/]*/g, '=w1000-h1000-l90-rj');
    }

    // For ytimg.com URLs - Use maxresdefault for high-quality full screen display
    if (url.includes('i.ytimg.com/vi/') || url.includes('img.youtube.com/vi/')) {
        return url.replace(/\/([^/]+)\.(jpg|webp)$/, '/maxresdefault.jpg');
    }

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

    // For ytimg.com, fallback to hqdefault which is the most reliable
    if (url.includes('vi/')) {
        return url.replace(/\/([^/]+)\.(jpg|webp)$/, '/hqdefault.jpg');
    }

    return null;
}

/**
 * Upgrade ytimg URL to higher quality (hqdefault)
 * @param {string} url - Original ytimg URL
 * @returns {string} - Upgraded URL
 */
export function upgradeYtimgQuality(url) {
    if (!url || typeof url !== 'string') {
        return url;
    }

    // Support both i.ytimg.com and img.youtube.com
    if (url.includes('vi/')) {
        // Replace whatever filename (0.jpg, default.webp, etc.) with hqdefault.jpg
        return url.replace(/\/([^/]+)\.(jpg|webp)$/, '/hqdefault.jpg');
    }

    return url;
}

export default {
    upgradeArtworkQuality,
    getArtworkFallback,
    upgradeYtimgQuality,
};
