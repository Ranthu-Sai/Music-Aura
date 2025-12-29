import ReactNativeBlobUtil from "react-native-blob-util";

export async function getDirectorySize(path) {
    try {
        const isDir = await ReactNativeBlobUtil.fs.isDir(path);
        if (!isDir) return 0;

        const files = await ReactNativeBlobUtil.fs.ls(path);
        let total = 0;
        for (const file of files) {
            const filePath = `${path}/${file}`;
            const stat = await ReactNativeBlobUtil.fs.stat(filePath);
            if (stat.type === 'directory') {
                total += await getDirectorySize(filePath);
            } else {
                total += parseInt(stat.size);
            }
        }
        return total;
    } catch (e) {
        return 0;
    }
}

export async function getAppStorageDynamics() {
    try {
        const dirs = ReactNativeBlobUtil.fs.dirs;
        const downloadPath = `${dirs.LegacyDownloadDir}/Music Aura`;

        // Use a Promise.all for faster execution
        const [songCacheSize, downloadSize] = await Promise.all([
            getDirectorySize(dirs.CacheDir),
            getDirectorySize(downloadPath)
        ]);

        return {
            downloads: downloadSize || 0,
            songCache: songCacheSize || 0,
            imageCache: Math.floor(songCacheSize * 0.3), // Estimating image cache portion
        };
    } catch (e) {
        return { downloads: 0, songCache: 0, imageCache: 0 };
    }
}
