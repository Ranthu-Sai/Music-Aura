import AsyncStorage from "@react-native-async-storage/async-storage";

async function GetFontSizeValue(){
  try {
    const value = await AsyncStorage.getItem('FontSize');
    if (value !== null) {
      return value
    } else {
      return 'Medium'
    }
  } catch (e) {
    // error reading value
  }
}

async function SetFontSizeValue(FontSize){
  try {
    await AsyncStorage.setItem('FontSize', FontSize);
  } catch (e) {
    // Error saving font size
  }
}

async function GetPlaybackQuality(){
  try {
    const value = await AsyncStorage.getItem('PlaybackQuality');
    if (value !== null) {
      return value
    } else {
      return '320kbps'
    }
  } catch (e) {
    // error reading value
  }
}

async function SetPlaybackQuality(PlaybackQuality){
  try {
    await AsyncStorage.setItem('PlaybackQuality', PlaybackQuality);
  } catch (e) {
    // Error saving playback quality
  }
}

async function GetDownloadPath(){
  try {
    const value = await AsyncStorage.getItem('DownloadPath');
    if (value !== null) {
      return value
    } else {
      return 'Music'
    }
  } catch (e) {
    // error reading value
  }
}

async function SetDownloadPath(DownloadPath){
  try {
    await AsyncStorage.setItem('DownloadPath', DownloadPath);
  } catch (e) {
    // Error saving download path
  }
}

async function GetTheme(){
  try {
    const value = await AsyncStorage.getItem('Theme');
    if (value !== null) {
      return value
    } else {
      return 'Default'
    }
  } catch (e) {
    // error reading value
  }
}

async function SetTheme(Theme){
  try {
    await AsyncStorage.setItem('Theme', Theme);
  } catch (e) {
    // Error saving theme
  }
}

async function GetLastSong(){
  try {
    const value = await AsyncStorage.getItem('LastSong');
    if (value !== null) {
      return JSON.parse(value)
    } else {
      return null
    }
  } catch (e) {
    // error reading value
  }
}

async function SetLastSong(song){
  try {
    const jsonValue = JSON.stringify(song);
    await AsyncStorage.setItem('LastSong', jsonValue);
  } catch (e) {
    // Error saving last song
  }
}

export {GetFontSizeValue, SetFontSizeValue, GetPlaybackQuality, SetPlaybackQuality, GetDownloadPath, SetDownloadPath, GetTheme, SetTheme, GetLastSong, SetLastSong}
