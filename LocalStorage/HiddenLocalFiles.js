import AsyncStorage from '@react-native-async-storage/async-storage';

const HIDDEN_FILES_KEY = '@hidden_local_files';

/**
 * Get list of hidden file paths
 */
export async function getHiddenFiles() {
  try {
    const hiddenFiles = await AsyncStorage.getItem(HIDDEN_FILES_KEY);
    return hiddenFiles ? JSON.parse(hiddenFiles) : [];
  } catch (error) {
    console.error('Error getting hidden files:', error);
    return [];
  }
}

/**
 * Add a file path to the hidden list
 */
export async function hideFile(filePath) {
  try {
    const hiddenFiles = await getHiddenFiles();
    if (!hiddenFiles.includes(filePath)) {
      hiddenFiles.push(filePath);
      await AsyncStorage.setItem(HIDDEN_FILES_KEY, JSON.stringify(hiddenFiles));

    }
    return true;
  } catch (error) {
    console.error('Error hiding file:', error);
    return false;
  }
}

/**
 * Remove a file path from the hidden list (unhide)
 */
export async function unhideFile(filePath) {
  try {
    const hiddenFiles = await getHiddenFiles();
    const filtered = hiddenFiles.filter(path => path !== filePath);
    await AsyncStorage.setItem(HIDDEN_FILES_KEY, JSON.stringify(filtered));

    return true;
  } catch (error) {
    console.error('Error unhiding file:', error);
    return false;
  }
}

/**
 * Check if a file is hidden
 */
export async function isFileHidden(filePath) {
  try {
    const hiddenFiles = await getHiddenFiles();
    return hiddenFiles.includes(filePath);
  } catch (error) {
    console.error('Error checking if file is hidden:', error);
    return false;
  }
}

/**
 * Clear all hidden files
 */
export async function clearHiddenFiles() {
  try {
    await AsyncStorage.removeItem(HIDDEN_FILES_KEY);

    return true;
  } catch (error) {
    console.error('Error clearing hidden files:', error);
    return false;
  }
}
