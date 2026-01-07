/**
 * YTMusicArtworkUtils.js
 *
 * Utilities for upgrading YouTube Music artwork URLs to higher quality versions
 */

/**
 * Upgrade YouTube Music artwork URL to higher quality
 * Match Orbit behavior for balanced quality/perf:
 * - Upgrade googleusercontent.com/ggpht.com sizes to 500x500
 * - Do NOT auto-upgrade ytimg URLs (progressive handled elsewhere)
 * @param {string} url - Original artwork URL
 * @returns {string} - Upgraded high-quality URL
 */
export function upgradeArtworkQuality(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // Handle googleusercontent.com and ggpht.com URLs - upgrade size parameters
  // Use 500x500 to reduce memory/bandwidth while keeping crisp visuals
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    return url.replace(/[=]w\d+-h\d+[^/]*/g, '=w500-h500');
  }

  // For ytimg.com URLs - DON'T upgrade automatically here
  // Keep original; progressive upgrades are handled via upgradeYtimgQuality if needed
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

  // For ytimg.com maxresdefault, fallback to hqdefault which is reliable
  if (url.includes('i.ytimg.com/vi/') && url.includes('maxresdefault.jpg')) {
    return url.replace('maxresdefault.jpg', 'hqdefault.jpg');
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

  // Only upgrade ytimg.com URLs progressively when invoked
  if (url.includes('i.ytimg.com/vi/')) {
    return url.replace(/(sd|mq|hq)default\.jpg/, 'maxresdefault.jpg');
  }

  return url;
}

/**
 * Return a background-friendly artwork URL for blurred backdrops.
 * Uses lower-res sources to improve performance and blur aesthetics.
 * - googleusercontent/ggpht: w300-h300
 * - ytimg: hqdefault.jpg
 */
export function getBackgroundFriendlyArtwork(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    return url.replace(/[=]w\d+-h\d+[^/]*/g, '=w300-h300');
  }
  if (url.includes('i.ytimg.com/vi/')) {
    return url.replace(
      /(maxresdefault|sddefault|mqdefault|hqdefault)\.jpg/,
      'hqdefault.jpg',
    );
  }
  return url;
}

export default {
  upgradeArtworkQuality,
  getArtworkFallback,
  upgradeYtimgQuality,
  getBackgroundFriendlyArtwork,
};
