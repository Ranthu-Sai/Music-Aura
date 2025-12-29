import ReactNativeBlobUtil from "react-native-blob-util";
import { GetDownloadPath } from "../LocalStorage/AppSettings";
import FormatTitleAndArtist from "./FormatTitleAndArtist";
import youtubeStreamingService from "./YouTubeStreamingService";
import { ToastAndroid, Platform, PermissionsAndroid } from "react-native";
import DeviceInfo from "react-native-device-info";

function isMp3Link(link, mime) {
    return (mime && mime.includes('audio/mpeg')) || (link || '').toLowerCase().includes('.mp3');
}

async function resolveDownloadUrl(song) {
    try {
        if (typeof song.url === 'string' && song.url) {
            if (!song.url.startsWith('http')) {
                const streamData = await youtubeStreamingService.getStreamUrl(song.url);
                if (streamData && streamData.url) {
                    return { url: streamData.url, isMp3: false };
                }
                return { url: null, isMp3: false };
            }
            return { url: song.url, isMp3: isMp3Link(song.url) };
        }
        if (Array.isArray(song.url)) {
            const mp3Item = song.url.find(it => isMp3Link(it?.url));
            if (mp3Item?.url) { return { url: mp3Item.url, isMp3: true }; }
            const candidate = song.url[4]?.url || song.url[song.url.length - 1]?.url;
            return { url: candidate, isMp3: isMp3Link(candidate) };
        }
        // Check downloadUrl as well
        if (Array.isArray(song.downloadUrl)) {
            const mp3Item = song.downloadUrl.find(it => isMp3Link(it?.url));
            if (mp3Item?.url) { return { url: mp3Item.url, isMp3: true }; }
            const candidate = song.downloadUrl[4]?.url || song.downloadUrl[song.downloadUrl.length - 1]?.url;
            return { url: candidate, isMp3: isMp3Link(candidate) };
        }
    } catch (e) {
        console.error('Download URL resolution error:', e);
    }
    return { url: null, isMp3: false };
}

export async function DownloadSong(song) {
    try {
        const getPermission = async () => {
            if (Platform.OS === 'ios') {
                return true;
            } else {
                let deviceVersion = DeviceInfo.getSystemVersion();
                let granted = PermissionsAndroid.RESULTS.DENIED;
                if (parseFloat(deviceVersion) >= 13) {
                    granted = PermissionsAndroid.RESULTS.GRANTED;
                } else {
                    granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    );
                }
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }
        };

        const hasPermission = await getPermission();
        if (!hasPermission) {
            ToastAndroid.show("Storage permission denied", ToastAndroid.SHORT);
            return;
        }

        let dirs = ReactNativeBlobUtil.fs.dirs;
        const path = await GetDownloadPath();
        const { url: downloadLink, isMp3 } = await resolveDownloadUrl(song);

        if (!downloadLink) {
            ToastAndroid.show(`Unable to resolve download link`, ToastAndroid.SHORT);
            return;
        }

        ToastAndroid.show(`Download Started`, ToastAndroid.SHORT);

        const deriveExt = () => {
            const lower = (downloadLink || '').toLowerCase();
            if (isMp3 || lower.includes('.mp3')) { return 'mp3'; }
            if (lower.includes('.m4a') || lower.includes('audio/mp4')) { return 'm4a'; }
            if (lower.includes('.webm') || lower.includes('audio/webm') || lower.includes('codecs="opus"')) { return 'webm'; }
            if (lower.includes('audio/mpeg')) { return 'mp3'; }
            if (downloadLink.includes('googlevideo.com')) { return 'webm'; }
            return 'mp3';
        };

        const ext = deriveExt();
        const mime = ext === 'mp3' ? 'audio/mpeg' :
            ext === 'm4a' ? 'audio/mp4' :
                ext === 'webm' ? 'audio/webm' : 'audio/*';

        const baseDir = (path === "Downloads") ? dirs.LegacyDownloadDir : dirs.LegacyMusicDir;
        const fileName = `${FormatTitleAndArtist(song.title)}.${ext}`;
        const finalPath = `${baseDir}/Music Aura/${fileName}`;

        try {
            const parent = finalPath.substring(0, finalPath.lastIndexOf('/'));
            const exists = await ReactNativeBlobUtil.fs.isDir(parent);
            if (!exists) { await ReactNativeBlobUtil.fs.mkdir(parent); }
        } catch (e) { }

        const isYouTubeUrl = downloadLink.includes('googlevideo.com');

        if (isYouTubeUrl) {
            ReactNativeBlobUtil
                .config({
                    path: finalPath,
                    fileCache: true,
                })
                .fetch('GET', downloadLink, {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
                    'Accept': '*/*',
                    'Range': 'bytes=0-',
                    'Referer': 'https://www.youtube.com/',
                })
                .then(async (res) => {
                    try {
                        const stats = await ReactNativeBlobUtil.fs.stat(res.path());
                        if (stats.size === 0) {
                            await ReactNativeBlobUtil.fs.unlink(res.path());
                            ToastAndroid.show(`Download failed: Empty file received`, ToastAndroid.LONG);
                            return;
                        }
                    } catch (statErr) { }

                    ReactNativeBlobUtil.fs.scanFile([{ path: res.path(), mime }])
                        .then(() => {
                            ToastAndroid.show(`Download completed: ${fileName}`, ToastAndroid.SHORT);
                        })
                        .catch(() => {
                            ToastAndroid.show(`Downloaded to: ${fileName}`, ToastAndroid.SHORT);
                        });
                })
                .catch((err) => {
                    ToastAndroid.show(`Download failed: ${err.message || 'Network error'}`, ToastAndroid.LONG);
                });
        } else {
            ReactNativeBlobUtil
                .config({
                    addAndroidDownloads: {
                        useDownloadManager: true,
                        path: finalPath,
                        notification: true,
                        title: fileName,
                        mime,
                    },
                    fileCache: true,
                })
                .fetch('GET', downloadLink, {})
                .then(() => {
                    ToastAndroid.show(ext === 'mp3' ? "Download successfully Completed" : `Saved as .${ext}`, ToastAndroid.SHORT);
                })
                .catch((err) => {
                    ToastAndroid.show(`Download failed: ${err.message || 'Unknown error'}`, ToastAndroid.LONG);
                });
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}
