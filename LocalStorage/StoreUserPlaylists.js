import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_PLAYLISTS_KEY = 'user_playlists';

/**
 * Get all user playlists
 */
async function GetUserPlaylists() {
    try {
        const value = await AsyncStorage.getItem(USER_PLAYLISTS_KEY);
        if (value !== null) {
            return JSON.parse(value);
        } else {
            return [];
        }
    } catch (e) {
        console.error('Error reading user playlists:', e);
        return [];
    }
}

/**
 * Create a new playlist
 * @param {string} name - Name of the playlist
 */
async function CreatePlaylist(name) {
    try {
        const playlists = await GetUserPlaylists();
        const newPlaylist = {
            id: `playlist_${Date.now()}`,
            name: name,
            songs: [],
            createdAt: Date.now(),
            image: null, // Will use first song's image
        };
        playlists.push(newPlaylist);
        await AsyncStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(playlists));
        return newPlaylist;
    } catch (e) {
        console.error('Error creating playlist:', e);
        return null;
    }
}

/**
 * Add a song to a playlist
 * @param {string} playlistId - ID of the playlist
 * @param {Object} song - Song object to add
 */
async function AddToPlaylist(playlistId, song) {
    try {
        const playlists = await GetUserPlaylists();
        const index = playlists.findIndex(p => p.id === playlistId);
        if (index !== -1) {
            // Check if song already exists in playlist
            const songExists = playlists[index].songs.some(s => s.id === song.id);
            if (!songExists) {
                playlists[index].songs.push(song);
                // Update playlist image if it's the first song
                if (!playlists[index].image) {
                    playlists[index].image = song.artwork || song.image;
                }
                await AsyncStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(playlists));
                return { success: true, message: 'Added to playlist' };
            }
            return { success: false, message: 'Song already in playlist' };
        }
        return { success: false, message: 'Playlist not found' };
    } catch (e) {
        console.error('Error adding to playlist:', e);
        return { success: false, message: 'Error adding to playlist' };
    }
}

/**
 * Delete a playlist
 * @param {string} playlistId - ID of the playlist to delete
 */
async function DeletePlaylist(playlistId) {
    try {
        const playlists = await GetUserPlaylists();
        const filtered = playlists.filter(p => p.id !== playlistId);
        await AsyncStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(filtered));
        return true;
    } catch (e) {
        console.error('Error deleting playlist:', e);
        return false;
    }
}

/**
 * Remove a song from a playlist
 */
async function RemoveFromPlaylist(playlistId, songId) {
    try {
        const playlists = await GetUserPlaylists();
        const index = playlists.findIndex(p => p.id === playlistId);
        if (index !== -1) {
            playlists[index].songs = playlists[index].songs.filter(s => s.id !== songId);
            // Update image if needed
            if (playlists[index].songs.length > 0) {
                playlists[index].image = playlists[index].songs[0].artwork || playlists[index].songs[0].image;
            } else {
                playlists[index].image = null;
            }
            await AsyncStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(playlists));
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error removing from playlist:', e);
        return false;
    }
}

export { GetUserPlaylists, CreatePlaylist, AddToPlaylist, DeletePlaylist, RemoveFromPlaylist };
