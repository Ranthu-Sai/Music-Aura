/**
 * QueueHealthMonitor.js
 *
 * Continuous health monitoring service for the music queue
 * Detects and auto-corrects common queue issues
 */

import TrackPlayer from 'react-native-track-player';
import {DeviceEventEmitter} from 'react-native';
import queueValidator from './QueueValidator';

// Configuration
const HEALTH_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const AUTO_REPAIR_ENABLED = true;

class QueueHealthMonitor {
  constructor() {
    this.isMonitoring = false;
    this.healthCheckInterval = null;
    this.lastHealthReport = null;
    this.healthHistory = [];
    this.issueCallbacks = new Map();
    this.autoRepairEnabled = AUTO_REPAIR_ENABLED;
  }

  /**
   * Start monitoring queue health
   * @param {Object} options - Monitoring options
   */
  start(options = {}) {
    if (this.isMonitoring) {
      console.log('⚠️ Health monitor already running');
      return;
    }

    const {
      checkIntervalMs = HEALTH_CHECK_INTERVAL_MS,
      autoRepair = AUTO_REPAIR_ENABLED,
    } = options;

    this.autoRepairEnabled = autoRepair;
    this.isMonitoring = true;

    console.log('🏥 Starting queue health monitor...');

    // Run initial health check
    this.performHealthCheck().catch(err => {
      console.error('Initial health check failed:', err);
    });

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(err => {
        console.error('Health check failed:', err);
      });
    }, checkIntervalMs);

    console.log(`✅ Health monitor started (checking every ${checkIntervalMs / 1000}s)`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isMonitoring = false;
    console.log('🛑 Health monitor stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    try {
      const report = await queueValidator.monitorQueueHealth();
      this.lastHealthReport = report;

      // Save to history (keep last 10 reports)
      this.healthHistory.push(report);
      if (this.healthHistory.length > 10) {
        this.healthHistory.shift();
      }

      // Emit health report event
      DeviceEventEmitter.emit('queueHealthReport', report);

      // Log based on status
      if (report.status === 'critical') {
        console.error('🚨 CRITICAL queue health issue:', report.issues);

        if (this.autoRepairEnabled) {
          await this.attemptAutoRepair(report);
        }
      } else if (report.status === 'warning') {
        console.warn('⚠️ Queue health warning:', report.issues);

        if (this.autoRepairEnabled) {
          await this.attemptAutoRepair(report);
        }
      } else if (report.status === 'healthy') {
        // Only log periodically to avoid spam
        const logFrequency = 5; // Log every 5th check
        if (this.healthHistory.length % logFrequency === 0) {
          console.log(`✅ Queue healthy: ${report.queueLength} tracks`);
        }
      }

      // Trigger issue-specific callbacks
      this.triggerIssueCallbacks(report);

      return report;
    } catch (error) {
      console.error('❌ Health check error:', error);
      return {
        status: 'error',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Attempt automatic repair of detected issues
   * @param {Object} report - Health report
   */
  async attemptAutoRepair(report) {
    try {
      const issues = report.issues || [];
      let repaired = false;

      for (const issue of issues) {
        // Empty queue repair
        if (issue.includes('Queue is empty')) {
          console.log('🔧 Auto-repair: Queue empty, attempting to restore...');
          DeviceEventEmitter.emit('queueRepairNeeded', {
            type: 'empty_queue',
            action: 'restore',
          });
          repaired = true;
        }

        // Invalid tracks repair
        if (issue.includes('invalid tracks detected')) {
          console.log('🔧 Auto-repair: Removing invalid tracks...');
          await this.removeInvalidTracks();
          repaired = true;
        }

        // Near end of queue
        if (issue.includes('Near end of queue')) {
          console.log('🔧 Auto-repair: Refilling queue...');
          DeviceEventEmitter.emit('queueRepairNeeded', {
            type: 'low_queue',
            action: 'refill',
          });
          repaired = true;
        }

        // High percentage of invalid tracks (critical)
        if (issue.includes('More than 20% of queue is invalid')) {
          console.log('🔧 Auto-repair: Critical queue cleanup needed');
          await this.performQueueCleanup();
          repaired = true;
        }
      }

      if (repaired) {
        // Re-check health after repair
        setTimeout(() => {
          this.performHealthCheck().catch(err => {
            console.error('Post-repair health check failed:', err);
          });
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Auto-repair failed:', error);
    }
  }

  /**
   * Remove invalid tracks from the queue
   */
  async removeInvalidTracks() {
    try {
      const queue = await TrackPlayer.getQueue();
      const validation = await queueValidator.validateQueue(queue, {
        removeInvalid: false,
      });

      if (validation.invalidTracks.length === 0) {
        console.log('✅ No invalid tracks to remove');
        return;
      }

      // Remove invalid tracks in reverse order (to maintain indices)
      const invalidIndices = validation.invalidTracks
        .map(item => item.index)
        .sort((a, b) => b - a);

      for (const index of invalidIndices) {
        try {
          await TrackPlayer.remove(index);
        } catch (e) {
          console.warn(`Failed to remove track at index ${index}:`, e.message);
        }
      }

      console.log(`✅ Removed ${invalidIndices.length} invalid tracks`);
      DeviceEventEmitter.emit('queueCleaned', {
        removedCount: invalidIndices.length,
      });
    } catch (error) {
      console.error('❌ Failed to remove invalid tracks:', error);
    }
  }

  /**
   * Perform comprehensive queue cleanup
   */
  async performQueueCleanup() {
    try {
      const queue = await TrackPlayer.getQueue();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      // Validate and get clean queue
      const validation = await queueValidator.validateQueue(queue, {
        removeInvalid: true,
        removeDuplicates: true,
      });

      if (validation.validTracks.length === 0) {
        console.error('❌ No valid tracks remain after cleanup');
        DeviceEventEmitter.emit('queueCleanupFailed', {
          reason: 'no_valid_tracks',
        });
        return;
      }

      // Determine which track to keep as active
      const activeTrack = queue[activeIndex];
      const newActiveIndex = activeTrack
        ? validation.validTracks.findIndex(t => t.id === activeTrack.id)
        : 0;

      // Reset queue with clean tracks
      await TrackPlayer.reset();
      await TrackPlayer.add(validation.validTracks);

      if (newActiveIndex >= 0) {
        await TrackPlayer.skip(newActiveIndex);
      }

      console.log(`✅ Queue cleaned: ${validation.validTracks.length} valid tracks`);
      DeviceEventEmitter.emit('queueCleaned', {
        originalCount: queue.length,
        cleanedCount: validation.validTracks.length,
        removedCount: queue.length - validation.validTracks.length,
      });
    } catch (error) {
      console.error('❌ Queue cleanup failed:', error);
    }
  }

  /**
   * Register callback for specific issue type
   * @param {string} issueType - Type of issue (e.g., 'empty_queue', 'invalid_tracks')
   * @param {Function} callback - Callback function
   */
  onIssue(issueType, callback) {
    if (!this.issueCallbacks.has(issueType)) {
      this.issueCallbacks.set(issueType, []);
    }
    this.issueCallbacks.get(issueType).push(callback);
  }

  /**
   * Trigger issue callbacks
   * @param {Object} report - Health report
   */
  triggerIssueCallbacks(report) {
    const issues = report.issues || [];

    for (const issue of issues) {
      // Match issue to types
      if (issue.includes('Queue is empty')) {
        this._triggerCallbacksForType('empty_queue', report);
      }
      if (issue.includes('invalid tracks')) {
        this._triggerCallbacksForType('invalid_tracks', report);
      }
      if (issue.includes('Near end of queue')) {
        this._triggerCallbacksForType('low_queue', report);
      }
      if (issue.includes('20% of queue is invalid')) {
        this._triggerCallbacksForType('critical_invalid', report);
      }
    }
  }

  /**
   * Trigger callbacks for a specific type
   * @private
   */
  _triggerCallbacksForType(type, report) {
    const callbacks = this.issueCallbacks.get(type);
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => {
        try {
          callback(report);
        } catch (e) {
          console.error(`Callback error for ${type}:`, e);
        }
      });
    }
  }

  /**
   * Get last health report
   */
  getLastHealthReport() {
    return this.lastHealthReport;
  }

  /**
   * Get health history
   */
  getHealthHistory() {
    return this.healthHistory;
  }

  /**
   * Get health trends
   */
  getHealthTrends() {
    if (this.healthHistory.length < 2) {
      return {
        trend: 'insufficient_data',
        message: 'Need more health reports for trend analysis',
      };
    }

    const recent = this.healthHistory.slice(-5);
    const criticalCount = recent.filter(r => r.status === 'critical').length;
    const warningCount = recent.filter(r => r.status === 'warning').length;
    const healthyCount = recent.filter(r => r.status === 'healthy').length;

    let trend = 'stable';
    let message = 'Queue health is stable';

    if (criticalCount > 0) {
      trend = 'declining';
      message = `Queue health declining: ${criticalCount} critical issues in recent checks`;
    } else if (warningCount >= 3) {
      trend = 'concerning';
      message = `Queue health concerning: ${warningCount} warnings in recent checks`;
    } else if (healthyCount === recent.length) {
      trend = 'improving';
      message = 'Queue health is excellent';
    }

    return {
      trend,
      message,
      recentChecks: recent.length,
      critical: criticalCount,
      warnings: warningCount,
      healthy: healthyCount,
    };
  }

  /**
   * Force immediate health check
   */
  async checkNow() {
    return await this.performHealthCheck();
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      autoRepairEnabled: this.autoRepairEnabled,
      lastCheck: this.lastHealthReport?.timestamp,
      healthStatus: this.lastHealthReport?.status,
      historyCount: this.healthHistory.length,
    };
  }
}

// Export singleton instance
const queueHealthMonitor = new QueueHealthMonitor();
export default queueHealthMonitor;
