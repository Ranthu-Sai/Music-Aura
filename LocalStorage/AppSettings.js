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
    return 'Medium'
  }
}

async function SetFontSizeValue(FontSize) {
  try {
    await AsyncStorage.setItem('FontSize', FontSize);
    return true;
  } catch (e) {
    // Error saving font size
    return false;
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
    return '320kbps'
  }
}

async function SetPlaybackQuality(PlaybackQuality) {
  try {
    await AsyncStorage.setItem('PlaybackQuality', PlaybackQuality);
    return true;
  } catch (e) {
    // Error saving playback quality
    return false;
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
    return 'Music'
  }
}

async function SetDownloadPath(DownloadPath) {
  try {
    await AsyncStorage.setItem('DownloadPath', DownloadPath);
    return true;
  } catch (e) {
    // Error saving download path
    return false;
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
    return 'Default'
  }
}

async function SetTheme(Theme) {
  try {
    await AsyncStorage.setItem('Theme', Theme);
    return true;
  } catch (e) {
    // Error saving theme
    return false;
  }
}

async function GetLastSong() {
  try {
    const value = await AsyncStorage.getItem('LastSong');
    if (value !== null) {
      const song = JSON.parse(value);

      // Validate song object has required fields
      if (song && song.id && song.title && song.url) {
        return song;
      } else {
        await AsyncStorage.removeItem('LastSong');
        return null;
      }
    } else {
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
    return true;
  } catch (e) {
    console.error('❌ Error saving last song:', e);
    return false;
  }
}


async function GetLyricsSettings() {
  try {
    const settings = await AsyncStorage.getItem('LyricsSettings');
    if (settings !== null) {
      return JSON.parse(settings);
    } else {
      return {
        fontSize: 'Medium',
        source: 'All',
        background: 'rgba(0,0,0,1)',
        textColor: '#FFFFFF',
        animation: 'Smooth'
      };
    }
  } catch (e) {
    return {
      fontSize: 'Medium',
      source: 'All',
      background: 'rgba(0,0,0,1)',
      textColor: '#FFFFFF',
      animation: 'Smooth'
    };
  }
}

async function SetLyricsSettings(settings) {
  try {
    await AsyncStorage.setItem('LyricsSettings', JSON.stringify(settings));
    return true;
  } catch (e) {
    // Error saving lyrics settings
    return false;
  }
}

export { 
  GetFontSizeValue, 
  SetFontSizeValue, 
  GetPlaybackQuality, 
  SetPlaybackQuality, 
  GetDownloadPath, 
  SetDownloadPath, 
  GetTheme, 
  SetTheme, 
  GetLastSong, 
  SetLastSong,
  GetLyricsSettings,
  SetLyricsSettings
}
