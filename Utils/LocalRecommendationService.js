/**
 * LocalRecommendationService.js
 *
 * Implements OuterTune-style "Quick Picks" by generating recommendations locally
 * based on the user's recent listening history.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import historyManager from './HistoryManager';
import InnerTubeClient from '../Api/InnertubeClient';

const CACHE_KEY = 'orbit_local_quick_picks';
const CACHE_EXPIRY = 1000 * 60 * 60 * 2;
const SEED_SONGS_COUNT = 5;

class LocalRecommendationService {
  async getCachedQuickPicks() {
    try {
      return (await this.getFromCache()) || [];
    } catch (error) {
      return [];
    }
  }

  async getQuickPicks(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        const cached = await this.getFromCache();
        if (cached) {
          return cached;
        }
      }

      const history = await historyManager.getFilteredHistory('recent');
      if (!history || history.length === 0) {
        return [];
      }

      const recentSongs = history
        .filter(
          item =>
            item.id &&
            (item.sourceType === 'ytmusic' || item.sourceType === 'online'),
        )
        .filter((item, index, self) => index === self.findIndex(t => t.id === item.id))
        .slice(0, SEED_SONGS_COUNT);

      if (recentSongs.length === 0) {
        return [];
      }

      const promises = recentSongs.map(song =>
        InnerTubeClient.getNext(song.id).catch(() => null),
      );

      const results = await Promise.all(promises);

      const validResults = results.filter(
        r => r && r.items && r.items.length > 0,
      );

      if (validResults.length === 0) {
        return [];
      }

      const songsToTakePerSeed = Math.ceil(24 / validResults.length);
      let aggregatedSongs = [];
      const seenIds = new Set();

      recentSongs.forEach(s => seenIds.add(s.id));

      validResults.forEach(result => {
        const candidates = result.items.slice(0, songsToTakePerSeed);

        candidates.forEach(song => {
          const id = song.videoId || song.id;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            aggregatedSongs.push(song);
          }
        });
      });

      aggregatedSongs = this.shuffleArray(aggregatedSongs).slice(0, 20);

      await this.saveToCache(aggregatedSongs);

      return aggregatedSongs;
    } catch (error) {
      console.error('LocalRecommendationService error:', error);
      return [];
    }
  }

  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async getFromCache() {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEY);
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
        return null;
      }
      return parsed.songs;
    } catch (e) {
      return null;
    }
  }

  async saveToCache(songs) {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          songs,
        }),
      );
    } catch (e) {}
  }

  async clearCache() {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }
}

const localRecommendationService = new LocalRecommendationService();
export default localRecommendationService;
