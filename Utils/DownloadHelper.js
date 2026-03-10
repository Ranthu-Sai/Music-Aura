import ReactNativeBlobUtil from 'react-native-blob-util';
import {GetDownloadPath} from '../LocalStorage/AppSettings';
import FormatTitleAndArtist from './FormatTitleAndArtist';
import youtubeStreamingService from './YouTubeStreamingService';
import {
  ToastAndroid,
  Platform,
  PermissionsAndroid,
  DeviceEventEmitter,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {StorageManager} from './StorageManager';

function sanitizeFileName(name) {
  if (!name) {
    return 'Unknown_Song';
  }
  return name
    .toString()
    .replace(/[\\/:*?"<>|]/g, '_') // Replace illegal characters with underscore
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

function isMp3Link(link, mime) {
  return (
    (mime && mime.includes('audio/mpeg')) ||
    (link || '').toLowerCase().includes('.mp3')
  );
}

async function resolveDownloadUrl(song) {
  try {
    // Helper: extract best audio URL from an array of quality objects
    // Saavn uses {quality, link}, some paths use {quality, url} — handle both
    const extractFromArray = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) {
        return null;
      }
      // Prefer highest quality (index 4 = 320kbps for Saavn, or last item)
      const highQuality = arr[4] || arr[arr.length - 1];
      const candidate = highQuality?.url || highQuality?.link;
      if (candidate) {
        return {url: candidate, isMp3: isMp3Link(candidate)};
      }
      // Fallback: find any item with a URL
      for (const item of arr) {
        const u = item?.url || item?.link;
        if (u) {
          return {url: u, isMp3: isMp3Link(u)};
        }
      }
      return null;
    };

    // 1. Check song.downloadUrl array (JioSaavn songs have actual audio URLs here)
    const fromDownloadUrl = extractFromArray(song.downloadUrl);
    if (fromDownloadUrl) {
      return fromDownloadUrl;
    }

    // 2. Check song.url if it's an array (EachSongCard passes downloadUrl as url prop)
    const fromUrlArray = extractFromArray(song.url);
    if (fromUrlArray) {
      return fromUrlArray;
    }

    // 3. Handle string URL / video ID
    let urlToResolve = song.url;

    // Use ID as fallback if URL is missing (common for YT songs in player)
    if (!urlToResolve && song.id) {
      urlToResolve = song.id;
    }

    if (typeof urlToResolve === 'string' && urlToResolve) {
      // Skip webpage URLs (e.g., jiosaavn.com song pages) — they are not audio
      if (urlToResolve.includes('jiosaavn.com') || urlToResolve.includes('saavn.com')) {
        return {url: null, isMp3: false};
      }
      if (!urlToResolve.startsWith('http')) {
        const streamData = await youtubeStreamingService.getStreamUrl(
          urlToResolve,
        );
        if (streamData && streamData.url) {
          return {url: streamData.url, isMp3: false};
        }
        return {url: null, isMp3: false};
      }
      return {url: urlToResolve, isMp3: isMp3Link(urlToResolve)};
    }
  } catch (e) {
    console.error('Download URL resolution error:', e);
  }
  return {url: null, isMp3: false};
}

async function finalizeDownload(
  song,
  res,
  fileName,
  mime,
  source,
  showSystemNotification = true,
) {
  const filePath = res.path();


  try {
    // 1. Scan file for MediaStore (makes it visible in other players and file managers)
    try {
      await ReactNativeBlobUtil.fs.scanFile([{path: filePath, mime}]);
    } catch (scanErr) {
      console.warn('DownloadHelper: scanFile error:', scanErr);
    }

    // 2. Add to system downloads for notification (only if requested)
    if (Platform.OS === 'android' && showSystemNotification) {
      try {
        // Short delay to ensure OS handles file creation
        await new Promise(resolve => setTimeout(resolve, 600));

        const notificationConfig = {
          title: fileName,
          description: `Downloaded ${song.title}`,
          mime: mime,
          path: filePath,
          showNotification: true,
          notification: true,
          media_scanner: true,
        };

        await ReactNativeBlobUtil.android.addCompleteDownload(
          notificationConfig,
        );

      } catch (notifyErr) {
        console.warn(
          'DownloadHelper: System notification failed, trying fallback path format:',
          notifyErr,
        );
        try {
          // Some versions of Android/library require file:// prefix or slightly different path format
          await ReactNativeBlobUtil.android.addCompleteDownload({
            title: fileName,
            description: `Downloaded ${song.title}`,
            mime: mime,
            path: 'file://' + filePath,
            showNotification: true,
            notification: true,
          });
        } catch (e) {
          console.error('DownloadHelper: All notification attempts failed:', e);
        }
      }
    }

    // 3. Collect Stats and Save Metadata
    const fileStats = await ReactNativeBlobUtil.fs.stat(filePath);
    const songId =
      song.id || `${song.title}-${song.artist}`.replace(/[^a-zA-Z0-9]/g, '_');
    const metadata = {
      id: songId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      fileName: fileName,
      fileSize: fileStats.size,
      quality: song.quality || 'unknown',
      downloadTime: Date.now(),
      source: source,
      mimeType: mime,
      filePath: filePath,
    };

    await StorageManager.saveDownloadedSongMetadata(songId, metadata);

    // 4. Emit event for UI synchronization
    DeviceEventEmitter.emit('songDownloaded', {
      ...metadata,
      type: 'downloaded',
    });

    ToastAndroid.show(`Download completed: ${fileName}`, ToastAndroid.SHORT);
    return metadata;
  } catch (err) {
    console.error('DownloadHelper: Error in finalizeDownload:', err);
    ToastAndroid.show(`Download saved to: ${fileName}`, ToastAndroid.SHORT);
    return null;
  }
}

export async function DownloadSong(song) {
  try {
    const getPermission = async () => {
      if (Platform.OS === 'ios') {
        return true;
      } else {
        const deviceVersion = parseFloat(DeviceInfo.getSystemVersion());

        // Request Storage Permission (for Android < 13)
        if (deviceVersion < 13) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return false;
          }
        } else {
          // For Android 13+, we need READ_MEDIA_AUDIO for library access
          // and POST_NOTIFICATIONS for notifications
          const permissions = [];
          if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO) {
            permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
          }
          if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
            permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
          }

          if (permissions.length > 0) {
            await PermissionsAndroid.requestMultiple(permissions);
          }
        }
        return true;
      }
    };

    const hasPermission = await getPermission();
    if (!hasPermission) {
      ToastAndroid.show('Storage permission denied', ToastAndroid.SHORT);
      return;
    }

    const dirs = ReactNativeBlobUtil.fs.dirs;
    const path = await GetDownloadPath();
    const {url: downloadLink, isMp3} = await resolveDownloadUrl(song);

    if (!downloadLink) {
      ToastAndroid.show('Unable to resolve download link', ToastAndroid.SHORT);
      return;
    }



    const deriveExt = () => {
      const lower = (downloadLink || '').toLowerCase();
      // Force .mp3 for YouTube/GoogleVideo to satisfy user preference for MP3 format
      if (
        downloadLink.includes('googlevideo.com') ||
        downloadLink.includes('youtube')
      ) {
        return 'mp3';
      }
      if (isMp3 || lower.includes('.mp3')) {
        return 'mp3';
      }
      if (lower.includes('.m4a') || lower.includes('audio/mp4')) {
        return 'm4a';
      }
      if (
        lower.includes('.webm') ||
        lower.includes('audio/webm') ||
        lower.includes('codecs="opus"')
      ) {
        return 'webm';
      }
      if (lower.includes('audio/mpeg')) {
        return 'mp3';
      }
      return 'mp3';
    };

    const ext = deriveExt();
    const mime =
      ext === 'mp3'
        ? 'audio/mpeg'
        : ext === 'm4a'
        ? 'audio/mp4'
        : ext === 'webm'
        ? 'audio/webm'
        : 'audio/*';

    // Robust base directory selection - Prefer Legacy paths as they are usually public /storage/emulated/0
    let baseDir;
    if (path === 'Downloads') {
      baseDir =
        dirs.LegacyDownloadDir ||
        dirs.DownloadDir ||
        '/storage/emulated/0/Download';
    } else {
      baseDir =
        dirs.LegacyMusicDir || dirs.MusicDir || '/storage/emulated/0/Music';
    }

    // Ensure baseDir is not empty and is a public path
    if (
      !baseDir ||
      baseDir.includes('data/user') ||
      baseDir.includes('com.music_aura')
    ) {
      baseDir =
        '/storage/emulated/0/' + (path === 'Downloads' ? 'Download' : 'Music');
    }

    const sanitizedTitle = sanitizeFileName(FormatTitleAndArtist(song.title));
    const fileName = `${sanitizedTitle}.${ext}`;
    const musicAuraDir = `${baseDir}/Music Aura`;
    const finalPath = `${musicAuraDir}/${fileName}`;

    ToastAndroid.show('Download Started', ToastAndroid.SHORT);

    try {
      const exists = await ReactNativeBlobUtil.fs.isDir(musicAuraDir);
      if (!exists) {
        await ReactNativeBlobUtil.fs.mkdir(musicAuraDir);
      }
    } catch (e) {
      console.warn(
        'DownloadHelper: Failed to create directory:',
        musicAuraDir,
        e,
      );
    }

    // Improved YouTube URL detection
    const isYouTubeUrl =
      downloadLink.includes('googlevideo.com') ||
      downloadLink.includes('youtube.com') ||
      downloadLink.includes('youtu.be') ||
      song.source === 'youtube' ||
      song.id?.length === 11; // Common YT ID length

    if (isYouTubeUrl) {
      ReactNativeBlobUtil.config({
        path: finalPath,
        fileCache: true,
        timeout: 60000,
        // Disable DownloadManager for YouTube as it fails with sensitive/temporary URLs
        // We will manually trigger the notification on completion
      })
        .fetch('GET', downloadLink, {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
          Connection: 'keep-alive',
          Range: 'bytes=0-',
        })
        .then(async res => {
          try {
            const stats = await ReactNativeBlobUtil.fs.stat(res.path());
            if (stats.size === 0) {
              await ReactNativeBlobUtil.fs.unlink(res.path());
              ToastAndroid.show(
                'Download failed: Empty file received',
                ToastAndroid.LONG,
              );
              return;
            }
          } catch (statErr) {}

          // Manually trigger notification since we didn't use DownloadManager
          await finalizeDownload(song, res, fileName, mime, 'youtube', true);
        })
        .catch(err => {
          console.error('DownloadHelper: YouTube download error:', err);
          ToastAndroid.show(
            `Download failed: ${err.message || 'Network error'}`,
            ToastAndroid.LONG,
          );
        });
    } else {
      const startDownload = (useManager = true) => {
        const config = useManager
          ? {
              addAndroidDownloads: {
                useDownloadManager: true,
                path: finalPath,
                notification: true,
                title: fileName,
                mime,
              },
              fileCache: true,
            }
          : {
              path: finalPath,
              fileCache: true,
            };

        return ReactNativeBlobUtil.config(config).fetch(
          'GET',
          downloadLink,
          {},
        );
      };

      startDownload(true)
        .then(async res => {
          // useDownloadManager: true already shows a notification, so we pass false for showSystemNotification
          await finalizeDownload(song, res, fileName, mime, 'other', false);
        })
        .catch(err => {
          console.warn(
            'DownloadHelper: Primary download method failed:',
            err.message,
          );

          // FALLBACK: If DownloadManager fails with "null file" or similar, try direct fetch
          if (
            err.message &&
            (err.message.includes('null') ||
              err.message.includes('FileStorage'))
          ) {

            startDownload(false)
              .then(async res => {
                // useDownloadManager: false needs manual notification
                await finalizeDownload(
                  song,
                  res,
                  fileName,
                  mime,
                  'other',
                  true,
                );
              })
              .catch(fallbackErr => {
                console.error(
                  'DownloadHelper: Fallback download failed:',
                  fallbackErr,
                );
                ToastAndroid.show(
                  `Download failed: ${fallbackErr.message || 'Unknown error'}`,
                  ToastAndroid.LONG,
                );
              });
          } else {
            ToastAndroid.show(
              `Download failed: ${err.message || 'Unknown error'}`,
              ToastAndroid.LONG,
            );
          }
        });
    }
  } catch (error) {
    console.error('Download error:', error);
  }
}
