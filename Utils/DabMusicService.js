/**
 * DAB Music Service - Production-Ready Implementation
 * Handles search and streaming for DAB Music API
 * 
 * @module DabMusicService
 * @description Modular, clean service layer for DAB Music integration
 * CACHING: Stream URLs are cached for 3 hours via NavigationCacheManager
 */

import axios from 'axios';
import { ToastAndroid } from 'react-native';
import DabAuthService from './DabAuthService';
import { CacheManager } from './NavigationCacheManager';

// Configuration
const DAB_API_BASE = 'https://dabmusic.xyz/api';
const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 2;

/**
 * DAB Music Service Class
 * Singleton pattern for consistent state management
 */
class DabMusicService {
    constructor() {
        this.isInitialized = false;
        this.searchCache = new Map();
        this.streamCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Initialize the service
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            await DabAuthService.init();
            this.isInitialized = true;
            console.log('✅ DAB Music Service initialized');
        } catch (error) {
            console.error('❌ DAB Service initialization failed:', error);
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return DabAuthService.isAuth();
    }

    /**
     * Get current user
     * @returns {Object|null}
     */
    getCurrentUser() {
        return DabAuthService.getUser();
    }

    /**
     * Search for tracks with caching - AUTH REQUIRED
     * @param {string} query - Search query
     * @param {number} limit - Results limit (1-50)
     * @returns {Promise<Array>} Transformed tracks array
     */
    async searchTracks(query, limit = 20) {
        if (!query || query.length < 2) {
            return [];
        }

        // Check authentication - DAB requires login
        if (!this.isAuthenticated()) {
            throw new Error('AUTH_REQUIRED');
        }

        // Check cache first
        const cacheKey = `search_${query}_${limit}`;
        const cached = this._getFromCache(this.searchCache, cacheKey);
        if (cached) {
            console.log('🎯 Using cached DAB search results');
            return cached;
        }

        try {
            console.log(`🔍 Searching DAB for: "${query}"`);

            const response = await axios.get(`${DAB_API_BASE}/search`, {
                params: {
                    q: query,
                    type: 'track',
                    limit: Math.min(limit, 50)
                },
                timeout: REQUEST_TIMEOUT,
                withCredentials: true, // Important for authenticated requests
            });

            const tracks = response.data?.tracks || [];
            const transformed = tracks.map(this._transformTrack.bind(this));

            // Cache results
            this._setInCache(this.searchCache, cacheKey, transformed);

            console.log(`✅ Found ${transformed.length} DAB tracks`);
            return transformed;
        } catch (error) {
            console.error('❌ DAB search error:', error.message);
            this._handleError(error, 'Search failed');
            return [];
        }
    }

    /**
     * Get highest quality streaming URL for a track
     * @param {string} trackId - Track ID
     * @returns {Promise<string>} Stream URL
     */
    async getStreamUrl(trackId) {
        if (!trackId) {
            throw new Error('Track ID is required');
        }

        // CHECK CENTRALIZED CACHE FIRST (3-hour TTL)
        const cachedUrl = CacheManager.getStreamUrl(trackId, 'dab');
        if (cachedUrl) {
            console.log(`🚀 [Cache] DAB stream URL cache HIT for ${trackId}`);
            return cachedUrl;
        }

        try {
            console.log(`🎵 Getting stream URL for track: ${trackId}`);

            // Get authentication token
            const user = this.getCurrentUser();
            console.log('Current user:', user);

            // Request highest quality (you can make this configurable)
            const quality = '27'; // Default quality code

            // Build headers with auth token if available
            const headers = { 'Content-Type': 'application/json' };
            if (user && user.token) {
                headers['Authorization'] = `Bearer ${user.token}`;
                console.log('✅ Added auth token to stream request');
            } else {
                console.warn('⚠️ No auth token found for stream request');
            }

            const response = await axios.get(`${DAB_API_BASE}/stream`, {
                params: {
                    trackId,
                    quality
                },
                headers,
                timeout: REQUEST_TIMEOUT,
                withCredentials: true,
            });

            console.log('📦 Full stream API response:', JSON.stringify(response.data, null, 2));
            console.log('Response status:', response.status);

            // API returns "url" not "streamUrl"
            const streamUrl = response.data?.url;

            if (!streamUrl) {
                console.error('❌ No url in response. Response data:', response.data);
                throw new Error('No stream URL returned');
            }

            // CACHE THE URL with 3-hour TTL via NavigationCacheManager
            CacheManager.setStreamUrl(trackId, streamUrl, 'dab');
            console.log(`📦 [Cache] DAB stream URL cached for ${trackId} (3-hour TTL)`);

            console.log('✅ Got DAB stream URL');
            return streamUrl;
        } catch (error) {
            console.error('❌ DAB stream URL error:', error.message);
            if (error.response) {
                console.error('Error response data:', error.response.data);
                console.error('Error response status:', error.response.status);
            }
            this._handleError(error, 'Failed to get stream URL');
            throw error;
        }
    }

    /**
     * Transform DAB track to app format (Saavn-like)
     * @private
     */
    _transformTrack(track) {
        const imageArray = track.albumCover ? [
            { url: track.albumCover, quality: '50x50' },
            { url: track.albumCover, quality: '150x150' },
            { url: track.albumCover, quality: '500x500' }
        ] : [{
            url: 'https://via.placeholder.com/150',
            quality: '150x150'
        }];

        return {
            id: String(track.id),
            name: track.title,
            title: track.title,
            subtitle: track.artist || 'Unknown Artist',
            type: 'song',
            source: 'dab',
            isDabTrack: true, // Marker for easy detection
            image: imageArray,
            artist: track.artist || 'Unknown Artist',
            artists: {
                primary: track.artist ? [{ name: track.artist, id: track.artistId }] : []
            },
            duration: track.duration || 0,
            language: 'unknown',
            year: track.releaseDate ? track.releaseDate.split('-')[0] : '',
            albumId: String(track.albumId || ''),
            album: track.albumTitle || '',
            genre: track.genre || '',
            downloadUrl: String(track.id), // Store ID for streaming
            url: '', // Will be populated when playing
            artwork: imageArray[imageArray.length - 1]?.url, // Highest quality for player
            // DAB-specific metadata
            audioQuality: track.audioQuality || null,
            isHiRes: track.audioQuality?.isHiRes || false,
            maximumBitDepth: track.audioQuality?.maximumBitDepth || null,
            maximumSamplingRate: track.audioQuality?.maximumSamplingRate || null,
            qualityLabel: this._getQualityLabel(track.audioQuality),
        };
    }

    /**
     * Get quality label for track
     * @private
     */
    _getQualityLabel(audioQuality) {
        if (!audioQuality) return 'FLAC';

        const { isHiRes, maximumBitDepth, maximumSamplingRate } = audioQuality;

        if (isHiRes && maximumBitDepth && maximumSamplingRate) {
            return `Hi-Res ${maximumBitDepth}bit/${maximumSamplingRate}kHz`;
        }

        if (maximumBitDepth && maximumSamplingRate) {
            return `FLAC ${maximumBitDepth}bit/${maximumSamplingRate}kHz`;
        }

        return 'FLAC';
    }

    /**
     * Get from cache if not expired
     * @private
     */
    _getFromCache(cache, key) {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.timeout) {
            return cached.data;
        }
        cache.delete(key);
        return null;
    }

    /**
     * Set in cache with timestamp
     * @private
     */
    _setInCache(cache, key, data, timeout = this.cacheTimeout) {
        cache.set(key, {
            data,
            timestamp: Date.now(),
            timeout
        });
    }

    /**
     * Handle API errors
     * @private
     */
    _handleError(error, userMessage) {
        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                console.log('⚠️ DAB authentication required');
            } else if (status === 404) {
                console.log('⚠️ DAB resource not found');
            } else if (status === 429) {
                ToastAndroid.show('Rate limited. Please wait...', ToastAndroid.SHORT);
            }
        } else if (error.request) {
            console.log('⚠️ DAB network error');
            ToastAndroid.show('Network error. Check connection.', ToastAndroid.SHORT);
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.searchCache.clear();
        this.streamCache.clear();
        console.log('🗑️ DAB caches cleared');
    }

    /**
     * Get cache stats for debugging
     */
    getCacheStats() {
        return {
            searchCacheSize: this.searchCache.size,
            streamCacheSize: this.streamCache.size,
        };
    }
}

// Export singleton instance
const dabMusicService = new DabMusicService();

export default dabMusicService;
