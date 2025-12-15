import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * DAB Music Authentication Service
 * Manages user authentication state and session storage
 */

const DAB_USER_KEY = '@dab_user';
const DAB_SESSION_KEY = '@dab_session';

class DabAuthService {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.listeners = [];
    }

    /**
     * Initialize auth service (load stored user)
     */
    async init() {
        try {
            const userData = await AsyncStorage.getItem(DAB_USER_KEY);
            if (userData) {
                this.user = JSON.parse(userData);
                this.isAuthenticated = true;
                this.notifyListeners();
            }
        } catch (error) {
            console.error('Error initializing DAB auth:', error);
        }
    }

    /**
     * Set current user
     * @param {Object} user - User data
     */
    async setUser(user) {
        try {
            this.user = user;
            this.isAuthenticated = true;
            await AsyncStorage.setItem(DAB_USER_KEY, JSON.stringify(user));
            this.notifyListeners();
        } catch (error) {
            console.error('Error setting DAB user:', error);
            throw error;
        }
    }

    /**
     * Get current user
     * @returns {Object|null} Current user
     */
    getUser() {
        return this.user;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuth() {
        return this.isAuthenticated;
    }

    /**
     * Clear user session
     */
    async clearUser() {
        try {
            this.user = null;
            this.isAuthenticated = false;
            await AsyncStorage.removeItem(DAB_USER_KEY);
            await AsyncStorage.removeItem(DAB_SESSION_KEY);
            this.notifyListeners();
        } catch (error) {
            console.error('Error clearing DAB user:', error);
            throw error;
        }
    }

    /**
     * Store session token (if needed)
     * @param {string} token - Session token
     */
    async setSessionToken(token) {
        try {
            await AsyncStorage.setItem(DAB_SESSION_KEY, token);
        } catch (error) {
            console.error('Error setting DAB session token:', error);
            throw error;
        }
    }

    /**
     * Get session token
     * @returns {string|null} Session token
     */
    async getSessionToken() {
        try {
            return await AsyncStorage.getItem(DAB_SESSION_KEY);
        } catch (error) {
            console.error('Error getting DAB session token:', error);
            return null;
        }
    }

    /**
     * Add auth state change listener
     * @param {Function} callback - Listener callback
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove auth state change listener
     * @param {Function} callback - Listener callback
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    /**
     * Notify all listeners of auth state change
     */
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback({
                    user: this.user,
                    isAuthenticated: this.isAuthenticated
                });
            } catch (error) {
                console.error('Error in DAB auth listener:', error);
            }
        });
    }

    /**
     * Get user ID
     * @returns {string|null} User ID
     */
    getUserId() {
        return this.user?.id || null;
    }

    /**
     * Get username
     * @returns {string|null} Username
     */
    getUsername() {
        return this.user?.username || null;
    }

    /**
     * Get user email
     * @returns {string|null} User email
     */
    getUserEmail() {
        return this.user?.email || null;
    }
}

// Create singleton instance
const dabAuthService = new DabAuthService();

// Initialize on import
dabAuthService.init();

export default dabAuthService;
