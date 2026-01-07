import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeStreaming from './NativeStreaming';
import {CacheManager} from './NavigationCacheManager';

/**
 * YouTube Streaming Service
 *
 * Provides YouTube Music streaming URLs with proper authentication headers.
 * Uses Direct Native NewPipe Extraction (via StreamModule).
 *
 * CACHING: Stream URLs are cached for 3 hours to avoid repeated API calls.
 */

// Android client configuration for InnerTube API
const ANDROID_CLIENT = {
  headers: {
    'User-Agent':
      'com.google.android.youtube/19.09.37 (Linux; U; Android 12; en_IN)',
    'X-YouTube-Client-Name': '3',
    'X-YouTube-Client-Version': '19.09.37',
  },
};

class YouTubeStreamingService {
  constructor() {
    this.cookies = null;
    this.cookiesLoaded = false;
  }

  /**
   * Get streaming URL using Native NewPipe Module
   * Uses cache to avoid repeated API calls
   *
   * @param {string} videoId - YouTube video ID
   * @param {boolean} forceFresh - Whether to ignore cache and fetch fresh
   * @returns {Promise<{url: string, headers: object, thumbnail: string, duration: number, title: string}|null>}
   */
  async getStreamUrl(videoId, forceFresh = false) {
    try {
      // Step 1: CHECK CACHE FIRST (unless forceFresh)
      if (!forceFresh) {
        const cachedUrl = CacheManager.getStreamUrl(videoId, 'ytmusic');
        if (cachedUrl) {
          // Validate cached URL before returning it
          if (
            typeof cachedUrl === 'string' &&
            (cachedUrl.startsWith('http://') ||
              cachedUrl.startsWith('https://'))
          ) {
            return {
              url: cachedUrl,
              headers: {
                'User-Agent': ANDROID_CLIENT.headers['User-Agent'],
                Range: 'bytes=0-',
              },
              fromCache: true,
            };
          } else {
            // Invalid cached URL - clear only that entry and fetch fresh
            console.warn(
              `⚠️ Invalid cached URL for ${videoId}: ${cachedUrl}, fetching fresh`,
            );
            CacheManager.clearStreamUrl(videoId, 'ytmusic');
          }
        }
      } else {
        CacheManager.clearStreamUrl(videoId, 'ytmusic');
      }

      // Step 2: Cache miss - fetch from Native NewPipe
      // Orbit VIP Mode: Inject Cookies if available
      const cookies = await AsyncStorage.getItem('yt_cookies');

      // Use a retry wrapper with timeout to avoid long native hangs
      const result = await this._nativeFetchWithRetries(
        videoId,
        cookies || '',
        3,
        8000,
      );

      if (result && result.url) {
        // Validate URL before caching
        if (
          typeof result.url !== 'string' ||
          (!result.url.startsWith('http://') &&
            !result.url.startsWith('https://'))
        ) {
          console.error(
            `❌ Invalid URL from native module for ${videoId}: ${result.url}`,
          );
          return null;
        }

        // Step 3: CACHE THE STREAM URL (3-hour TTL)
        CacheManager.setStreamUrl(videoId, result.url, 'ytmusic');

        return {
          url: result.url,
          headers: {
            'User-Agent': ANDROID_CLIENT.headers['User-Agent'],
            Range: 'bytes=0-',
          },
          thumbnail: result.thumbnail,
          duration: result.duration,
          title: result.title,
          author: result.author,
          fromCache: false,
        };
      }

      throw new Error('Native module returned empty result');
    } catch (error) {
      console.error(`❌ Native Streaming failed for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Try fetching native stream URL with retries and timeout
   * @private
   */
  async _nativeFetchWithRetries(
    videoId,
    cookies = '',
    maxAttempts = 3,
    timeoutMs = 8000,
  ) {
    let attempt = 0;
    let lastError = null;

    const callNative = () =>
      NativeStreaming.getStreamUrl(videoId, cookies || '');

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const result = await Promise.race([
          callNative(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('timeout')), timeoutMs),
          ),
        ]);

        if (
          result &&
          result.url &&
          typeof result.url === 'string' &&
          (result.url.startsWith('http://') ||
            result.url.startsWith('https://'))
        ) {
          return result;
        }

        // Invalid result — treat as error to retry
        lastError = new Error(
          `Invalid stream URL result on attempt ${attempt}`,
        );
        console.warn(
          `⚠️ Invalid stream result for ${videoId} on attempt ${attempt}: ${
            result && result.url
          }`,
        );
      } catch (err) {
        lastError = err;
        console.warn(
          `⚠️ Native fetch attempt ${attempt} failed for ${videoId}:`,
          err,
        );
      }

      // Backoff before retrying
      if (attempt < maxAttempts) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, backoffMs));
      }
    }

    throw lastError || new Error('Native fetch failed');
  }
}

// Create singleton instance
const youtubeStreamingService = new YouTubeStreamingService();

export default youtubeStreamingService;
