/**
 * URLValidator - Utility for validating track URLs before adding to TrackPlayer
 * 
 * This module prevents the NullPointerException crash that occurs when
 * TrackPlayer receives null, empty, or invalid URLs.
 */

/**
 * Check if a URL is valid for TrackPlayer
 * TrackPlayer requires HTTP/HTTPS URLs or file:// URLs
 * SPECIAL CASE: ytmusic:// placeholder URLs are allowed - they will be replaced by SmartPrefetchManager
 */
export function isValidStreamUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 0) {
        return false;
    }

    // Valid URL formats for TrackPlayer
    // ytmusic:// is a placeholder that will be replaced before playback
    return (
        trimmedUrl.startsWith('http://') ||
        trimmedUrl.startsWith('https://') ||
        trimmedUrl.startsWith('file://') ||
        trimmedUrl.startsWith('ytmusic://') // Allow placeholder for lazy loading
    );
}

/**
 * Check if a track needs stream URL fetching
 */
export function needsStreamFetch(track) {
    if (!track) return false;

    // Check if it's a YouTube track
    const isYTMusic = track.id && typeof track.id === 'string' &&
        track.id.length === 11 && !track.isLocalMusic;

    if (!isYTMusic) return false;

    // Check if URL is missing or is a placeholder
    const url = track.url || '';
    return !url ||
        url.startsWith('ytmusic://') ||
        url.includes('music.youtube.com') ||
        !isValidStreamUrl(url);
}

/**
 * Sanitize a track object to ensure it has a valid URL
 * Returns null if the track cannot be sanitized
 */
export function sanitizeTrackForPlayer(track) {
    if (!track) {
        console.error('URLValidator: Cannot sanitize null track');
        return null;
    }

    // Validate URL
    if (!isValidStreamUrl(track.url)) {
        console.error('URLValidator: Invalid URL for track:', {
            id: track.id,
            title: track.title,
            url: track.url,
            urlType: typeof track.url
        });
        return null;
    }

    // Ensure artwork is a string (not an object)
    let artworkUrl = '';
    if (typeof track.artwork === 'string') {
        artworkUrl = track.artwork;
    } else if (track.artwork && typeof track.artwork === 'object') {
        artworkUrl = track.artwork.primary || track.artwork.url || track.artwork.uri || '';
    }

    // Return sanitized track
    return {
        ...track,
        url: track.url.trim(),
        artwork: artworkUrl,
        // Ensure duration is a number
        duration: typeof track.duration === 'number' ? track.duration : 0
    };
}

/**
 * Validate and filter an array of tracks
 * Returns only tracks with valid URLs
 */
export function validateTracks(tracks) {
    if (!Array.isArray(tracks)) {
        console.error('URLValidator: validateTracks expects an array');
        return [];
    }

    const validTracks = [];
    const invalidTracks = [];

    for (const track of tracks) {
        const sanitized = sanitizeTrackForPlayer(track);
        if (sanitized) {
            validTracks.push(sanitized);
        } else {
            invalidTracks.push({
                id: track?.id,
                title: track?.title,
                url: track?.url
            });
        }
    }

    if (invalidTracks.length > 0) {
        console.warn(`URLValidator: Filtered out ${invalidTracks.length} invalid tracks:`, invalidTracks);
    }

    return validTracks;
}

export default {
    isValidStreamUrl,
    needsStreamFetch,
    sanitizeTrackForPlayer,
    validateTracks
};
