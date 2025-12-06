// Invidious instances for streaming - using working instance
const INVIDIOUS_INSTANCES = [
    'https://yt.omada.cafe',
];

/**
 * Get streaming URL for a YouTube Music video using Invidious
 * Invidious bypasses YouTube's bot detection and provides direct stream URLs
 * @param {string} videoId - YouTube video ID (11 characters)
 * @returns {Promise<{url: string, headers: object}>} - Direct streaming URL and headers
 */
async function getYTMusicStreamUrl(videoId) {
    // Try all instances in parallel with race condition
    const promises = INVIDIOUS_INSTANCES.map(async (instance) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(`${instance}/api/v1/videos/${videoId}?local=true`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Try to get audio format
            let audioUrl = null;

            // Strategy 1: adaptiveFormats (audio only, better quality)
            if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
                const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
                if (audioFormats.length > 0) {
                    // Prefer MP4/M4A for better compatibility
                    let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
                    if (!bestAudio) {
                        bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                    }
                    audioUrl = bestAudio.url;
                }
            }

            // Strategy 2: formatStreams (combined audio+video, lower quality)
            if (!audioUrl && data.formatStreams && data.formatStreams.length > 0) {
                const lowQuality = data.formatStreams.filter(f =>
                    f.resolution === '360p' || f.resolution === '240p'
                );
                audioUrl = lowQuality.length > 0 ? lowQuality[0].url : data.formatStreams[0].url;
            }

            if (audioUrl) {
                // Return URL and headers in the format expected by MusicPlayerFunctions
                return {
                    url: audioUrl,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
                        'Accept': '*/*',
                    }
                };
            }

            throw new Error('No audio formats found');
        } catch (error) {
            throw error;
        }
    });

    // Race all promises - return the first successful one
    try {
        const result = await Promise.any(promises);
        return result;
    } catch (error) {
        console.error(`❌ All Invidious instances failed for ${videoId}`);
        throw new Error('Unable to get stream URL. All servers are unavailable.');
    }
}

export { getYTMusicStreamUrl };
