import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_CONFIG = {
  maxEntries: 50,
  evictionPercent: 0.2,
  namespace: 'lru_cache',
  metadataKey: '_lru_meta',
};

class LRUCacheManager {
  constructor(config = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
    this.namespace = this.config.namespace;
    this.metadata = new Map();
    this.metadataLoaded = false;
    this.evictionInProgress = false;
  }

  _getStorageKey(key) {
    return `${this.namespace}_${key}`;
  }

  _getMetadataStorageKey() {
    return `${this.namespace}${this.config.metadataKey}`;
  }

  async _ensureMetadataLoaded() {
    if (this.metadataLoaded) {
      return;
    }
    try {
      const stored = await AsyncStorage.getItem(this._getMetadataStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        this.metadata = new Map(Object.entries(parsed));
      }
      this.metadataLoaded = true;
    } catch (error) {
      this.metadataLoaded = true;
    }
  }

  async _saveMetadata() {
    try {
      const metaObject = Object.fromEntries(this.metadata);
      await AsyncStorage.setItem(
        this._getMetadataStorageKey(),
        JSON.stringify(metaObject),
      );
    } catch (error) {}
  }

  _touch(key, size = 0) {
    this.metadata.set(key, {
      lastAccessed: Date.now(),
      size: size || this.metadata.get(key)?.size || 0,
    });
  }

  async evictOldest(count = null) {
    if (this.evictionInProgress) {
      return 0;
    }
    this.evictionInProgress = true;
    try {
      await this._ensureMetadataLoaded();
      const evictCount =
        count || Math.ceil(this.metadata.size * this.config.evictionPercent);
      if (evictCount <= 0 || this.metadata.size === 0) {
        return 0;
      }

      const entries = [...this.metadata.entries()];
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      const candidates = entries.slice(0, evictCount).map(([key]) => key);

      const keysToRemove = candidates.map(key => this._getStorageKey(key));
      await AsyncStorage.multiRemove(keysToRemove);

      for (const key of candidates) {
        this.metadata.delete(key);
      }
      await this._saveMetadata();
      return candidates.length;
    } catch (error) {
      return 0;
    } finally {
      this.evictionInProgress = false;
    }
  }

  async get(key) {
    try {
      await this._ensureMetadataLoaded();
      const storageKey = this._getStorageKey(key);
      const stored = await AsyncStorage.getItem(storageKey);
      if (!stored) {
        this.metadata.delete(key);
        return null;
      }
      const {data, timestamp, expiration} = JSON.parse(stored);
      if (expiration && Date.now() - timestamp > expiration * 60 * 1000) {
        await this.remove(key);
        return null;
      }
      this._touch(key);
      return data;
    } catch (error) {
      return null;
    }
  }

  async set(key, data, expiration = null) {
    try {
      await this._ensureMetadataLoaded();
      const cacheItem = {data, timestamp: Date.now(), expiration};
      const dataString = JSON.stringify(cacheItem);
      if (dataString.length > 500000) {
        return false;
      }

      const storageKey = this._getStorageKey(key);
      await AsyncStorage.setItem(storageKey, dataString);
      this._touch(key, dataString.length);
      await this._saveMetadata();

      if (this.metadata.size > this.config.maxEntries) {
        this.evictOldest().catch(() => {});
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async remove(key) {
    try {
      await AsyncStorage.removeItem(this._getStorageKey(key));
      this.metadata.delete(key);
    } catch (error) {}
  }

  async clear() {
    try {
      await this._ensureMetadataLoaded();
      const keysToRemove = [...this.metadata.keys()].map(key =>
        this._getStorageKey(key),
      );
      keysToRemove.push(this._getMetadataStorageKey());
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      this.metadata.clear();
    } catch (error) {}
  }
}

export const apiCache = new LRUCacheManager({
  namespace: 'api_cache',
  maxEntries: 100,
});
export const lyricsCache = new LRUCacheManager({
  namespace: 'lyrics_cache',
  maxEntries: 50,
});
export default LRUCacheManager;
