/**
 * Simple event emitter for the app
 * Prevents callback leaks by centralizing event management
 */

class EventRegister {
  constructor() {
    this.listeners = {};
    this.listenerCount = 0;
  }

  /**
   * Add an event listener
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @returns {number} Listener ID that can be used to remove the listener
   */
  addEventListener(eventName, callback) {
    if (!eventName || typeof eventName !== 'string') {
      console.error('Event name must be a valid string');
      return -1;
    }

    if (!callback || typeof callback !== 'function') {
      console.error('Callback must be a function');
      return -1;
    }

    if (!this.listeners[eventName]) {
      this.listeners[eventName] = {};
    }

    const listenerId = ++this.listenerCount;
    this.listeners[eventName][listenerId] = callback;
    return listenerId;
  }

  /**
   * Remove an event listener by ID
   * @param {number} id - Listener ID returned from addEventListener
   * @returns {boolean} True if removed successfully
   */
  removeEventListener(id) {
    if (id === -1 || !id) {
      return false;
    }

    for (const eventName in this.listeners) {
      const eventListeners = this.listeners[eventName];
      if (eventListeners && eventListeners[id]) {
        delete eventListeners[id];

        // Clean up empty event listener objects
        if (Object.keys(eventListeners).length === 0) {
          delete this.listeners[eventName];
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all listeners for a specific event
   * @param {string} eventName - Event name to remove listeners for
   */
  removeAllListeners(eventName) {
    if (eventName && typeof eventName === 'string') {
      delete this.listeners[eventName];
    }
  }

  /**
   * Emit an event with optional data
   * @param {string} eventName - Name of the event to emit
   * @param {any} data - Data to pass to the listeners
   */
  emit(eventName, data) {
    if (!eventName || typeof eventName !== 'string') {
      return;
    }

    const listeners = this.listeners[eventName];
    if (!listeners) {
      return;
    }

    for (const id in listeners) {
      try {
        listeners[id](data);
      } catch (error) {
        console.error(`Error in listener for event ${eventName}:`, error);
      }
    }
  }
}

// Create a singleton instance
const eventRegister = new EventRegister();

export default eventRegister;
