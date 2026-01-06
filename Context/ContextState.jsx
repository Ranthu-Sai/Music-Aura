import Context, { ThemeContext, ActionsContext } from "./Context";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import TrackPlayer, { Event, useTrackPlayerEvents, RepeatMode } from "react-native-track-player";
import { getRecommendedSongs, getYTMusicRecommendedSongs } from "../Api/Recommended";
import { getYTLyricsSongData } from "../Api/Songs";
import { AddSongsToQueue, SetRepeatMode } from "../MusicPlayerFunctions";
import FormatArtist from "../Utils/FormatArtists";
import { Repeats } from "../Utils/Repeats";
import { GetLanguageValue } from "../LocalStorage/Languages";
// import { SetQueueSongs } from "../LocalStorage/storeQueue";
import { EachSongMenuModal } from "../Component/Global/EachSongMenuModal";
import PlaylistSelector from "../Component/Global/PlaylistSelector";
import { GetFontSizeValue, GetTheme, SetLastSong, GetLastSong, GetLyricsSettings, SetLyricsSettings } from "../LocalStorage/AppSettings";
import { getCachedData } from "../Utils/CacheManager";


const events = [
    Event.PlaybackActiveTrackChanged,
    Event.PlaybackError,
    Event.PlaybackState,
    Event.RemoteDuck, // Audio focus interruptions
];
const themes = {
    Default: {
        background: '#000000',
        text: '#FFFFFF',
        secondaryBackground: '#121212',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#1DB954',
    },
    Dark: {
        background: 'rgb(15,15,15)',
        text: 'white',
        secondaryBackground: 'rgb(35,35,35)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#ffffff',
    },
    White: {
        background: '#FFFFFF',
        text: '#000000',
        secondaryBackground: '#F2F2F2',
        secondaryText: 'rgba(0,0,0,0.7)',
        primary: '#1DB954',
    },
    Blue: {
        background: 'rgb(0,5,20)',
        text: 'white',
        secondaryBackground: 'rgb(0,30,80)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#4776E6',
    },
    Purple: {
        background: 'rgb(20,0,25)',
        text: 'white',
        secondaryBackground: 'rgb(60,0,80)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#8E2DE2',
    },
    Green: {
        background: 'rgb(0,20,0)',
        text: 'white',
        secondaryBackground: 'rgb(0,60,0)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#1DB954',
    },
    Red: {
        background: 'rgb(25,0,0)',
        text: 'white',
        secondaryBackground: 'rgb(80,0,0)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#FF4B2B',
    },
    Orange: {
        background: 'rgb(30,15,0)',
        text: 'white',
        secondaryBackground: 'rgb(90,45,0)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#FF8C00',
    },
    Pink: {
        background: 'rgb(30,0,20)',
        text: 'white',
        secondaryBackground: 'rgb(100,0,60)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#FF69B4',
    },
    Teal: {
        background: 'rgb(0,25,25)',
        text: 'white',
        secondaryBackground: 'rgb(0,80,80)',
        secondaryText: 'rgba(255,255,255,0.7)',
        primary: '#008080',
    },
    Amoled: {
        background: '#000000',
        text: '#ffffff',
        secondaryBackground: '#121212',
        secondaryText: 'rgba(255,255,255,0.6)',
        primary: '#1DB954',
    },
    Sky: {
        background: '#0a192f',
        text: '#e6f1ff',
        secondaryBackground: '#172a45',
        secondaryText: '#8892b0',
        primary: '#64ffda',
    },
    Midnight: {
        background: '#09090b',
        text: '#fafafa',
        secondaryBackground: '#18181b',
        secondaryText: '#a1a1aa',
        primary: '#3b82f6',
    },
};
const ContextState = (props) => {
    const [Index, setIndexState] = useState(0);
    const [QueueIndex, setQueueIndex] = useState(0);
    const [currentPlaying, setCurrentPlaying] = useState({})
    const [Repeat, setRepeat] = useState(Repeats.RepeatAll);
    const [Visible, setVisible] = useState({
        visible: false,
    });
    const [fontSize, setFontSize] = useState('Medium');
    const [theme, setTheme] = useState('Default');
    const [lyricsSettings, setLyricsSettings] = useState({
        fontSize: 'Medium',
        source: 'All',
        background: 'rgba(0,0,0,1)',
        textColor: '#FFFFFF',
        animation: 'Smooth',
    });
    const hasSetupRef = useRef(false);
    const wasPlayingBeforeInterruption = useRef(false); // Track if we were playing before interruption

    // Safe setIndex function to prevent invalid snap point indices
    const setIndex = useCallback((index) => {
        if (typeof index === 'number' && index >= 0 && index <= 1) {
            setIndexState(index);
        } else {
            console.warn('Invalid index provided to setIndex:', index, 'expected 0 or 1');
        }
    }, []);

    const currentThemeColors = useMemo(() => themes[theme] || themes.Dark, [theme]);

    const [Queue, setQueue] = useState([]);
    const QueueRef = useRef([]); // Ref to access latest queue in callbacks
    QueueRef.current = Queue; // Keep ref updated

    const lyricsCacheRef = useRef({});
    const [queueVisible, setQueueVisible] = useState(false);

    const updateTrack = useCallback(async () => {
        // PERFORMANCE: Defer getQueue to next frame to prevent blocking UI
        requestAnimationFrame(async () => {
            try {
                const tracks = await TrackPlayer.getQueue();

                // PERFORMANCE: Fast O(1) comparison - compare length and boundary IDs
                const hasChanged = tracks.length !== QueueRef.current.length ||
                    (tracks.length > 0 && QueueRef.current.length > 0 && (
                        tracks[0]?.id !== QueueRef.current[0]?.id ||
                        tracks[tracks.length - 1]?.id !== QueueRef.current[QueueRef.current.length - 1]?.id
                    ));

                if (hasChanged || tracks.length > QueueRef.current.length) {
                    setQueue(tracks);
                }
            } catch (error) {
                // Error silently handled
            }
        });
    }, []);
    const recommendedProcessedRef = useRef(new Set());
    const MIN_QUEUE_SIZE = 100; // Larger queue for unlimited smooth playback
    // Playback error circuit breaker
    let lastPlaybackErrorTime = 0;
    let playbackErrorCount = 0;

    // Helper to detect if a song ID is from YouTube Music (11 chars alphanumeric)
    const isYouTubeId = (id) => {
        return id && typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
    };

    const AddRecommendedSongs = useCallback(async (index, id, forceAdd = false) => {
        // Avoid repeated fetch/add for the same track id (unless forced)
        if (!id || (!forceAdd && recommendedProcessedRef.current.has(id))) {
            return 0; // Return count of songs added
        }

        // PERFORMANCE: Use QueueRef for fast O(1) length check
        // Avoid expensive TrackPlayer.getQueue() bridge call unless necessary
        const currentQueueLength = QueueRef.current.length;

        // Quick check using cached queue length
        if (currentQueueLength > 0 && index < currentQueueLength - 2 && currentQueueLength >= MIN_QUEUE_SIZE && !forceAdd) {
            return 0; // Queue is healthy, no need to add
        }

        // Now fetch authoritative queue for actual operation
        const tracks = await TrackPlayer.getQueue();
        const totalTracks = tracks.length - 1;

        // Always allow adding songs when forced, or when near end, or when queue is small
        const shouldAddSongs = forceAdd || index >= totalTracks - 2 || tracks.length < MIN_QUEUE_SIZE;

        const isYT = isYouTubeId(id);

        if (shouldAddSongs) {
            try {
                // Get user's preferred language for filtering
                const preferredLanguage = await GetLanguageValue();

                // Use appropriate API based on source with caching
                const cacheKey = `recommended_${id}`;
                const songs = await getCachedData(cacheKey, async () => {
                    return isYT
                        ? await getYTMusicRecommendedSongs(id)
                        : await getRecommendedSongs(id);
                }, { expiration: 60 * 24 }); // Cache for 24 hours

                const songData = songs?.data?.results || songs?.data;

                if (songData?.length) {
                    // Build comprehensive duplicate detection sets
                    const existingIds = new Set();
                    const existingUrls = new Set();
                    const existingTitles = new Set();

                    // Scan entire queue for duplicates
                    tracks.forEach(t => {
                        if (t && t.id) {
                            existingIds.add(t.id);
                        }
                        if (t && t.url) {
                            // Normalize URL by removing query params for better matching
                            const normalizedUrl = t.url.split('?')[0];
                            existingUrls.add(normalizedUrl);
                        }
                        if (t && t.title && t.artist) {
                            // Create normalized signature for fuzzy matching
                            const signature = `${t.title.toLowerCase().trim()}-${t.artist.toLowerCase().trim()}`;
                            existingTitles.add(signature);
                        }
                    });

                    const ForMusicPlayer = songData
                        .filter(song => {
                            if (!song || !song.id) { return false; }

                            // Check ID duplicates
                            if (existingIds.has(song.id)) {
                                return false;
                            }

                            // Check URL duplicates
                            const songUrl = song.downloadUrl?.[3]?.url || song.downloadUrl?.[0]?.url || song.id;
                            const normalizedSongUrl = songUrl.split('?')[0];
                            if (existingUrls.has(normalizedSongUrl)) {
                                return false;
                            }

                            // Check title+artist duplicates (fuzzy matching)
                            if (song.name && song.artists?.primary) {
                                const artistName = FormatArtist(song.artists.primary)?.toString() || '';
                                const signature = `${song.name.toLowerCase().trim()}-${artistName.toLowerCase().trim()}`;
                                if (existingTitles.has(signature)) {
                                    return false;
                                }
                            }

                            // If user has selected a language, only include songs in that language
                            // For YouTube Music, skip language filtering as it doesn't have reliable language tags
                            if (preferredLanguage && !isYT) {
                                const songLanguage = song.language?.toLowerCase() || '';
                                const userLanguage = preferredLanguage.toLowerCase();

                                // Allow if languages match or song language is unknown/empty
                                if (songLanguage && songLanguage !== userLanguage) {
                                    return false;
                                }
                            }

                            return true;
                        })
                        .map((e) => ({
                            url: e.downloadUrl?.[3]?.url || e.downloadUrl?.[0]?.url || e.id,
                            title: e.name?.toString() ?? "",
                            artist: FormatArtist(e?.artists?.primary)?.toString() ?? "",
                            artwork: e.image?.[2]?.url || e.image?.[2]?.link || e.image?.[0]?.url || '',
                            duration: e.duration,
                            id: e.id,
                            language: e.language || 'en',
                        }))
                        .filter(song => {
                            // Final validation: ensure all required fields exist
                            if (!song.id || !song.url || !song.title) {
                                return false;
                            }

                            // Double-check no duplicates slipped through
                            if (existingIds.has(song.id)) {
                                return false;
                            }

                            return true;
                        });

                    if (ForMusicPlayer.length > 0) {
                        // Add 1 second delay before adding songs to queue
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        await AddSongsToQueue(ForMusicPlayer);
                        if (!forceAdd) {
                            recommendedProcessedRef.current.add(id);
                        }
                        const newTotal = (await TrackPlayer.getQueue()).length;
                        await updateTrack();
                        return ForMusicPlayer.length;
                    }
                }
            } catch (e) {
                // Error silently handled
            }
        }
        return 0;
    }, [updateTrack]);
    useTrackPlayerEvents(events, async (event) => {
        // PlaybackError handling is now centrally managed by SmartPrefetchManager
        // which handles track replacement and recovery for YouTube Music tracks.
        // ContextState only provides UI updates through useActiveTrack() and local state.

        // Handle audio focus interruptions from other apps
        if (event.type === Event.RemoteDuck) {
            if (event.paused) {
                // Another app is playing audio - pause our music
                const playbackState = await TrackPlayer.getPlaybackState();
                if (playbackState.state === 'playing') {
                    wasPlayingBeforeInterruption.current = true;
                    await TrackPlayer.pause();
                }
            } else if (event.permanent) {
                // Permanent interruption (e.g., phone call) - pause
                wasPlayingBeforeInterruption.current = false;
                await TrackPlayer.pause();
            } else {
                // Temporary interruption ended - resume if we were playing
                if (wasPlayingBeforeInterruption.current) {
                    await TrackPlayer.setVolume(1.0); // Restore full volume
                    await TrackPlayer.play();
                    wasPlayingBeforeInterruption.current = false;
                }
            }
        }

        if (event.type === Event.PlaybackActiveTrackChanged) {
            setCurrentPlaying(event.track)
            if (event?.track?.id) {
                // Save the current track so it can be restored on app restart
                SetLastSong(event.track).catch(() => { });

                // Only add recommended songs if this track wasn't already in the queue
                // (i.e., it was played from outside the queue, not clicked within the queue)
                const currentQueue = await TrackPlayer.getQueue();
                const trackAlreadyInQueue = currentQueue.some(track => track && track.id === event.track.id);

                if (!trackAlreadyInQueue) {
                    // Continuously add recommended songs - unlimited queue growth
                    AddRecommendedSongs(event.index, event.track.id).catch(err => {
                        // Error silently handled
                    });
                } else {
                }

                // Prefetch lyrics for faster first open, prefer track language
                const source = lyricsSettings?.source || 'All';
                const cacheKey = event.track.id ? `${event.track.id}-${source}` : `${event.track?.artist || 'unknown'}-${event.track?.title || 'unknown'}-${source}`;
                if (lyricsCacheRef?.current && !lyricsCacheRef.current[cacheKey]) {
                    getYTLyricsSongData(
                        event.track?.artist || 'unknown',
                        event.track?.title || 'unknown',
                        event.track?.language || 'en',
                        false,
                        lyricsSettings.source
                    )
                        .then((Lyrics) => {
                            if (Lyrics?.success && lyricsCacheRef?.current) {
                                lyricsCacheRef.current[cacheKey] = Lyrics.data
                            } else if (lyricsCacheRef?.current) {
                                lyricsCacheRef.current[cacheKey] = { lyrics: "No Lyrics Found" }
                            }
                        })
                        .catch(() => {
                            if (lyricsCacheRef?.current) {
                                lyricsCacheRef.current[cacheKey] = { lyrics: "No Lyrics Found" }
                            }
                        })
                }
            }
        }
    });
    const InitialSetup = useCallback(async () => {
        try {
            // Only perform player setup once; subsequent calls just sync queue/state
            if (!hasSetupRef.current) {
                try {
                    await TrackPlayer.setupPlayer();
                } catch (_) {
                    // Already initialized — silently ignore to avoid noisy warnings
                }
                try {
                    await SetRepeatMode(RepeatMode.Queue);
                } catch (_) { }
                hasSetupRef.current = true;
            }

            // Try to get current track and queue from TrackPlayer (with retry to handle background service connection)
            let song = null;
            let queue = [];
            let retryCount = 0;
            const maxRetries = 5;

            while (retryCount < maxRetries) {
                try {
                    song = await TrackPlayer.getActiveTrack();
                    queue = await TrackPlayer.getQueue();
                    if ((song && song.id) || (queue && queue.length > 0)) {
                        break;
                    }
                } catch (_) { }

                // Wait 100ms before next retry
                await new Promise(resolve => setTimeout(resolve, 100));
                retryCount++;
            }

            // If no active track AND queue is empty, try to restore from saved last song
            // Checking queue length prevents resetting the player if it's already loaded or playing
            if ((!song || !song.id) && (!queue || queue.length === 0)) {
                const lastSong = await GetLastSong();

                if (lastSong && lastSong.id) {
                    try {
                        // Ensure the player is initialized before attempting restore
                        try {
                            await TrackPlayer.setupPlayer();
                        } catch (_) {
                            // If already initialized, this will throw; safe to ignore
                        }
                        // Reset player and add the last song
                        await TrackPlayer.reset();
                        await TrackPlayer.add([lastSong]);

                        // CRITICAL: Skip to track 0 to make it the active track
                        // This ensures useActiveTrack() hook picks it up in MinimizedMusic
                        await TrackPlayer.skip(0);

                        // Update state immediately to show in mini player
                        song = lastSong;
                        setCurrentPlaying(lastSong);
                        setIndex(0);

                        // Auto-fill queue with recommended songs
                        await AddRecommendedSongs(0, song.id, true);
                    } catch (e) {
                        console.error('❌ Error restoring last song:', e);
                    }
                } else {
                }
            } else {
                // Update current playing if there's already an active track
                setCurrentPlaying(song);

                // Get the actual current track index from TrackPlayer
                try {
                    const currentIndex = await TrackPlayer.getActiveTrackIndex();
                    if (typeof currentIndex === 'number' && currentIndex >= 0) {
                        // Don't call setIndex here to avoid triggering UI changes
                        // The player is already at the correct position
                    }
                } catch (e) {
                    console.warn('⚠️ Could not get current track index:', e);
                }
            }

            // Always update track list after setup
            await updateTrack();

            if (song && song.id) {
                // Only set index to 0 if we just restored a song, not if there was already an active track
                const wasRestored = !await TrackPlayer.getActiveTrack() || (await TrackPlayer.getActiveTrackIndex()) === undefined;
                if (wasRestored) {
                    setIndex(0);
                }

                // Auto-fill queue to minimum size on startup
                const tracks = await TrackPlayer.getQueue();

                if (tracks.length < MIN_QUEUE_SIZE) {
                    await AddRecommendedSongs(0, song.id, true);
                }
            }
        } catch (error) {
            console.error('❌ Error during initialization:', error);
        }
    }, [updateTrack, setIndex, AddRecommendedSongs]);
    const getCurrentSong = useCallback(async () => {
        const song = await TrackPlayer.getActiveTrack()
        setCurrentPlaying(song)
        if (song) {
            await SetLastSong(song)
        }
        return song
    }, []);
    async function loadFontSize() {
        const data = await GetFontSizeValue();
        setFontSize(data);
    }
    async function loadTheme() {
        const data = await GetTheme();
        setTheme(data);
    }
    async function loadLyricsSettings() {
        const settings = await GetLyricsSettings();
        if (settings) {
            setLyricsSettings(settings);
        }
    }

    const refreshLyrics = useCallback(async (songId, artist, title, preferredLanguage, overrideSource) => {
        if (!songId && !currentPlaying?.id) {return;}

        const id = songId || currentPlaying.id;
        const art = artist || currentPlaying.artist;
        const tt = title || currentPlaying.title;
        const lang = preferredLanguage || currentPlaying.language || 'en';
        const source = overrideSource || lyricsSettings.source || 'All';

        const cacheKey = id ? `${id}-${source}` : `${art}-${tt}-${source}`;

        // Pass current settings to fetching logic
        const Lyrics = await getYTLyricsSongData(art, tt, lang, false, source);
        if (Lyrics?.success && lyricsCacheRef?.current) {
            lyricsCacheRef.current[cacheKey] = Lyrics.data;
            return Lyrics.data;
        }
        return null;
    }, [currentPlaying, lyricsSettings.source]);

    // Function to ensure queue has minimum songs
    const ensureMinimumQueue = useCallback(async () => {
        try {
            let tracks = await TrackPlayer.getQueue();
            const currentTrack = await TrackPlayer.getActiveTrack();
            if (tracks.length >= MIN_QUEUE_SIZE) {
                return;
            }

            if (!currentTrack?.id) {
                return;
            }        // Keep trying songs until we reach MIN_QUEUE_SIZE or run out of unique songs
            let trackIndex = 0;
            let consecutiveFailures = 0;
            const maxConsecutiveFailures = 10; // Stop if 10 songs in a row give no new recommendations

            while (tracks.length < MIN_QUEUE_SIZE && consecutiveFailures < maxConsecutiveFailures) {
                if (trackIndex >= tracks.length) {
                    break;
                }

                const seedTrack = tracks[trackIndex];

                // Safety check for undefined track
                if (!seedTrack || !seedTrack.id) {
                    trackIndex++;
                    consecutiveFailures++;
                    continue;
                } const addedCount = await AddRecommendedSongs(0, seedTrack.id, true);

                if (addedCount > 0) {
                    consecutiveFailures = 0; // Reset on success
                } else {
                    consecutiveFailures++;
                }

                // Refresh tracks
                tracks = await TrackPlayer.getQueue();
                trackIndex++;
            }

            const finalTracks = await TrackPlayer.getQueue();
        } catch (error) {
            // Error ignored
        }
    }, [AddRecommendedSongs]);

    const openQueue = useCallback(() => {
        setQueueVisible(true);
    }, []);

    const closeQueue = useCallback(() => {
        setQueueVisible(false);
    }, []);

    useEffect(() => {
        InitialSetup();
        loadFontSize();
        loadTheme();
        loadLyricsSettings();
        // Deliberately empty dependency array so setup is not re-run on queue updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const themeValue = useMemo(() => ({
        fontSize,
        setFontSize,
        theme,
        setTheme,
        currentThemeColors,
    }), [fontSize, theme, currentThemeColors]);

    const actionValue = useMemo(() => ({
        setRepeat,
        updateTrack,
        setIndex,
        setQueueIndex,
        setVisible,
        setQueueVisible,
        openQueue,
        closeQueue,
        ensureMinimumQueue,
        lyricsCacheRef,
        lyricsSettings,
        setLyricsSettings,
        setLyricsSettingsState: setLyricsSettings,
        refreshLyrics,
    }), [updateTrack, setIndex, setQueueIndex, setVisible, setQueueVisible, openQueue, closeQueue, ensureMinimumQueue, lyricsCacheRef, lyricsSettings, refreshLyrics]);

    const playerValue = useMemo(() => ({
        currentPlaying,
        Repeat,
        Index,
        QueueIndex,
        Queue,
        queueVisible,
    }), [
        currentPlaying,
        Repeat,
        Index,
        QueueIndex,
        Queue,
        queueVisible,
    ]);

    return (
        <ThemeContext.Provider value={themeValue}>
            <ActionsContext.Provider value={actionValue}>
                <Context.Provider value={playerValue}>
                    {props.children}
                    <EachSongMenuModal setVisible={setVisible} Visible={Visible} />
                    <PlaylistSelector />
                </Context.Provider>
            </ActionsContext.Provider>
        </ThemeContext.Provider>
    );
}

export default ContextState


