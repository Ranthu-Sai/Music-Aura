import AsyncStorage from '@react-native-async-storage/async-storage';
import queueValidator from '../Utils/QueueValidator';

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 300;
const BACKUP_KEY = 'QueueSongs_Backup';
const MAIN_KEY = 'QueueSongs';

/**
 * Get queue songs from storage with validation and retry logic
 * @param {Object} options - Options for retrieval
 * @returns {Promise<Array>} - Array of validated tracks
 */
async function GetQueueSongs(options = {}) {
  const {useBackup = true, maxRetries = MAX_RETRIES} = options;



  // Try main storage with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const value = await AsyncStorage.getItem(MAIN_KEY);

      if (value !== null) {
        const parsed = JSON.parse(value);

        // Validate the queue before returning
        const validation = await queueValidator.validateQueue(parsed, {
          removeInvalid: true,
          removeDuplicates: true,
          enforceMaxSize: true,
        });

        if (validation.validTracks.length > 0) {
          if (validation.invalidTracks.length > 0) {
            // Save the cleaned queue back to storage
            await SetQueueSongs(validation.validTracks, {skipValidation: true});
          }

          return validation.validTracks;
        }
      }

      // If we reach here, no valid queue in main storage
      break;
    } catch (e) {

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  // Try backup if enabled and main failed
  if (useBackup) {
    try {
      const backupValue = await AsyncStorage.getItem(BACKUP_KEY);

      if (backupValue !== null) {
        const parsed = JSON.parse(backupValue);
        const validation = await queueValidator.validateQueue(parsed, {
          removeInvalid: true,
          removeDuplicates: true,
        });

        if (validation.validTracks.length > 0) {
          // Restore to main storage
          await SetQueueSongs(validation.validTracks, {skipValidation: true});
          return validation.validTracks;
        }
      }
    } catch (backupError) {
      // Backup restore failed silently
    }
  }

  return [];
}

/**
 * Set queue songs to storage with validation and compression
 * @param {Array} queue - Queue to save
 * @param {Object} options - Options for storage
 * @returns {Promise<boolean>} - Success status
 */
async function SetQueueSongs(queue, options = {}) {
  const {
    skipValidation = false,
    createBackup = true,
    maxRetries = MAX_RETRIES,
  } = options;

  if (!Array.isArray(queue) || queue.length === 0) {
    return false;
  }

  try {
    let queueToSave = queue;

    // Validate and compress queue if not skipped
    if (!skipValidation) {
      const validation = await queueValidator.validateQueue(queue, {
        removeInvalid: true,
        removeDuplicates: true,
        enforceMaxSize: true,
      });

      if (validation.validTracks.length === 0) {
        return false;
      }

      queueToSave = queueValidator.compressQueueForStorage(validation.validTracks);

      // Check size
      const sizeCheck = queueValidator.checkStorageSize(queueToSave);

      if (!sizeCheck.withinLimit) {
        // Keep only first 60% of tracks to stay within limit
        const truncateAt = Math.floor(queueToSave.length * 0.6);
        queueToSave = queueToSave.slice(0, truncateAt);
      }

    }

    // Create backup of existing queue before overwriting
    if (createBackup) {
      try {
        const existing = await AsyncStorage.getItem(MAIN_KEY);
        if (existing !== null) {
          await AsyncStorage.setItem(BACKUP_KEY, existing);
        }
      } catch (backupError) {
        // Backup failure shouldn't stop main save
      }
    }

    // Save with retry logic

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const jsonValue = JSON.stringify(queueToSave);
        await AsyncStorage.setItem(MAIN_KEY, jsonValue);
        return true;
      } catch (e) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    return false;

  } catch (error) {
    return false;
  }
}

/**
 * Clear all queue storage (main and backup)
 * @returns {Promise<boolean>}
 */
async function ClearQueueStorage() {
  try {
    await AsyncStorage.multiRemove([MAIN_KEY, BACKUP_KEY]);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get queue storage info
 * @returns {Promise<Object>} - Storage statistics
 */
async function GetQueueStorageInfo() {
  try {
    const mainValue = await AsyncStorage.getItem(MAIN_KEY);
    const backupValue = await AsyncStorage.getItem(BACKUP_KEY);

    const info = {
      hasMainQueue: mainValue !== null,
      hasBackup: backupValue !== null,
      mainQueueSize: mainValue ? (new Blob([mainValue]).size / 1024).toFixed(2) + ' KB' : '0 KB',
      backupQueueSize: backupValue ? (new Blob([backupValue]).size / 1024).toFixed(2) + ' KB' : '0 KB',
    };

    if (mainValue) {
      try {
        const parsed = JSON.parse(mainValue);
        info.mainQueueLength = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        info.mainQueueLength = 'corrupted';
      }
    }

    return info;
  } catch (e) {
    return {error: e.message};
  }
}

export {GetQueueSongs, SetQueueSongs, ClearQueueStorage, GetQueueStorageInfo};
