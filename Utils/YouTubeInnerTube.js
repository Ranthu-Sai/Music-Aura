/**
 * YouTube InnerTube API Client
 * Direct implementation of YouTube's internal API for stream extraction
 * More reliable than web scraping (NewPipe approach)
 */

const INNERTUBE_API_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const INNERTUBE_CLIENT_VERSION = '19.09.37';

const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: INNERTUBE_CLIENT_VERSION,
    androidSdkVersion: 33,
    hl: 'en',
    gl: 'US',
  },
};

class YouTubeInnerTubeClient {
  /**
   * Get stream URL for a video using InnerTube API
   */
  async getStreamUrl(videoId, cookies = '') {
    try {
      console.log(`📡 InnerTube: Fetching stream for ${videoId}`);

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': INNERTUBE_CLIENT_VERSION,
      };

      if (cookies) {
        headers.Cookie = cookies;
      }

      const body = {
        context: INNERTUBE_CONTEXT,
        videoId: videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      };

      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
        {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        console.error(`❌ InnerTube HTTP error for ${videoId}: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log(`📦 InnerTube response status for ${videoId}:`, data.playabilityStatus?.status);

      // Check for errors
      if (data.playabilityStatus?.status !== 'OK') {
        const reason =
          data.playabilityStatus?.reason || 'Video unavailable';
        console.error(`❌ Playability error for ${videoId}: ${reason}`);
        throw new Error(reason);
      }

      // Get streaming data
      const streamingData = data.streamingData;
      if (!streamingData) {
        console.error(`❌ No streaming data for ${videoId}`);
        throw new Error('No streaming data available');
      }

      // Get best audio format
      const audioFormats = streamingData.adaptiveFormats?.filter(
        format => format.mimeType?.includes('audio'),
      ) || [];

      if (audioFormats.length === 0) {
        console.error(`❌ No audio formats found for ${videoId}`);
        throw new Error('No audio formats found');
      }

      // Sort by bitrate and get the best one
      const bestAudio = audioFormats.sort(
        (a, b) => (b.bitrate || 0) - (a.bitrate || 0),
      )[0];

      if (!bestAudio.url) {
        console.error(`❌ No URL in best audio format for ${videoId}`);
        throw new Error('No stream URL in best audio format');
      }

      // Get video details
      const videoDetails = data.videoDetails || {};
      const title = videoDetails.title || 'Unknown';
      const author = videoDetails.author || 'Unknown';
      const duration = parseInt(videoDetails.lengthSeconds || '0', 10);

      // Get best thumbnail
      const thumbnails = videoDetails.thumbnail?.thumbnails || [];
      const thumbnail =
        thumbnails.length > 0
          ? thumbnails[thumbnails.length - 1].url
          : '';

      console.log(`✅ InnerTube success for ${videoId}: ${title} by ${author}`);

      return {
        url: bestAudio.url,
        title: title,
        author: author,
        duration: duration,
        thumbnail: thumbnail,
      };
    } catch (error) {
      console.error(`❌ InnerTube API error for ${videoId}:`, error.message || error);
      throw error;
    }
  }
}

// Create singleton instance
const innerTubeClient = new YouTubeInnerTubeClient();

// Export with same interface as native module
export default {
  getStreamUrl: (videoId, cookies = '') =>
    innerTubeClient.getStreamUrl(videoId, cookies),
};
