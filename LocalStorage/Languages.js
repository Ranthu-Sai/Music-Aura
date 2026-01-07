import AsyncStorage from '@react-native-async-storage/async-storage';

async function GetLanguageValue() {
  try {
    const value = await AsyncStorage.getItem('Language');
    if (value !== null) {
      return value;
    } else {
      return '';
    }
  } catch (e) {
    // error reading value
    return '';
  }
}

async function SetLanguageValue(Language) {
  try {
    await AsyncStorage.setItem('Language', Language);
    return true;
  } catch (e) {
    // Error saving language
    return false;
  }
}

export {GetLanguageValue, SetLanguageValue};
