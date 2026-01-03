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
        
        // Download paths - check both possible locations
        const downloadPaths = [
            `${dirs.LegacyDownloadDir}/Music Aura`,
            `${dirs.LegacyMusicDir}/Music Aura`,
        ];

        // Specific image cache paths for Android (Glide, FastImage) and iOS
        const imageCachePaths = [
            `${dirs.CacheDir}/image_manager_disk_cache`,
            `${dirs.CacheDir}/com.bumptech.glide.disk_cache`,
            `${dirs.CacheDir}/com.bumptech.glide.manager`,
            `${dirs.CacheDir}/ImageCache`,
            `${dirs.CacheDir}/http-cache`,
        ];

        let totalDownloadSize = 0;
        let imageCacheSize = 0;
        let songCacheSize = 0;

        // Calculate download folder sizes
        for (const path of downloadPaths) {
            try {
                const exists = await ReactNativeBlobUtil.fs.exists(path);
                if (exists) {
                    totalDownloadSize += await getDirectorySize(path);
                }
            } catch (err) {
                console.warn(`Failed to get size for download path: ${path}`, err);
            }
        }

        // Calculate image cache sizes
        for (const path of imageCachePaths) {
            try {
                const exists = await ReactNativeBlobUtil.fs.exists(path);
                if (exists) {
                    imageCacheSize += await getDirectorySize(path);
                }
            } catch (err) {
                // Path doesn't exist or can't be accessed
            }
        }

        // Get all cache files
        const allCacheFiles = await ReactNativeBlobUtil.fs.ls(dirs.CacheDir).catch(() => []);
        
        // Process cache directory files
        for (const fileName of allCacheFiles) {
            const filePath = `${dirs.CacheDir}/${fileName}`;
            
            // Skip if already counted in imageCachePaths
            if (imageCachePaths.some(p => p.includes(fileName))) continue;

            try {
                const stats = await ReactNativeBlobUtil.fs.stat(filePath);
                const size = parseInt(stats.size) || 0;
                
                if (stats.type === 'directory') {
                    const dirSize = await getDirectorySize(filePath);
                    const name = fileName.toLowerCase();
                    
                    // Categorize by directory name
                    if (name.includes('image') || name.includes('glide') || name.includes('pic') || name.includes('thumb')) {
                        imageCacheSize += dirSize;
                    } else if (name.includes('exoplayer') || name.includes('track') || name.includes('audio') || name.includes('music')) {
                        songCacheSize += dirSize;
                    } else {
                        // Default to song cache for other directories
                        songCacheSize += dirSize;
                    }
                } else {
                    // For files, use size heuristic
                    const ext = fileName.toLowerCase().split('.').pop();
                    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                        imageCacheSize += size;
                    } else if (['mp3', 'm4a', 'aac', 'webm', 'mp4'].includes(ext)) {
                        songCacheSize += size;
                    } else if (size < 100 * 1024) { // < 100KB likely metadata or images
                        imageCacheSize += size;
                    } else { // Larger files likely audio chunks
                        songCacheSize += size;
                    }
                }
            } catch (statErr) {
                // Skip files that can't be stated
            }
        }

        return {
            downloads: totalDownloadSize,
            songCache: songCacheSize,
            imageCache: imageCacheSize,
        };
    } catch (e) {
        console.error('getAppStorageDynamics error:', e);
        return { downloads: 0, songCache: 0, imageCache: 0 };
    }
}
