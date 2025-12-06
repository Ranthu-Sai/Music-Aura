/**
 * Get streaming URL for a YouTube Music video using Invidious
 * Optimized for network performance - no timeout, adapts to connection speed
 * @param {string} videoId - YouTube video ID (11 characters)
 * @returns {Promise<{url: string, headers: object}>} - Direct streaming URL and headers
 */
async function getYTMusicStreamUrl(videoId) {
    const instance = 'https://yt.omada.cafe';

    try {
        const response = await fetch(`${instance}/api/v1/videos/${videoId}?local=true`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        let audioUrl = null;

        // Try adaptiveFormats (audio only)
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

        // Fallback to formatStreams
        if (!audioUrl && data.formatStreams && data.formatStreams.length > 0) {
            const lowQuality = data.formatStreams.filter(f =>
                f.resolution === '360p' || f.resolution === '240p'
            );
            audioUrl = lowQuality.length > 0 ? lowQuality[0].url : data.formatStreams[0].url;
        }

        if (audioUrl) {
            return {
                url: audioUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
                    'Accept': '*/*',
                },
                source: instance,
            };
        }

        throw new Error('No audio formats found');
    } catch (error) {
        throw new Error(`Unable to get stream URL: ${error.message}`);
    }
}

export { getYTMusicStreamUrl };
