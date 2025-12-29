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
        const downloadPaths = [
            `${dirs.LegacyDownloadDir}/Music Aura`,
            `${dirs.LegacyMusicDir}/Music Aura`,
            `${dirs.DownloadDir}/Music Aura`
        ];

        // Specific image cache paths for Android (Glide) and iOS
        const imageCachePaths = [
            `${dirs.CacheDir}/image_manager_disk_cache`, // Glide
            `${dirs.CacheDir}/com.bumptech.glide.manager`, // Older Glide
            `${dirs.CacheDir}/ImageCache`, // FastImage default
            `${dirs.CacheDir}/http-cache`, // HTTP Cache often contains images
        ];

        // Use a Promise.all for faster execution
        const [allCacheFiles, ...downloadSizes] = await Promise.all([
            ReactNativeBlobUtil.fs.ls(dirs.CacheDir).catch(() => []),
            ...downloadPaths.map(path => getDirectorySize(path))
        ]);

        let imageCacheSize = 0;
        let songCacheSize = 0;

        // Pre-scan known image paths to be more accurate
        for (const path of imageCachePaths) {
            imageCacheSize += await getDirectorySize(path);
        }

        // Iterate through cache directory to separate image cache from other cache
        for (const fileName of allCacheFiles) {
            const filePath = `${dirs.CacheDir}/${fileName}`;
            
            // Skip if already counted in imageCachePaths
            if (imageCachePaths.some(p => p.endsWith(fileName))) continue;

            try {
                const stats = await ReactNativeBlobUtil.fs.stat(filePath);
                
                if (stats.type === 'directory') {
                    // Check if it's likely an image or song directory
                    const name = fileName.toLowerCase();
                    if (name.includes('image') || name.includes('pic') || name.includes('thumb')) {
                        imageCacheSize += await getDirectorySize(filePath);
                    } else if (name.includes('track') || name.includes('song') || name.includes('music') || name.includes('exo')) {
                        songCacheSize += await getDirectorySize(filePath);
                    } else {
                        // Unknown directory, check contents heuristic or split
                        const size = await getDirectorySize(filePath);
                        if (name.includes('cache')) {
                            imageCacheSize += size;
                        } else {
                            songCacheSize += size;
                        }
                    }
                } else {
                    // Heuristic: small files are often images/metadata, larger are audio chunks
                    const size = parseInt(stats.size);
                    if (size < 1024 * 1024) { // < 1MB
                        imageCacheSize += size;
                    } else {
                        songCacheSize += size;
                    }
                }
            } catch (statErr) {
                // Skip files that can't be stated
            }
        }

        const totalDownloadSize = downloadSizes.reduce((acc, curr) => acc + curr, 0);

        return {
            downloads: totalDownloadSize || 0,
            songCache: songCacheSize || 0,
            imageCache: imageCacheSize || 0,
        };
    } catch (e) {
        return { downloads: 0, songCache: 0, imageCache: 0 };
    }
}
