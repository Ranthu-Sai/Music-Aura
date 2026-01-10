import {ToastAndroid, Platform} from 'react-native';

/**
 * FileOperationErrorHandler - Utility for handling file operation errors
 *
 * This utility provides error handling capabilities including:
 * - Error categorization and classification
 * - User-friendly error messages
 * - Recovery suggestions
 * - Error logging and reporting
 */

export class FileOperationErrorHandler {
  /**
   * Handle file operation errors with appropriate user feedback
   * @param {Error} error - The error object
   * @param {string} operation - The operation that failed
   * @param {Object} options - Additional options
   */
  static handleError(error, operation = 'file operation', options = {}) {
    const {showToast = true, logError = true, onError = null} = options;

    if (logError) {
      console.error(`FileOperationErrorHandler: ${operation} failed:`, error);
    }

    const errorInfo = this.categorizeError(error);
    const userMessage = this.getUserMessage(errorInfo, operation);

    if (showToast && Platform.OS === 'android') {
      ToastAndroid.show(userMessage, ToastAndroid.LONG);
    }

    if (onError) {
      onError(error, errorInfo, userMessage);
    }

    return {
      error,
      errorInfo,
      userMessage,
      canRetry: this.canRetry(errorInfo),
      suggestedAction: this.getSuggestedAction(errorInfo),
    };
  }

  /**
   * Categorize error based on error message and type
   * @param {Error} error - The error object
   * @returns {Object} Error category information
   */
  static categorizeError(error) {
    if (!error) {
      return {
        type: 'unknown',
        severity: 'medium',
        recoverable: true,
      };
    }

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    // Permission errors
    if (
      message.includes('permission') ||
      message.includes('denied') ||
      code.includes('eacces')
    ) {
      return {
        type: 'permission',
        severity: 'high',
        recoverable: false,
        requiresUserAction: true,
      };
    }

    // File not found errors
    if (
      message.includes('not found') ||
      message.includes('enoent') ||
      code.includes('enoent')
    ) {
      return {
        type: 'file_not_found',
        severity: 'medium',
        recoverable: true,
      };
    }

    // Storage/disk errors
    if (
      message.includes('storage') ||
      message.includes('disk') ||
      message.includes('space') ||
      code.includes('enospc')
    ) {
      return {
        type: 'storage',
        severity: 'high',
        recoverable: false,
        requiresUserAction: true,
      };
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return {
        type: 'network',
        severity: 'medium',
        recoverable: true,
      };
    }

    // Data corruption errors
    if (
      message.includes('parse') ||
      message.includes('json') ||
      message.includes('corrupt')
    ) {
      return {
        type: 'data_corruption',
        severity: 'medium',
        recoverable: true,
      };
    }

    // Memory errors
    if (
      message.includes('memory') ||
      message.includes('heap') ||
      code.includes('enomem')
    ) {
      return {
        type: 'memory',
        severity: 'high',
        recoverable: true,
      };
    }

    // Default unknown error
    return {
      type: 'unknown',
      severity: 'medium',
      recoverable: true,
    };
  }

  /**
   * Get user-friendly error message
   * @param {Object} errorInfo - Error category information
   * @param {string} operation - The operation that failed
   * @returns {string} User-friendly message
   */
  static getUserMessage(errorInfo, operation) {
    const {type} = errorInfo;

    switch (type) {
      case 'permission':
        return 'Permission denied. Please check app permissions in device settings.';

      case 'file_not_found':
        return 'Music file not found. It may have been moved or deleted.';

      case 'storage':
        return 'Storage error. Please check available space on your device.';

      case 'network':
        return 'Network error. Please check your connection and try again.';

      case 'data_corruption':
        return 'Music data appears corrupted. Try refreshing your library.';

      case 'memory':
        return 'Insufficient memory. Please close other apps and try again.';

      default:
        return `Error during ${operation}. Please try again.`;
    }
  }

  /**
   * Check if error is recoverable through retry
   * @param {Object} errorInfo - Error category information
   * @returns {boolean} True if can retry
   */
  static canRetry(errorInfo) {
    const {type, recoverable} = errorInfo;

    // Some errors should not be retried
    const nonRetryableErrors = ['permission', 'storage'];

    return recoverable && !nonRetryableErrors.includes(type);
  }

  /**
   * Get suggested action for error recovery
   * @param {Object} errorInfo - Error category information
   * @returns {string} Suggested action
   */
  static getSuggestedAction(errorInfo) {
    const {type} = errorInfo;

    switch (type) {
      case 'permission':
        return 'Check app permissions in device settings';

      case 'file_not_found':
        return 'Refresh music library or re-download missing files';

      case 'storage':
        return 'Free up storage space on your device';

      case 'network':
        return 'Check internet connection and retry';

      case 'data_corruption':
        return 'Clear app cache or refresh music library';

      case 'memory':
        return 'Close other apps and try again';

      default:
        return 'Try again or restart the app';
    }
  }

  /**
   * Create error report for debugging
   * @param {Error} error - The error object
   * @param {string} operation - The operation that failed
   * @param {Object} context - Additional context
   * @returns {Object} Error report
   */
  static createErrorReport(error, operation, context = {}) {
    const errorInfo = this.categorizeError(error);

    return {
      timestamp: new Date().toISOString(),
      operation,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      },
      errorInfo,
      context,
      platform: Platform.OS,
      version: Platform.Version,
    };
  }

  /**
   * Wrap async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} operation - Operation name for error reporting
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  static wrapAsyncOperation(fn, operation, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const result = this.handleError(error, operation, options);

        if (options.throwOnError !== false) {
          throw error;
        }

        return {
          success: false,
          error: result.error,
          errorInfo: result.errorInfo,
          userMessage: result.userMessage,
        };
      }
    };
  }

  /**
   * Retry operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise} Operation result
   */
  static async retryOperation(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      onRetry = null,
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const errorInfo = this.categorizeError(error);

        // Don't retry if error is not recoverable
        if (!this.canRetry(errorInfo)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt),
          maxDelay,
        );

        // Debug: retry log removed


        if (onRetry) {
          onRetry(attempt + 1, error, delay);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
