import AsyncStorage from "@react-native-async-storage/async-storage";

async function GetFontSizeValue() {
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

async function SetFontSizeValue(FontSize) {
  try {
    await AsyncStorage.setItem('FontSize', FontSize);
  } catch (e) {
    // Error saving font size
  }
}

async function GetPlaybackQuality() {
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

async function SetPlaybackQuality(PlaybackQuality) {
  try {
    await AsyncStorage.setItem('PlaybackQuality', PlaybackQuality);
  } catch (e) {
    // Error saving playback quality
  }
}

async function GetDownloadPath() {
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

async function SetDownloadPath(DownloadPath) {
  try {
    await AsyncStorage.setItem('DownloadPath', DownloadPath);
  } catch (e) {
    // Error saving download path
  }
}

async function GetTheme() {
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

async function SetTheme(Theme) {
  try {
    await AsyncStorage.setItem('Theme', Theme);
  } catch (e) {
    // Error saving theme
  }
}

async function GetLastSong() {
  try {
    const value = await AsyncStorage.getItem('LastSong');
    if (value !== null) {
      const song = JSON.parse(value);

      // Validate song object has required fields
      if (song && song.id && song.title && song.url) {
        console.log('✅ Retrieved last song:', song.title);
        return song;
      } else {
        console.warn('⚠️ Last song data invalid, clearing...');
        await AsyncStorage.removeItem('LastSong');
        return null;
      }
    } else {
      console.log('📍 No last song found');
      return null;
    }
  } catch (e) {
    console.error('❌ Error reading last song:', e);
    // Try to clear corrupted data
    try {
      await AsyncStorage.removeItem('LastSong');
    } catch (_) { }
    return null;
  }
}

async function SetLastSong(song) {
  try {
    // Validate song object before saving
    if (!song || !song.id || !song.title) {
      console.warn('⚠️ Cannot save invalid song');
      return false;
    }

    // Create a clean song object with only necessary fields
    const songToSave = {
      id: song.id,
      title: song.title,
      artist: song.artist || 'Unknown Artist',
      artwork: song.artwork || song.image || '',
      url: song.url || song.id,
      duration: song.duration || 0,
      language: song.language || 'en',
      image: song.image || song.artwork || '',
      // Include optional fields if available
      ...(song.downloadUrl && { downloadUrl: song.downloadUrl }),
      ...(song.artistID && { artistID: song.artistID }),
      ...(song.headers && { headers: song.headers }),
    };

    const jsonValue = JSON.stringify(songToSave);
    await AsyncStorage.setItem('LastSong', jsonValue);
    console.log('💾 Saved last song:', songToSave.title);
    return true;
  } catch (e) {
    console.error('❌ Error saving last song:', e);
    return false;
  }
}


export { GetFontSizeValue, SetFontSizeValue, GetPlaybackQuality, SetPlaybackQuality, GetDownloadPath, SetDownloadPath, GetTheme, SetTheme, GetLastSong, SetLastSong }
