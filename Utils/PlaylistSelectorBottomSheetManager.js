import { DeviceEventEmitter } from 'react-native';

/**
 * Manager for showing a playlist selection interface
 */
export const PlaylistSelectorBottomSheetManager = {
    /**
     * Show the playlist selector for a specific song
     * @param {Object} song - The song to add to a playlist
     */
    show: (song) => {
        if (!song) return false;

        // We can emit an event that a global PlaylistSelector component listens to
        // or just show a Toast for now and implement the actual UI in a new component
        DeviceEventEmitter.emit('showPlaylistSelector', { song });
        return true;
    }
};
