const mockFn = () => {};

export const AddSongsToQueue = jest.fn(mockFn);
export const getIndexQuality = jest.fn(() => 0);
export const PlaySongWithRelated = jest.fn(mockFn);
export const SkipToTrack = jest.fn(mockFn);
export const SetRepeatMode = jest.fn(mockFn);
export const AddOneSongToPlaylist = jest.fn(mockFn);
export const PauseSong = jest.fn(mockFn);
export const PlaySong = jest.fn(mockFn);
export const removeFromQueue = jest.fn(mockFn);
export const PlayNextSong = jest.fn(mockFn);
export const PlayPreviousSong = jest.fn(mockFn);
export const AddPlaylist = jest.fn(mockFn);

export default {
  AddSongsToQueue,
  getIndexQuality,
  PlaySongWithRelated,
  SkipToTrack,
  SetRepeatMode,
  AddOneSongToPlaylist,
  PauseSong,
  PlaySong,
  removeFromQueue,
  PlayNextSong,
  PlayPreviousSong,
  AddPlaylist,
};
