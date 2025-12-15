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
        this.debounceDelay = 300; // ms
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

        // If already skipping, queue this skip or ignore based on immediate flag
        if (this.isSkipping) {
            console.log('⏭️ Skip blocked - operation already in progress');
            return false;
        }

        // Cancel any in-flight fetch operations
        this.cancelInFlightOperations();

        // Execute immediately or with debounce
        if (immediate) {
            return await this._performSkip(operation);
        } else {
            return new Promise((resolve) => {
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

        try {
            await operation(this.abortController.signal);
            console.log('✅ Skip operation completed');
            return true;
        } catch (error) {
            // Ignore abort errors (expected when cancelling)
            if (error.name === 'AbortError') {
                console.log('🚫 Skip operation cancelled');
            } else {
                console.error('❌ Skip operation failed:', error);
            }
            return false;
        } finally {
            this.isSkipping = false;
            this.abortController = null;
        }
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
