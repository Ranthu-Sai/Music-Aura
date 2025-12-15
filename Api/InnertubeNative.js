import { NativeModules } from 'react-native';

const { InnerTubeModule } = NativeModules;

/**
 * InnertubeNative - Wrapper for native InnerTube implementation (OuterTune port)
 * 
 * ✅ FIX #1: Null Safety - Checks if module is available before use
 * ✅ FIX #3: Error Handling - Provides context in error messages
 */
class InnertubeNative {
    /**
     * Check if native module is available
     */
    static isAvailable() {
        return InnerTubeModule !== null && InnerTubeModule !== undefined;
    }

    /**
     * Throw error if module not available
     * This ONLY checks if module exists, not if API calls work
     * @private
     */
    static _checkModule() {
        if (!this.isAvailable()) {
            throw new Error(
                '❌ InnerTubeModule is not available.\n' +
                'This means the native Kotlin code hasn\'t been compiled yet.\n' +
                '👉 Solution: Rebuild the Android app with: npm run android'
            );
        }
    }

    /**
     * Search YouTube Music
     * @param {string} query - Search query
     * @param {string} filter - Filter type: 'songs', 'videos', 'albums', 'artists', 'playlists'
     * @returns {Promise<object>} Search results with 'items' array
     */
    static async search(query, filter = 'songs') {
        this._checkModule();
        try {
            const resultJson = await InnerTubeModule.search(query, filter);
            return JSON.parse(resultJson);
        } catch (error) {
            // Log for debugging but preserve original error
            console.error('[InnertubeNative] Search error:', {
                query,
                filter,
                error: error.message
            });
            // Re-throw original error so caller sees actual problem
            throw error;
        }
    }

    /**
     * Get home feed
     * @returns {Promise<object>} Home feed with 'sections' array
     */
    static async getHome() {
        this._checkModule();
        try {
            const resultJson = await InnerTubeModule.getHome();
            return JSON.parse(resultJson);
        } catch (error) {
            console.error('[InnertubeNative] Home error:', error.message);
            throw error; // Preserve original error from Kotlin
        }
    }

    /**
     * Get artist details
     * @param {string} browseId - Artist browse ID (starts with 'UC')
     * @returns {Promise<object>} Artist page data
     */
    static async getArtist(browseId) {
        this._checkModule();
        try {
            const resultJson = await InnerTubeModule.getArtist(browseId);
            return JSON.parse(resultJson);
        } catch (error) {
            console.error('[InnertubeNative] Artist error:', {
                browseId,
                error: error.message
            });
            throw error; // Preserve original error
        }
    }

    /**
     * Get album details
     * @param {string} browseId - Album browse ID (starts with 'MPRE' or 'OLAK')
     * @returns {Promise<object>} Album page data with songs
     */
    static async getAlbum(browseId) {
        this._checkModule();
        try {
            const resultJson = await InnerTubeModule.getAlbum(browseId);
            return JSON.parse(resultJson);
        } catch (error) {
            console.error('[InnertubeNative] Album error:', {
                browseId,
                error: error.message
            });
            throw error; // Preserve original error
        }
    }

    /**
     * Get playlist details
     * @param {string} playlistId - Playlist ID
     * @returns {Promise<object>} Playlist page data with songs
     */
    static async getPlaylist(playlistId) {
        this._checkModule();
        try {
            const resultJson = await InnerTubeModule.getPlaylist(playlistId);
            return JSON.parse(resultJson);
        } catch (error) {
            console.error('[InnertubeNative] Playlist error:', {
                playlistId,
                error: error.message
            });
            throw error; // Preserve original error
        }
    }

    /**
     * Get next/recommendations for a video
     * @param {string} videoId - Video ID
     * @param {string|null} playlistId - Optional playlist ID
     * @returns {Promise<object>} Next/recommendations data
     */
    static async getNext(videoId, playlistId = null) {
        this._checkModule();
        try {
            const resultJson = await InnerTubeModule.getNext(videoId, playlistId);
            return JSON.parse(resultJson);
        } catch (error) {
            console.error('[InnertubeNative] Next error:', {
                videoId,
                playlistId,
                error: error.message
            });
            throw error; // Preserve original error
        }
    }
}

export default InnertubeNative;
