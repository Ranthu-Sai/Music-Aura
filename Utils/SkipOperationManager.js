/**
 * SkipOperationManager
 *
 * Manages skip operations with debouncing and locking to prevent
 * excessive pending callbacks during rapid user interactions.
 *
 * Features:
 * - Debounced skip operations
 * - Operation locking to prevent concurrent skips
 * - Abort controller for cancelling in-flight operations
 * - Skip attempt limiting to prevent infinite loops
 */

class SkipOperationManager {
  constructor() {
    this.isSkipping = false;
    this.skipDebounceTimer = null;
    this.abortController = null;
    this.consecutiveSkipErrors = 0;
    this.maxConsecutiveErrors = 3;
    this.debounceDelay = 150; // ms
    // Promise that resolves when the current skip operation completes
    this._currentSkipPromise = null;
  }

  /**
   * Check if a skip operation is currently in progress
   */
  isOperationInProgress() {
    return this.isSkipping;
  }

  /**
   * Reset error counter (call on successful playback)
   */
  resetErrorCounter() {
    this.consecutiveSkipErrors = 0;
  }

  /**
   * Increment error counter
   * @returns {boolean} true if max errors not exceeded, false otherwise
   */
  incrementErrorCounter() {
    this.consecutiveSkipErrors++;
    return this.consecutiveSkipErrors < this.maxConsecutiveErrors;
  }

  /**
   * Get current error count
   */
  getErrorCount() {
    return this.consecutiveSkipErrors;
  }

  /**
   * Cancel any in-flight operations
   */
  cancelInFlightOperations() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Execute a skip operation with debouncing and locking
   *
   * @param {Function} operation - The skip operation to execute
   * @param {boolean} immediate - If true, skip debouncing
   * @returns {Promise<boolean>} - true if operation was executed, false if blocked
   */
  async executeSkip(operation, immediate = false) {
    // Clear any pending debounced skip
    if (this.skipDebounceTimer) {
      clearTimeout(this.skipDebounceTimer);
      this.skipDebounceTimer = null;
    }

    // Cancel any in-flight fetch operations
    this.cancelInFlightOperations();

    // If a skip is in progress, wait for it to finish (it should complete
    // quickly since we just aborted its signal) instead of silently dropping
    // the new request. This prevents Previous from being lost when Next is
    // still running.
    if (this.isSkipping && this._currentSkipPromise) {
      try {
        await this._currentSkipPromise;
      } catch (_) {
        // Ignore — the aborted operation may reject
      }
    }

    // After waiting, re-check — should be false now
    if (this.isSkipping) {
      // Force-reset as safety valve if the promise didn't clear the flag
      this.isSkipping = false;
      this.abortController = null;
    }

    // Execute immediately or with debounce
    if (immediate) {
      return await this._performSkip(operation);
    } else {
      return new Promise(resolve => {
        this.skipDebounceTimer = setTimeout(async () => {
          const result = await this._performSkip(operation);
          resolve(result);
        }, this.debounceDelay);
      });
    }
  }

  /**
   * Internal method to perform the actual skip
   * @private
   */
  async _performSkip(operation) {
    this.isSkipping = true;
    this.abortController = new AbortController();

    // Store promise so executeSkip can wait for it if a new skip arrives
    this._currentSkipPromise = (async () => {
      try {
        await operation(this.abortController.signal);
        return true;
      } catch (error) {
        if (error.name === 'AbortError' || error.message === 'AbortError') {
          // Expected when cancelling
        }
        return false;
      } finally {
        this.isSkipping = false;
        this.abortController = null;
      }
    })();

    return await this._currentSkipPromise;
  }

  /**
   * Clear all timers and controllers (cleanup)
   */
  cleanup() {
    if (this.skipDebounceTimer) {
      clearTimeout(this.skipDebounceTimer);
      this.skipDebounceTimer = null;
    }
    this.cancelInFlightOperations();
    this.isSkipping = false;
  }
}

// Singleton instance
const skipOperationManager = new SkipOperationManager();

export default skipOperationManager;
