/**
 * EventDebouncer
 * 
 * Utility for debouncing event handlers to prevent excessive processing
 * during rapid event firing (e.g., track changes, queue updates).
 * 
 * Features:
 * - Configurable debounce delay
 * - Immediate execution option
 * - Cleanup on unmount
 */

/**
 * Creates a debounced version of a function
 * 
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {boolean} immediate - If true, trigger on leading edge instead of trailing
 * @returns {Function} - Debounced function
 */
export function debounce(func, delay = 300, immediate = false) {
    let timeoutId = null;

    const debouncedFunction = function (...args) {
        const context = this;

        const later = () => {
            timeoutId = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };

        const callNow = immediate && !timeoutId;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(later, delay);

        if (callNow) {
            func.apply(context, args);
        }
    };

    // Attach cancel method to debounced function
    debouncedFunction.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debouncedFunction;
}

/**
 * Creates a throttled version of a function
 * Only allows the function to be called once per time period
 * 
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit = 300) {
    let inThrottle = false;
    let lastResult;

    return function (...args) {
        const context = this;

        if (!inThrottle) {
            lastResult = func.apply(context, args);
            inThrottle = true;

            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }

        return lastResult;
    };
}

/**
 * Event handler wrapper that prevents duplicate calls for the same data
 * Useful for preventing redundant processing when events fire multiple times
 * 
 * @param {Function} handler - Event handler function
 * @param {Function} keyExtractor - Function to extract unique key from event data
 * @returns {Function} - Wrapped handler
 */
export function deduplicateEventHandler(handler, keyExtractor = (data) => JSON.stringify(data)) {
    let lastKey = null;

    return function (eventData) {
        const currentKey = keyExtractor(eventData);

        if (currentKey === lastKey) {
            console.log('🔄 Skipping duplicate event');
            return;
        }

        lastKey = currentKey;
        return handler.call(this, eventData);
    };
}

export default {
    debounce,
    throttle,
    deduplicateEventHandler
};
