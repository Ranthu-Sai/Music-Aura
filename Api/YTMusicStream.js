import youtubeStreamingService from '../Utils/YouTubeStreamingService';

/**
 * Wrapper for getting YouTube Music stream URL.
 * Previously used Invidious; replaced with native/NewPipe backed service for stability.
 */
async function getYTMusicStreamUrl(videoId, forceFresh = false) {
  try {
    const data = await youtubeStreamingService.getStreamUrl(
      videoId,
      forceFresh,
    );
    if (!data) {
      throw new Error('No stream data returned');
    }
    return {
      url: data.url,
      headers: data.headers || {},
      thumbnail: data.thumbnail,
      duration: data.duration,
      title: data.title,
      source: 'native',
    };
  } catch (err) {
    throw new Error(`Unable to get stream URL: ${err?.message || err}`);
  }
}

export {getYTMusicStreamUrl};
