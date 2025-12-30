import ReactNativeBlobUtil from "react-native-blob-util";
import { Platform, PermissionsAndroid } from "react-native";
import DeviceInfo from "react-native-device-info";

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'webm', 'amr', 'opus', 'aiff'];

/**
 * Request storage permission for scanning
 */
async function requestStoragePermission() {
    if (Platform.OS === 'ios') return true;

    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
        return false;
    }
}

/**
 * Scan a specific directory for audio files recursively
 */
async function scanDirectory(path, depth = 0) {
    if (depth > 10) return []; // Increased depth for deeper scans
    let results = [];
    try {
        const isDir = await ReactNativeBlobUtil.fs.isDir(path);
        if (!isDir) return [];

        const files = await ReactNativeBlobUtil.fs.ls(path);
        for (const file of files) {
            const filePath = `${path}/${file}`;

            // Optimization: Skip system/heavy folders
            if (file === 'data' || file.startsWith('.')) {
                continue;
            }

            try {
                const stat = await ReactNativeBlobUtil.fs.stat(filePath);
                if (stat.type === 'directory') {
                    const subFiles = await scanDirectory(filePath, depth + 1);
                    results = results.concat(subFiles);
                } else {
                    const ext = file.split('.').pop().toLowerCase();
                    if (AUDIO_EXTENSIONS.includes(ext)) {
                        results.push({
                            id: filePath,
                            url: filePath,
                            title: file.replace(/\.[^/.]+$/, ""),
                            artist: 'Local storage',
                            artwork: null,
                            duration: 0,
                            image: null,
                            isLocal: true,
                        });
                    }
                }
            } catch (statErr) {
                // Ignore errors
            }
        }
    } catch (e) {
        // console.warn('Error scanning directory:', path);
    }
    return results;
}

/**
 * Main scan function
 */
export async function scanLocalMusic() {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) return [];

    const dirs = ReactNativeBlobUtil.fs.dirs;
    const scanPaths = [
        dirs.SDCardDir, // Root of internal storage /storage/emulated/0
        dirs.DownloadDir, // Downloads folder
        dirs.MusicDir, // Music folder
        `${dirs.SDCardDir}/Music`, // Explicit Music folder
        `${dirs.SDCardDir}/Download`, // Explicit Download folder
        `${dirs.SDCardDir}/Downloads`, // Downloads folder
    ];

    // Some devices might have external SD card path mounted differently
    // In many cases SDCardDir covers the primary shared storage.

    let allSongs = [];
    for (const path of scanPaths) {
        const songs = await scanDirectory(path);
        allSongs = allSongs.concat(songs);
    }

    // Filter duplicates by path and sort alphabetically
    const seen = new Set();
    return allSongs
        .filter(song => {
            if (seen.has(song.url)) return false;
            seen.add(song.url);
            return true;
        })
        .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Delete a local file
 */
export async function deleteLocalSong(filePath) {
    try {
        if (!filePath) return false;

        // Normalize path: remove file:// prefix if exists
        let cleanPath = filePath;
        if (cleanPath.startsWith('file://')) {
            cleanPath = cleanPath.replace('file://', '');
        }

        // Decode URI if it's encoded
        cleanPath = decodeURI(cleanPath);

        const exists = await ReactNativeBlobUtil.fs.exists(cleanPath);
        if (!exists) {
            console.log('deleteLocalSong: File does not exist at path:', cleanPath);
            return true; // Consider it success if file is already gone
        }

        await ReactNativeBlobUtil.fs.unlink(cleanPath);
        
        // Force refresh Android MediaStore
        if (Platform.OS === 'android') {
            ReactNativeBlobUtil.fs.scanFile([{ path: cleanPath }]);
        }

        // Verify deletion
        const stillExists = await ReactNativeBlobUtil.fs.exists(cleanPath);
        if (stillExists) {
            console.warn('deleteLocalSong: File still exists after unlink:', cleanPath);
            return false;
        }

        return true;
    } catch (e) {
        console.error('Error deleting file:', e);
        return false;
    }
}
