import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_HISTORY_ITEMS = 20;

async function GetSearchHistory() {
  try {
    const value = await AsyncStorage.getItem('SearchHistory');
    if (value !== null) {
      return JSON.parse(value);
    } else {
      return [];
    }
  } catch (e) {
    console.error("Error getting search history:", e);
    return [];
  }
}

async function AddSearchHistory(query) {
  try {
    if (!query || query.trim() === "") {
      return;
    }

    const history = await GetSearchHistory();

    const filteredHistory = history.filter(item => item.toLowerCase() !== query.toLowerCase());

    const newHistory = [query, ...filteredHistory];

    const trimmedHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);

    const jsonValue = JSON.stringify(trimmedHistory);
    await AsyncStorage.setItem('SearchHistory', jsonValue);

    return trimmedHistory;
  } catch (e) {
    console.error("Error adding search history:", e);
  }
}

async function RemoveSearchHistoryItem(query) {
  try {
    const history = await GetSearchHistory();
    const filteredHistory = history.filter(item => item !== query);

    const jsonValue = JSON.stringify(filteredHistory);
    await AsyncStorage.setItem('SearchHistory', jsonValue);

    return filteredHistory;
  } catch (e) {
    console.error("Error removing search history item:", e);
  }
}

async function ClearSearchHistory() {
  try {
    await AsyncStorage.removeItem('SearchHistory');
    return [];
  } catch (e) {
    console.error("Error clearing search history:", e);
  }
}

export { GetSearchHistory, AddSearchHistory, RemoveSearchHistoryItem, ClearSearchHistory };
