/**
 * YouTubeAuthService - Manages YouTube Music authentication state
 * Extracts and stores user account information from cookies
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const YT_USER_KEY = 'yt_user_info';
const YT_COOKIES_KEY = 'yt_cookies';

class YouTubeAuthService {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.listeners = [];
    this._initialized = false;
  }

  async init() {
    if (this._initialized) {
      return;
    }
    try {
      const [userInfo, cookies] = await Promise.all([
        AsyncStorage.getItem(YT_USER_KEY),
        AsyncStorage.getItem(YT_COOKIES_KEY),
      ]);

      if (userInfo) {
        this.user = JSON.parse(userInfo);
      }

      this.isAuthenticated = !!cookies && cookies.includes('SAPISID');
      this._initialized = true;
      this._notifyListeners();
    } catch (error) {
      console.error('YouTubeAuthService init error:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuth() {
    return this.isAuthenticated;
  }

  /**
   * Get current user info
   */
  getUser() {
    return this.user;
  }

  /**
   * Set user info after successful login
   * @param {Object} userInfo - { name, handle, avatarUrl }
   */
  async setUser(userInfo) {
    try {
      this.user = userInfo;
      this.isAuthenticated = true;
      await AsyncStorage.setItem(YT_USER_KEY, JSON.stringify(userInfo));
      this._notifyListeners();
    } catch (error) {
      console.error('YouTubeAuthService setUser error:', error);
    }
  }

  /**
   * Extract user info from YouTube page after login
   * This is called from WebView after successful authentication
   */
  async extractUserInfoFromPage(pageData) {
    try {
      // Parse the user info from the YouTube page data
      // The pageData should contain name and handle extracted via injected JS
      if (pageData && (pageData.name || pageData.handle)) {
        await this.setUser({
          name: pageData.name || 'YouTube User',
          handle: pageData.handle || '',
          avatarUrl: pageData.avatarUrl || null,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('extractUserInfoFromPage error:', error);
      return false;
    }
  }

  /**
   * Mark user as authenticated (when cookies are valid but no user info)
   */
  async setAuthenticated() {
    this.isAuthenticated = true;
    this._notifyListeners();
  }

  /**
   * Get stored cookies for authenticated API requests
   * @returns {string|null} Cookie string or null if not authenticated
   */
  async getCookies() {
    try {
      const cookies = await AsyncStorage.getItem(YT_COOKIES_KEY);
      return cookies || null;
    } catch (error) {
      console.error('YouTubeAuthService getCookies error:', error);
      return null;
    }
  }

  /**
   * Logout - clear all auth data
   */
  async logout() {
    try {
      this.user = null;
      this.isAuthenticated = false;
      await Promise.all([
        AsyncStorage.removeItem(YT_USER_KEY),
        AsyncStorage.removeItem(YT_COOKIES_KEY),
      ]);

      // Also clear headers_auth.json
      try {
        const RNFS = require('react-native-fs');
        const path = `${RNFS.DocumentDirectoryPath}/headers_auth.json`;
        const exists = await RNFS.exists(path);
        if (exists) {
          await RNFS.unlink(path);
        }
      } catch (fsError) {
        console.warn('Could not delete headers_auth.json:', fsError);
      }

      this._notifyListeners();
      return { success: true };
    } catch (error) {
      console.error('YouTubeAuthService logout error:', error);
      return { success: false, error };
    }
  }

  /**
   * Add a listener for auth state changes
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /**
   * Notify all listeners of state change
   */
  _notifyListeners() {
    const state = {
      user: this.user,
      isAuthenticated: this.isAuthenticated,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }
}

// Singleton instance
const ytAuthService = new YouTubeAuthService();

// Initialize on import
ytAuthService.init();

export default ytAuthService;




