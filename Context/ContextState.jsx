import Context from "./Context";
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
import { GetFontSizeValue, GetTheme, SetLastSong, GetLastSong } from "../LocalStorage/AppSettings";


const events = [
    Event.PlaybackActiveTrackChanged,
    Event.PlaybackError,
    Event.PlaybackState,
    Event.RemoteDuck, // Audio focus interruptions
];
const themes = {
    Default: {
        background: 'black',
        text: 'white',
        secondaryBackground: 'rgb(30,30,30)',
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
    const lyricsCacheRef = useRef({});
    const [queueVisible, setQueueVisible] = useState(false);
    const updateTrack = useCallback(async () => {
        try {
            const tracks = await TrackPlayer.getQueue();
            // await SetQueueSongs(tracks)
            const ids = tracks.filter(e => e && e.id).map((e) => e.id)
            const queuesId = Queue.filter(e => e && e.id).map((e) => e.id)
            if (JSON.stringify(ids) !== JSON.stringify(queuesId)) {
                setQueue(tracks)
            }
        } catch (error) {
            // Error silently handled
        }
    }, [Queue]);
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
        const tracks = await TrackPlayer.getQueue();
        const totalTracks = tracks.length - 1;

        // Always allow adding songs when forced, or when near end, or when queue is small
        const shouldAddSongs = forceAdd || index >= totalTracks - 2 || tracks.length < MIN_QUEUE_SIZE;

        const isYT = isYouTubeId(id);

        if (shouldAddSongs) {
            try {
                // Get user's preferred language for filtering
                const preferredLanguage = await GetLanguageValue();

                // Use appropriate API based on source
                const songs = isYT
                    ? await getYTMusicRecommendedSongs(id)
                    : await getRecommendedSongs(id);

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
        if (event.type === Event.PlaybackError) {
            const now = Date.now();

            // Simple rate-limiting / circuit breaker: avoid repeated retries
            if (now - lastPlaybackErrorTime > 5000) {
                playbackErrorCount = 0;
            }
            lastPlaybackErrorTime = now;
            playbackErrorCount++;

            if (playbackErrorCount > 3) {
                console.error('PlaybackError circuit breaker tripped — skipping track to prevent loop.');
                try { await TrackPlayer.skipToNext(); } catch (_) { }
                playbackErrorCount = 0;
                return;
            }

            // Auto-retry: Get fresh stream URL and retry playback (best-effort)
            try {
                const currentTrack = await TrackPlayer.getActiveTrack();
                if (currentTrack && currentTrack.id) {
                    let streamData = null;
                    if (/^[A-Za-z0-9_-]{11}$/.test(currentTrack.id)) {
                        // YouTube Music track
                        const { getYTMusicStreamUrl } = require('../Api/YTMusicStream');
                        streamData = await getYTMusicStreamUrl(currentTrack.id, true);
                    } else if (currentTrack.source === 'saavn' || currentTrack.id.startsWith('saavn_')) {
                        // Saavn track - try to get fresh stream
                        // Assuming Saavn has a similar function, adjust as needed
                        // For now, skip retry for Saavn if no function
                        console.warn('PlaybackError for Saavn track, skipping retry');
                        throw new Error('No retry for Saavn');
                    }

                    if (streamData && streamData.url) {
                        // Update track with fresh URL
                        try {
                            const activeIndex = await TrackPlayer.getActiveTrackIndex();
                            if (typeof activeIndex === 'number' && activeIndex >= 0) {
                                await TrackPlayer.updateMetadataForTrack(activeIndex, {
                                    url: streamData.url,
                                    headers: streamData.headers,
                                });
                            } else {
                                await TrackPlayer.updateNowPlayingMetadata({
                                    ...currentTrack,
                                    url: streamData.url,
                                    headers: streamData.headers,
                                });
                            }
                        } catch (metaErr) {
                            console.warn('Failed to update track metadata, will attempt play anyway', metaErr);
                        }

                        // Retry playback
                        await TrackPlayer.play();
                        return;
                    }
                }
            } catch (retryError) {
                console.warn('PlaybackError retry failed:', retryError?.message || retryError);
            }

            // If we reach here, retry didn't work — skip to next track
            try {
                await TrackPlayer.skipToNext();
            } catch (_) { }
        }

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
            console.log('🎵 PlaybackActiveTrackChanged event:', {
                trackId: event.track?.id,
                trackTitle: event.track?.title,
                index: event.index,
                previousTrackId: currentPlaying?.id,
            });

            setCurrentPlaying(event.track)
            if (event?.track?.id) {
                // Save the current track so it can be restored on app restart
                SetLastSong(event.track).catch(() => { });

                // Only add recommended songs if this track wasn't already in the queue
                // (i.e., it was played from outside the queue, not clicked within the queue)
                const currentQueue = await TrackPlayer.getQueue();
                const trackAlreadyInQueue = currentQueue.some(track => track && track.id === event.track.id);

                if (!trackAlreadyInQueue) {
                    console.log('🎵 Track not in queue, adding recommendations');
                    // Continuously add recommended songs - unlimited queue growth
                    AddRecommendedSongs(event.index, event.track.id).catch(err => {
                        // Error silently handled
                    });
                } else {
                    console.log('✅ Track already in queue, skipping recommendations');
                }

                // Prefetch lyrics for faster first open, prefer track language
                const cacheKey = event.track.id || `${event.track?.artist || 'unknown'}-${event.track?.title || 'unknown'}`
                if (lyricsCacheRef?.current && !lyricsCacheRef.current[cacheKey]) {
                    getYTLyricsSongData(
                        event.track?.artist || 'unknown',
                        event.track?.title || 'unknown',
                        event.track?.language || 'en'
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
            console.log('🚀 Starting app initialization...');

            // Only perform player setup once; subsequent calls just sync queue/state
            if (!hasSetupRef.current) {
                try {
                    await TrackPlayer.setupPlayer();
                    console.log('✅ TrackPlayer setup complete');
                } catch (_) {
                    console.warn('⚠️ TrackPlayer already initialized');
                }
                try {
                    await SetRepeatMode(RepeatMode.Queue);
                    console.log('✅ Repeat mode set to Queue');
                } catch (_) { }
                hasSetupRef.current = true;
            }

            // Try to get current track from TrackPlayer
            let song = null;
            try {
                song = await TrackPlayer.getActiveTrack();
                if (song && song.id) {
                    console.log('✅ Found active track:', song.title);
                }
            } catch (_) { }

            // If no active track, try to restore from saved last song
            if (!song || !song.id) {
                console.log('📍 No active track, attempting to restore last song...');
                const lastSong = await GetLastSong();

                if (lastSong && lastSong.id) {
                    try {
                        console.log('🔄 Restoring last song:', lastSong.title);

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

                        console.log('✅ Last song restored and set as active track');

                        // Auto-fill queue with recommended songs
                        console.log('🎵 Auto-filling queue with recommendations...');
                        await AddRecommendedSongs(0, song.id, true);
                    } catch (e) {
                        console.error('❌ Error restoring last song:', e);
                    }
                } else {
                    console.log('📍 No last song to restore');
                }
            } else {
                // Update current playing if there's already an active track
                console.log('✅ Using existing active track');
                setCurrentPlaying(song);

                // Get the actual current track index from TrackPlayer
                try {
                    const currentIndex = await TrackPlayer.getActiveTrackIndex();
                    if (typeof currentIndex === 'number' && currentIndex >= 0) {
                        console.log(`📍 Current track index: ${currentIndex}`);
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
                console.log(`📋 Current queue size: ${tracks.length} songs`);

                if (tracks.length < MIN_QUEUE_SIZE) {
                    console.log(`🎵 Queue below minimum (${MIN_QUEUE_SIZE}), adding more songs...`);
                    await AddRecommendedSongs(0, song.id, true);
                }
            }

            console.log('✅ App initialization complete');
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

    const openQueue = () => {
        setQueueVisible(true);
    };

    const closeQueue = () => {
        setQueueVisible(false);
    };

    useEffect(() => {
        InitialSetup();
        loadFontSize();
        loadTheme();
        // Deliberately empty dependency array so setup is not re-run on queue updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <Context.Provider value={{ currentPlaying, Repeat, setRepeat, updateTrack, Index, setIndex, QueueIndex, setQueueIndex, setVisible, Queue, fontSize, setFontSize, theme, setTheme, currentThemeColors, lyricsCacheRef, ensureMinimumQueue, queueVisible, setQueueVisible, openQueue, closeQueue }}>
        {props.children}
        <EachSongMenuModal setVisible={setVisible} Visible={Visible} />
        <PlaylistSelector />
    </Context.Provider>
}

export default ContextState


