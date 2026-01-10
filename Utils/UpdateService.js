/**
 * UpdateService.js
 * Handles app update checking via GitHub Releases API
 */

import {Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

// GitHub repository configuration
const GITHUB_OWNER = 'Ranthu-Sai';
const GITHUB_REPO = 'Music-Aura';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// Toggle GitHub release checks (set false to disable checks and suppress warnings)
const ENABLE_GITHUB_CHECKS = false;

// Storage keys
const STORAGE_KEYS = {
  DISMISSED_VERSION: 'update_dismissed_version',
  LAST_CHECK_TIME: 'update_last_check_time',
  CACHED_UPDATE_INFO: 'update_cached_info',
};

// Minimum time between automatic checks (24 hours)
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

class UpdateService {
  constructor() {
    this.currentVersion = null;
    this.latestRelease = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the update service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get current app version
      this.currentVersion = DeviceInfo.getVersion();
      this.isInitialized = true;
    } catch (error) {
      console.error('[UpdateService] Initialization error:', error);
    }
  }

  /**
   * Get current app version
   */
  getCurrentVersion() {
    return this.currentVersion || DeviceInfo.getVersion();
  }

  /**
   * Compare two semantic version strings
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    if (!v1 || !v2) {
      return 0;
    }

    // Clean version strings (remove 'v' prefix if present)
    const clean1 = v1.replace(/^v/, '');
    const clean2 = v2.replace(/^v/, '');

    const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) {
        return 1;
      }
      if (num1 < num2) {
        return -1;
      }
    }

    return 0;
  }

  /**
   * Check GitHub Releases API for latest version
   */
  async checkGitHubRelease() {
    if (!ENABLE_GITHUB_CHECKS) {
      // GitHub checks disabled for this build; skip checking releases
      return null;
    }
    try {
      const response = await fetch(GITHUB_RELEASES_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MusicAura-App',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Lower-severity log when repo/releases are missing

          return null;
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();

      this.latestRelease = {
        version: release.tag_name?.replace(/^v/, '') || release.name,
        title: release.name || 'New Update',
        body: release.body || 'Bug fixes and improvements.',
        url: release.html_url || GITHUB_RELEASES_PAGE,
        publishedAt: release.published_at,
        assets: release.assets || [],
      };
      return this.latestRelease;
    } catch (error) {
      if (
        error &&
        error.message &&
        error.message.includes('GitHub API error: 404')
      ) {
        console.warn(
          '[UpdateService] GitHub release check returned 404; no releases available.',
        );
      } else {
        console.error('[UpdateService] GitHub release check failed:', error);
      }
      return null;
    }
  }

  /**
   * Main update check - uses GitHub releases
   */
  async checkForUpdate(forceCheck = false) {
    await this.initialize();

    // Check if we should skip based on time interval
    if (!forceCheck) {
      const lastCheck = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_CHECK_TIME,
      );
      if (lastCheck) {
        const elapsed = Date.now() - parseInt(lastCheck, 10);
        if (elapsed < CHECK_INTERVAL_MS) {
          // Return cached info if available
          const cached = await AsyncStorage.getItem(
            STORAGE_KEYS.CACHED_UPDATE_INFO,
          );
          if (cached) {
            return JSON.parse(cached);
          }
        }
      }
    }

    // Save check time
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_CHECK_TIME,
      Date.now().toString(),
    );

    // Check GitHub for latest release
    const githubRelease = await this.checkGitHubRelease();

    // Determine if update is available
    let updateInfo = null;

    if (githubRelease) {
      const hasNewVersion =
        this.compareVersions(githubRelease.version, this.getCurrentVersion()) >
        0;

      if (hasNewVersion) {
        updateInfo = {
          updateAvailable: true,
          forceUpdate: false,
          latestVersion: githubRelease.version,
          title: githubRelease.title,
          message: githubRelease.body,
          url: githubRelease.url,
          source: 'github',
        };
      }
    }

    // If no update or current version is up to date
    if (!updateInfo) {
      updateInfo = {
        updateAvailable: false,
        forceUpdate: false,
        latestVersion: this.getCurrentVersion(),
        title: null,
        message: null,
        url: null,
        source: null,
      };
    }

    // Cache the result
    await AsyncStorage.setItem(
      STORAGE_KEYS.CACHED_UPDATE_INFO,
      JSON.stringify(updateInfo),
    );

    return updateInfo;
  }

  /**
   * Check if user has dismissed this version's update
   */
  async isUpdateDismissed(version) {
    try {
      const dismissed = await AsyncStorage.getItem(
        STORAGE_KEYS.DISMISSED_VERSION,
      );
      return dismissed === version;
    } catch {
      return false;
    }
  }

  /**
   * Dismiss update notification for this version
   */
  async dismissUpdate(version) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DISMISSED_VERSION, version);
    } catch (error) {
      console.error('[UpdateService] Failed to dismiss update:', error);
    }
  }

  /**
   * Clear dismissed version (show update again)
   */
  async clearDismissedUpdate() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.DISMISSED_VERSION);
    } catch (error) {
      console.error('[UpdateService] Failed to clear dismissed update:', error);
    }
  }

  /**
   * Open the update URL (GitHub releases page or custom URL)
   */
  async openUpdateLink(url = null) {
    const targetUrl = url || GITHUB_RELEASES_PAGE;

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
        return true;
      } else {
        console.warn('[UpdateService] Cannot open URL:', targetUrl);
        return false;
      }
    } catch (error) {
      console.error('[UpdateService] Failed to open update link:', error);
      return false;
    }
  }

  /**
   * Check if update should be shown (considering dismissal)
   */
  async shouldShowUpdate() {
    const updateInfo = await this.checkForUpdate();

    if (!updateInfo.updateAvailable) {
      return {show: false, updateInfo};
    }

    // Force updates always show
    if (updateInfo.forceUpdate) {
      return {show: true, updateInfo};
    }

    // Check if dismissed
    const isDismissed = await this.isUpdateDismissed(updateInfo.latestVersion);
    return {show: !isDismissed, updateInfo};
  }
}

// Export singleton instance
export const updateService = new UpdateService();
export default updateService;
