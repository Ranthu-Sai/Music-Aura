import AsyncStorage from '@react-native-async-storage/async-storage';
import {analyticsService} from './AnalyticsUtils';

// Storage keys
const HISTORY_STORAGE_KEY = 'orbit_listening_history';
const WEEKLY_STATS_KEY = 'orbit_weekly_stats';

// History entry structure
const createHistoryEntry = (song, listenDuration = 0) => ({
  id: song.id || Date.now().toString(),
  title: song.title || 'Unknown Title',
  artist: song.artist || 'Unknown Artist',
  artwork: song.artwork || song.image || '',
  url: song.url || '',
  duration: song.duration || 0,
  listenDuration: Math.max(0, listenDuration), // Ensure non-negative
  playCount: 1,
  lastPlayed: Date.now(),
  firstPlayed: Date.now(),
  sourceType:
    song.sourceType ||
    (song.isLocal ? 'local' : song.path ? 'download' : 'online'),
  isLocal: song.isLocal || false,
  path: song.path || null,
});

// Weekly stats structure
const createWeeklyStats = () => {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);

  return {
    weekStart: startOfWeek.getTime(),
    totalListenTime: 0,
    songsPlayed: 0,
    dailyStats: Array(7).fill(0), // Sunday to Saturday
  };
};

class HistoryManager {
  constructor() {
    this.currentTrack = null;
    this.startTime = null;
    this.isTracking = false;
    this.isPaused = false; // Track if tracking is paused
    this.pausedDuration = 0; // Total time spent paused
    this.pauseStartTime = null; // When the current pause started
    this.lastSavedDuration = 0;
    this.minListenDuration = 5000; // 5 seconds minimum to count as "listened"
    this.hasCountedPlay = false; // Flag to ensure we only count play once per session
    this.isBackgroundMode = false; // Track if app is in background
  }

  // Getter for external access to tracking state
  get isCurrentlyTracking() {
    return this.isTracking;
  }

  // Initialize history tracking
  async initialize() {
    try {
      await this.ensureWeeklyStatsExist();
      // Refresh all stats to ensure consistency on app start
      await this.refreshAllStats();
    } catch (error) {
      console.error('HistoryManager: Initialization failed:', error);
    }
  }

  // Start tracking a song
  async startTracking(song) {
    try {
      if (!song || !song.id) {
        console.warn('HistoryManager: Invalid song provided for tracking');
        return;
      }

      // Check if we're already tracking this same song
      if (
        this.isTracking &&
        this.currentTrack &&
        this.currentTrack.id === song.id
      ) {
        return;
      }

      // Stop previous tracking
      await this.stopTracking();

      // User requested 1s delay before starting tracking to ensure metadata is stable
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add to history immediately so it shows up in "Recently Played" right away
      // but don't count it as a "play" until minListenDuration is reached
      await this.addToHistory(song, 0, false);

      // FIXED: Check if this song was recently played to continue cumulative tracking
      const history = await this.getHistory();
      const existingEntry = history.find(item => item && item.id === song.id);
      const isRecentPlay =
        existingEntry && Date.now() - existingEntry.lastPlayed < 300000; // 5 minutes

      this.currentTrack = song;
      this.startTime = Date.now();
      this.lastSavedDuration = 0;
      this.isTracking = true;
      this.isPaused = false;
      this.pausedDuration = 0;
      this.pauseStartTime = null;

      // FIXED: Only reset hasCountedPlay if this is not a recent continuation of the same song
      this.hasCountedPlay = isRecentPlay && existingEntry ? true : false;

      // No interval - purely event-driven now per user request for performance
    } catch (error) {
      console.error('HistoryManager: Error starting tracking:', error);
    }
  }

  // Stop tracking current song
  async stopTracking() {
    try {
      if (!this.isTracking || !this.currentTrack) {
        return;
      }

      // Save final progress
      await this.saveProgress(true);

      // FIXED: Reset currentSessionDuration in history entry when stopping
      try {
        // Store reference to avoid race condition where currentTrack becomes null
        const trackToReset = this.currentTrack;
        if (trackToReset && trackToReset.id) {
          const history = await this.getHistory();
          const existingIndex = history.findIndex(
            item => item && item.id === trackToReset.id,
          );
          if (existingIndex !== -1) {
            history[existingIndex].currentSessionDuration = 0; // Reset for next session
            await AsyncStorage.setItem(
              HISTORY_STORAGE_KEY,
              JSON.stringify(history),
            );
          }
        }
      } catch (resetError) {
        console.error(
          'HistoryManager: Error resetting session duration:',
          resetError,
        );
      }

      // Clear tracking state
      this.isTracking = false;
      this.currentTrack = null;
      this.startTime = null;
      this.lastSavedDuration = 0;
      this.hasCountedPlay = false; // Reset play count flag
    } catch (error) {
      console.error('HistoryManager: Error stopping tracking:', error);
      // Ensure cleanup even on error
      this.isTracking = false;
      this.currentTrack = null;
      this.startTime = null;
      this.lastSavedDuration = 0;
      this.hasCountedPlay = false;
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = null;
      }
    }
  }

  // Pause tracking (when music is paused)
  pauseTracking() {
    try {
      if (!this.isTracking || this.isPaused) {
        return;
      }

      this.isPaused = true;
      this.pauseStartTime = Date.now();
    } catch (error) {
      console.error('HistoryManager: Error pausing tracking:', error);
    }
  }

  // Resume tracking (when music resumes)
  resumeTracking() {
    try {
      if (!this.isTracking || !this.isPaused) {
        return;
      }

      // Add the paused time to total paused duration
      if (this.pauseStartTime) {
        this.pausedDuration += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }

      this.isPaused = false;
    } catch (error) {
      console.error('HistoryManager: Error resuming tracking:', error);
    }
  }

  // Save current progress
  async saveProgress(isFinal = false) {
    try {
      if (!this.isTracking || !this.currentTrack || !this.startTime) {
        return;
      }

      // Calculate actual listening time (excluding paused time)
      let currentDuration = Date.now() - this.startTime;

      // Subtract paused time
      let totalPausedTime = this.pausedDuration;
      if (this.isPaused && this.pauseStartTime) {
        totalPausedTime += Date.now() - this.pauseStartTime;
      }

      currentDuration = Math.max(0, currentDuration - totalPausedTime);

      // Only save if we've made significant progress or it's final
      if (
        !isFinal &&
        currentDuration - this.lastSavedDuration < this.saveThreshold
      ) {
        return;
      }

      // Check if we should count this as a new play (only once per tracking session)
      const shouldCountPlay =
        !this.hasCountedPlay && currentDuration >= this.minListenDuration;

      if (shouldCountPlay) {
        this.hasCountedPlay = true;
        await this.addToHistory(this.currentTrack, currentDuration, true);
      } else {
        // Just update duration without counting play
        await this.addToHistory(this.currentTrack, currentDuration, false);
      }

      // Update weekly stats with the difference
      const durationDiff = currentDuration - this.lastSavedDuration;
      if (durationDiff > 0) {
        await this.updateWeeklyStatsProgress(durationDiff, shouldCountPlay);
      }

      this.lastSavedDuration = currentDuration;
    } catch (error) {
      console.error('HistoryManager: Error saving progress:', error);
    }
  }

  // Add or update song in history
  async addToHistory(song, listenDuration = 0, isNewPlay = false) {
    try {
      if (!song || !song.id) {
        console.warn('HistoryManager: Invalid song for history');
        return;
      }

      const history = await this.getHistory();
      const existingIndex = history.findIndex(
        item => item && item.id === song.id,
      );

      if (existingIndex !== -1) {
        // Update existing entry
        const existing = history[existingIndex];

        // Only increment play count for new plays, not progress updates
        if (isNewPlay) {
          existing.playCount += 1;
        }

        // FIXED: Accumulate listening time instead of taking maximum
        // This ensures cumulative tracking across multiple sessions
        existing.listenDuration += Math.max(
          0,
          listenDuration - (existing.currentSessionDuration || 0),
        );
        existing.currentSessionDuration = listenDuration; // Track current session for incremental updates
        existing.lastPlayed = Date.now();

        // Move to front of array (most recent first)
        history.splice(existingIndex, 1);
        history.unshift(existing);
      } else {
        // Create new entry
        const newEntry = createHistoryEntry(song, listenDuration);
        newEntry.currentSessionDuration = listenDuration; // Track current session
        history.unshift(newEntry);
      }

      // Limit history size (keep last 1000 entries)
      if (history.length > 1000) {
        history.splice(1000);
      }

      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));

      // Weekly stats are now updated in saveProgress to avoid double counting

      // Track analytics only for significant listen duration
      if (isNewPlay && listenDuration >= this.minListenDuration) {
        analyticsService.logSongPlay(song.id, song.title, song.artist);
      }
    } catch (error) {
      console.error('HistoryManager: Error adding to history:', error);
    }
  }

  // Get full history
  async getHistory() {
    try {
      const historyData = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      return historyData ? JSON.parse(historyData) : [];
    } catch (error) {
      console.error('HistoryManager: Error getting history:', error);
      return [];
    }
  }

  // Get filtered history
  async getFilteredHistory(filter = 'recent', searchQuery = '') {
    try {
      let history = await this.getHistory();

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        history = history.filter(
          item =>
            item.title.toLowerCase().includes(query) ||
            item.artist.toLowerCase().includes(query),
        );
      }

      // Apply sorting filter
      switch (filter) {
        case 'most_played':
          history.sort((a, b) => b.playCount - a.playCount);
          break;
        case 'most_time':
          history.sort((a, b) => b.listenDuration - a.listenDuration);
          break;
        case 'recent':
        default:
          history.sort((a, b) => b.lastPlayed - a.lastPlayed);
          break;
      }

      return history;
    } catch (error) {
      console.error('HistoryManager: Error getting filtered history:', error);
      return [];
    }
  }

  // Update weekly stats
  async updateWeeklyStats(listenDuration) {
    try {
      let stats = await this.getWeeklyStats();
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

      // Check if we need to reset for new week
      const weekStart = new Date(stats.weekStart);
      const currentWeekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      );
      currentWeekStart.setHours(0, 0, 0, 0);

      if (weekStart.getTime() !== currentWeekStart.getTime()) {
        // New week, reset stats
        stats = createWeeklyStats();
        stats.weekStart = currentWeekStart.getTime();
      }

      // Update stats - only increment songs played for new plays
      stats.totalListenTime += listenDuration;
      stats.songsPlayed += 1;
      stats.dailyStats[dayOfWeek] += listenDuration;

      await AsyncStorage.setItem(WEEKLY_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('HistoryManager: Error updating weekly stats:', error);
    }
  }

  // Update weekly stats for progress updates (different from new plays)
  async updateWeeklyStatsProgress(durationDiff, isNewPlay) {
    try {
      let stats = await this.getWeeklyStats();
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

      // Check if we need to reset for new week
      const weekStart = new Date(stats.weekStart);
      const currentWeekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      );
      currentWeekStart.setHours(0, 0, 0, 0);

      if (weekStart.getTime() !== currentWeekStart.getTime()) {
        // New week, reset stats
        stats = createWeeklyStats();
        stats.weekStart = currentWeekStart.getTime();
      }

      // Add the duration difference (incremental time)
      if (durationDiff > 0) {
        stats.totalListenTime += durationDiff;
        stats.dailyStats[dayOfWeek] += durationDiff;
      }

      // Only increment song count for new plays
      if (isNewPlay) {
        stats.songsPlayed += 1;
      }

      await AsyncStorage.setItem(WEEKLY_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error(
        'HistoryManager: Error updating weekly stats progress:',
        error,
      );
    }
  }

  // Get weekly stats
  async getWeeklyStats() {
    try {
      const statsData = await AsyncStorage.getItem(WEEKLY_STATS_KEY);
      return statsData ? JSON.parse(statsData) : createWeeklyStats();
    } catch (error) {
      console.error('HistoryManager: Error getting weekly stats:', error);
      return createWeeklyStats();
    }
  }

  // Ensure weekly stats exist and are accurate
  async ensureWeeklyStatsExist() {
    try {
      const existing = await AsyncStorage.getItem(WEEKLY_STATS_KEY);
      if (!existing) {
        // Create new stats and sync with existing history
        const newStats = createWeeklyStats();
        await AsyncStorage.setItem(WEEKLY_STATS_KEY, JSON.stringify(newStats));
        // Sync with existing history data
        await this.syncWeeklyStats();
      } else {
        // Verify existing stats are consistent with history
        await this.syncWeeklyStats();
      }
    } catch (error) {
      console.error(
        'HistoryManager: Error ensuring weekly stats exist:',
        error,
      );
    }
  }

  // Reset play counts for testing
  async resetPlayCounts() {
    try {
      const history = await this.getHistory();
      const resetHistory = history.map(item => ({
        ...item,
        playCount: 1,
      }));
      await AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(resetHistory),
      );
      return true;
    } catch (error) {
      console.error('HistoryManager: Error resetting play counts:', error);
      return false;
    }
  }

  // Sync weekly stats with actual history data to ensure consistency
  async syncWeeklyStats() {
    try {
      const history = await this.getHistory();
      const now = new Date();
      const currentWeekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      );
      currentWeekStart.setHours(0, 0, 0, 0);
      const weekStartTime = currentWeekStart.getTime();
      const weekEndTime = weekStartTime + 7 * 24 * 60 * 60 * 1000;

      // Filter history for current week
      const thisWeekHistory = history.filter(
        item =>
          item.lastPlayed >= weekStartTime && item.lastPlayed < weekEndTime,
      );

      // Calculate actual stats from history
      const actualSongsPlayed = thisWeekHistory.reduce(
        (sum, item) => sum + item.playCount,
        0,
      );
      const actualTotalTime = thisWeekHistory.reduce(
        (sum, item) => sum + item.listenDuration,
        0,
      );

      // Calculate daily stats
      const dailyStats = Array(7).fill(0);
      thisWeekHistory.forEach(item => {
        const playDate = new Date(item.lastPlayed);
        const dayOfWeek = playDate.getDay();
        dailyStats[dayOfWeek] += item.listenDuration;
      });

      // Update weekly stats with corrected values
      const correctedStats = {
        weekStart: weekStartTime,
        totalListenTime: actualTotalTime,
        songsPlayed: actualSongsPlayed,
        dailyStats: dailyStats,
      };

      await AsyncStorage.setItem(
        WEEKLY_STATS_KEY,
        JSON.stringify(correctedStats),
      );

      return correctedStats;
    } catch (error) {
      console.error('HistoryManager: Error syncing weekly stats:', error);
      return await this.getWeeklyStats();
    }
  }

  // Get history stats
  async getHistoryStats() {
    try {
      const history = await this.getHistory();
      // Sync weekly stats to ensure consistency
      const weeklyStats = await this.syncWeeklyStats();

      const totalSongs = history.length;
      const totalPlayCount = history.reduce(
        (sum, item) => sum + item.playCount,
        0,
      );
      const totalListenTime = history.reduce(
        (sum, item) => sum + item.listenDuration,
        0,
      );

      return {
        totalSongs,
        totalPlayCount,
        totalListenTime,
        weeklyStats,
        averageListenTime: totalSongs > 0 ? totalListenTime / totalSongs : 0,
      };
    } catch (error) {
      console.error('HistoryManager: Error getting history stats:', error);
      return {
        totalSongs: 0,
        totalPlayCount: 0,
        totalListenTime: 0,
        weeklyStats: createWeeklyStats(),
        averageListenTime: 0,
      };
    }
  }

  // Format duration for display (consistent across app)
  formatDuration(milliseconds) {
    if (!milliseconds || milliseconds < 0) {
      return '0:00';
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Format time for statistics display (hours/minutes format)
  static formatTimeForStats(milliseconds) {
    if (!milliseconds || milliseconds < 0) {
      return '<1m';
    }

    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  }

  // Cleanup old entries (keep only last 30 days)
  async cleanupOldEntries() {
    try {
      const history = await this.getHistory();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const filteredHistory = history.filter(
        item => item.lastPlayed > thirtyDaysAgo,
      );

      if (filteredHistory.length !== history.length) {
        await AsyncStorage.setItem(
          HISTORY_STORAGE_KEY,
          JSON.stringify(filteredHistory),
        );
      }
    } catch (error) {
      console.error('HistoryManager: Error cleaning up old entries:', error);
    }
  }

  // Cleanup on app close/background
  cleanup() {
    try {
      // Save current progress before cleanup
      if (this.isTracking && this.currentTrack && this.startTime) {
        const currentDuration = Date.now() - this.startTime;
        // Use synchronous storage for immediate cleanup
        this.addToHistory(this.currentTrack, currentDuration, false).catch(
          error => {
            console.error('HistoryManager: Error saving on cleanup:', error);
          },
        );
      }

      this.isTracking = false;
      this.isPaused = false;
      this.pausedDuration = 0;
      this.pauseStartTime = null;
      this.currentTrack = null;
      this.startTime = null;
      this.lastSavedDuration = 0;
      this.isBackgroundMode = false;
    } catch (error) {
      console.error('HistoryManager: Error during cleanup:', error);
    }
  }

  // Save progress without stopping tracking (for background mode)
  async saveProgressBackground() {
    try {
      if (this.isTracking && this.currentTrack && this.startTime) {
        // Calculate actual listening time (excluding paused time)
        let currentDuration = Date.now() - this.startTime;

        // Subtract paused time
        let totalPausedTime = this.pausedDuration;
        if (this.isPaused && this.pauseStartTime) {
          totalPausedTime += Date.now() - this.pauseStartTime;
        }

        currentDuration = Math.max(0, currentDuration - totalPausedTime);

        // Check if we should count this as a new play (only once per tracking session)
        const shouldCountPlay =
          !this.hasCountedPlay && currentDuration >= this.minListenDuration;

        if (shouldCountPlay) {
          this.hasCountedPlay = true;
          await this.addToHistory(this.currentTrack, currentDuration, true);
        } else {
          // Just update duration without counting play
          await this.addToHistory(this.currentTrack, currentDuration, false);
        }

        this.lastSavedDuration = currentDuration;
      }
    } catch (error) {
      console.error('HistoryManager: Error saving background progress:', error);
    }
  }

  // Set background mode
  setBackgroundMode(isBackground) {
    this.isBackgroundMode = isBackground;
    // Intervals removed for performance
  }

  // Get tracking state
  // getCurrentTrackingInfo follows...

  // Get current tracking info
  getCurrentTrackingInfo() {
    return {
      isTracking: this.isTracking,
      currentTrack: this.currentTrack,
      hasCountedPlay: this.hasCountedPlay,
      startTime: this.startTime,
      lastSavedDuration: this.lastSavedDuration,
      duration: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  // Refresh all statistics to ensure consistency
  async refreshAllStats() {
    try {
      // Sync weekly stats with history data
      await this.syncWeeklyStats();

      // Clean up any invalid entries
      const history = await this.getHistory();
      const validHistory = history.filter(
        item =>
          item &&
          item.id &&
          item.title &&
          typeof item.playCount === 'number' &&
          typeof item.listenDuration === 'number',
      );

      if (validHistory.length !== history.length) {
        await AsyncStorage.setItem(
          HISTORY_STORAGE_KEY,
          JSON.stringify(validHistory),
        );
      }

      return true;
    } catch (error) {
      console.error('HistoryManager: Error refreshing statistics:', error);
      return false;
    }
  }

  // Clear all history
  async clearHistory() {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      await this.refreshAllStats();
      return true;
    } catch (error) {
      console.error('HistoryManager: Error clearing history:', error);
      return false;
    }
  }

  // Remove specific song from history
  async removeFromHistory(songId) {
    try {
      const history = await this.getHistory();
      const newHistory = history.filter(item => item && item.id !== songId);
      await AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(newHistory),
      );
      await this.syncWeeklyStats(); // Update stats to reflect removal
      return true;
    } catch (error) {
      console.error('HistoryManager: Error removing from history:', error);
      return false;
    }
  }

  // Search history
  async searchHistory(query) {
    try {
      const history = await this.getHistory();
      const searchTerm = query.toLowerCase().trim();

      if (!searchTerm) {
        return [];
      }

      return history.filter(
        item =>
          item &&
          item.id &&
          (item.title?.toLowerCase().includes(searchTerm) ||
            item.artist?.toLowerCase().includes(searchTerm) ||
            item.album?.toLowerCase().includes(searchTerm)),
      );
    } catch (error) {
      console.error('HistoryManager: Error searching history:', error);
      return [];
    }
  }
}

// Create singleton instance
const historyManager = new HistoryManager();

export default historyManager;
