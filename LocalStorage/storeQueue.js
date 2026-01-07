import AsyncStorage from '@react-native-async-storage/async-storage';

async function GetQueueSongs() {
  try {
    const value = await AsyncStorage.getItem('QueueSongs');
    if (value !== null) {
      return JSON.parse(value);
    } else {
      return [];
    }
  } catch (e) {
    // error reading value
    return [];
  }
}

async function SetQueueSongs(queue) {
  try {
    const jsonValue = JSON.stringify(queue);
    await AsyncStorage.setItem('QueueSongs', jsonValue);
    return true;
  } catch (e) {
    // Error saving queue
    return false;
  }
}
export {GetQueueSongs, SetQueueSongs};
