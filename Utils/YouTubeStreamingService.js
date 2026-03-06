import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeStreaming from './NativeStreaming';
import {CacheManager} from './NavigationCacheManager';
import InnerTubeClient from '../Api/InnertubeClient';

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
    // vivi-music pattern: serialize stream resolution to prevent flooding
    this._resolveQueue = Promise.resolve();
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
    // Quick cache check (no serialization needed)
    if (!forceFresh) {
      const cachedUrl = CacheManager.getStreamUrl(videoId, 'ytmusic');
      if (
        cachedUrl &&
        typeof cachedUrl === 'string' &&
        (cachedUrl.startsWith('http://') || cachedUrl.startsWith('https://'))
      ) {
        return {
          url: cachedUrl,
          headers: {
            'User-Agent': ANDROID_CLIENT.headers['User-Agent'],
            Range: 'bytes=0-',
          },
          fromCache: true,
        };
      }
    }

    // vivi-music pattern: serialize non-cached fetches to prevent concurrent flooding
    const result = await new Promise((resolve, reject) => {
      this._resolveQueue = this._resolveQueue
        .then(() => this._fetchStreamUrl(videoId, forceFresh))
        .then(resolve)
        .catch(reject);
    });
    return result;
  }

  /**
   * Internal: actually fetch the stream URL (called one at a time via queue)
   * @private
   */
  async _fetchStreamUrl(videoId, forceFresh = false) {
    try {
      // Re-check cache (another queued call may have cached it while waiting)
      if (!forceFresh) {
        const cachedUrl = CacheManager.getStreamUrl(videoId, 'ytmusic');
        if (
          cachedUrl &&
          typeof cachedUrl === 'string' &&
          (cachedUrl.startsWith('http://') || cachedUrl.startsWith('https://'))
        ) {
          return {
            url: cachedUrl,
            headers: {
              'User-Agent': ANDROID_CLIENT.headers['User-Agent'],
              Range: 'bytes=0-',
            },
            fromCache: true,
          };
        }
      } else {
        CacheManager.clearStreamUrl(videoId, 'ytmusic');
      }

      // Step 2: Cache miss — vivi-music pattern: try InnerTube JS API FIRST (fast),
      // then fall back to native NewPipe (slower, prone to timeouts)
      let result = null;

      // Step 2a: InnerTube Player API (vivi-music ANDROID_VR — fast, no native bridge)
      try {
        const innertubeResult =
          await InnerTubeClient.getPlayerResponse(videoId);
        if (innertubeResult && innertubeResult.url) {
          result = {
            url: innertubeResult.url,
            thumbnail: innertubeResult.thumbnail,
            duration: innertubeResult.duration,
            title: innertubeResult.title,
            author: innertubeResult.author,
          };
        }
      } catch (innertubeErr) {
        console.warn(
          `⚠️ InnerTube failed for ${videoId}:`,
          innertubeErr.message,
        );
      }

      // Step 2b: Native NewPipe fallback (only 1 attempt to avoid long timeouts)
      if (!result || !result.url) {
        try {
          const cookies = await AsyncStorage.getItem('yt_cookies');
          const nativeResult = await this._nativeFetchWithRetries(
            videoId,
            cookies || '',
            1,
          );
          if (nativeResult && nativeResult.url) {
            result = nativeResult;
          }
        } catch (nativeErr) {
          console.warn(
            `⚠️ Native NewPipe also failed for ${videoId}:`,
            nativeErr.message,
          );
        }
      }

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
  ) {
    let attempt = 0;
    let lastError = null;

    const callNative = () =>
      NativeStreaming.getStreamUrl(videoId, cookies || '');

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        // Wait for native module to return (no short timeout)
        const result = await callNative();

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
