import {getApp} from '@react-native-firebase/app';
import {
  getAnalytics,
  FirebaseAnalyticsTypes,
} from '@react-native-firebase/analytics';

// Lazily initialize analyticsInstance. Avoid calling native APIs at module
// load time because that can throw if the native Firebase modules are not
// available (causes the runtime fatal error: firebase.app()).
let analyticsInstance: FirebaseAnalyticsTypes.Module | null = null;

function getAnalyticsIfAvailable(): FirebaseAnalyticsTypes.Module | null {
  if (analyticsInstance) {
    return analyticsInstance;
  }
  try {
    const app = getApp();
    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch (error) {
    // Native Firebase not available — return null and let callers silently no-op.
    analyticsInstance = null;
    return null;
  }
}

// Analytics event types
export enum AnalyticsEvents {
  APP_OPEN = 'app_open',
  USER_LOGIN = 'user_login',
  USER_SIGNUP = 'user_signup',
  SONG_PLAY = 'song_play',
  PLAYLIST_CREATE = 'playlist_create',
  PLAYLIST_ADD_SONG = 'playlist_add_song',
  SEARCH = 'search',
  DOWNLOAD_START = 'download_start',
  DOWNLOAD_COMPLETE = 'download_complete',
  SHARE = 'share',
}

// Analytics user properties
export enum UserProperties {
  USER_THEME = 'user_theme',
  LANGUAGE = 'language',
  SUBSCRIPTION_STATUS = 'subscription_status',
}

class AnalyticsService {
  /**
   * Enable or disable analytics collection.
   * @param enabled boolean to enable/disable collection
   */
  setAnalyticsCollectionEnabled = async (enabled: boolean) => {
    try {
      const instance = getAnalyticsIfAvailable();
      if (!instance) {
        return;
      }
      await instance.setAnalyticsCollectionEnabled(enabled);
    } catch (error) {
      // Silent error handling for analytics
    }
  };

  /**
   * Log a screen view event
   * @param screenName The name of the screen
   * @param screenClass The class of the screen (optional)
   */
  logScreenView = async (screenName: string, screenClass?: string) => {
    try {
      const instance = getAnalyticsIfAvailable();
      if (!instance) {
        return;
      }
      await instance.logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      // Silent error handling for analytics
    }
  };

  /**
   * Log a custom event
   * @param eventName The name of the event
   * @param params Additional parameters for the event
   */
  logEvent = async (eventName: string, params?: Record<string, any>) => {
    try {
      const instance = getAnalyticsIfAvailable();
      if (!instance) {
        return;
      }
      await instance.logEvent(eventName, params);
    } catch (error) {
      // Silent error handling for analytics
    }
  };

  /**
   * Set a user property
   * @param name The name of the property
   * @param value The value of the property
   */
  setUserProperty = async (name: string, value: string) => {
    try {
      const instance = getAnalyticsIfAvailable();
      if (!instance) {
        return;
      }
      await instance.setUserProperty(name, value);
    } catch (error) {
      // Silent error handling for analytics
    }
  };

  /**
   * Log when a user plays a song
   * @param songId The ID of the song
   * @param songName The name of the song
   * @param artistName The name of the artist
   */
  logSongPlay = (songId: string, songName: string, artistName: string) => {
    this.logEvent(AnalyticsEvents.SONG_PLAY, {
      song_id: songId,
      song_name: songName,
      artist_name: artistName,
      timestamp: Date.now(),
    });
  };

  /**
   * Log when a user downloads a song or album
   * @param contentId The ID of the content
   * @param contentType The type of content ('song' or 'album')
   * @param contentName The name of the content
   */
  logDownloadStart = (
    contentId: string,
    contentType: 'song' | 'album',
    contentName: string,
  ) => {
    this.logEvent(AnalyticsEvents.DOWNLOAD_START, {
      content_id: contentId,
      content_type: contentType,
      content_name: contentName,
      timestamp: Date.now(),
    });
  };

  /**
   * Log when a download completes
   * @param contentId The ID of the content
   * @param contentType The type of content ('song' or 'album')
   * @param contentName The name of the content
   * @param success Whether the download was successful
   */
  logDownloadComplete = (
    contentId: string,
    contentType: 'song' | 'album',
    contentName: string,
    success: boolean,
  ) => {
    this.logEvent(AnalyticsEvents.DOWNLOAD_COMPLETE, {
      content_id: contentId,
      content_type: contentType,
      content_name: contentName,
      success,
      timestamp: Date.now(),
    });
  };

  /**
   * Log search events
   * @param query The search query
   * @param resultsCount The number of results
   */
  logSearch = (query: string, resultsCount: number) => {
    this.logEvent(AnalyticsEvents.SEARCH, {
      search_term: query,
      results_count: resultsCount,
    });
  };

  /**
   * Track total downloaded content count
   * This helps monitor how many songs users have downloaded in total
   * @param count The total number of downloaded items
   */
  trackDownloadCount = (count: number) => {
    this.logEvent('download_count', {
      count,
      timestamp: Date.now(),
    });
  };

  /**
   * Track active users
   * Call this function periodically to record active users
   */
  trackActiveUser = () => {
    this.logEvent('active_user', {
      timestamp: Date.now(),
    });
  };
}

// Export a singleton instance
export const analyticsService = new AnalyticsService();
