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
        secondaryBackground: 'rgb(50,50,50)',
        secondaryText: 'white',
    },
    Dark: {
        background: 'rgb(34,39,34)',
        text: 'white',
        secondaryBackground: 'rgb(236,236,236)',
        secondaryText: 'rgb(26,26,26)',
    },
    Blue: {
        background: 'rgb(0,0,50)',
        text: 'white',
        secondaryBackground: 'rgb(100,100,200)',
        secondaryText: 'white',
    },
    Purple: {
        background: 'rgb(50,0,50)',
        text: 'white',
        secondaryBackground: 'rgb(150,100,200)',
        secondaryText: 'white',
    },
    Green: {
        background: 'rgb(0,50,0)',
        text: 'white',
        secondaryBackground: 'rgb(100,200,100)',
        secondaryText: 'rgb(0,100,0)',
    },
    Red: {
        background: 'rgb(80,0,0)',
        text: 'white',
        secondaryBackground: 'rgb(200,100,100)',
        secondaryText: 'white',
    },
    Orange: {
        background: 'rgb(100,50,0)',
        text: 'white',
        secondaryBackground: 'rgb(255,165,0)',
        secondaryText: 'rgb(100,50,0)',
    },
    Pink: {
        background: 'rgb(100,0,50)',
        text: 'white',
        secondaryBackground: 'rgb(255,182,193)',
        secondaryText: 'rgb(100,0,50)',
    },
    Teal: {
        background: 'rgb(0,50,50)',
        text: 'white',
        secondaryBackground: 'rgb(0,206,209)',
        secondaryText: 'rgb(0,100,100)',
    },
};
const ContextState = (props)=>{
    const [Index, setIndex] = useState(0);
    const [QueueIndex, setQueueIndex] = useState(0);
    const [currentPlaying, setCurrentPlaying]  = useState({})
    const [Repeat, setRepeat] = useState(Repeats.RepeatAll);
    const [Visible, setVisible] = useState({
        visible:false,
    });
    const [fontSize, setFontSize] = useState('Medium');
    const [theme, setTheme] = useState('Default');
    const hasSetupRef = useRef(false);
    const wasPlayingBeforeInterruption = useRef(false); // Track if we were playing before interruption

    const currentThemeColors = useMemo(() => themes[theme] || themes.Dark, [theme]);

    const [Queue, setQueue] = useState([]);
    const lyricsCacheRef = useRef({});
    const updateTrack = useCallback(async () => {
        try {
            const tracks = await TrackPlayer.getQueue();
            // await SetQueueSongs(tracks)
            const ids = tracks.filter(e => e && e.id).map((e)=>e.id)
            const queuesId = Queue.filter(e => e && e.id).map((e)=>e.id)
            if (JSON.stringify(ids) !== JSON.stringify(queuesId)){
                setQueue(tracks)
            }
        } catch (error) {
            // Error silently handled
        }
    }, [Queue]);
    const recommendedProcessedRef = useRef(new Set());
    const MIN_QUEUE_SIZE = 50; // Initial target, but will keep growing
    
    // Helper to detect if a song ID is from YouTube Music (11 chars alphanumeric)
    const isYouTubeId = (id) => {
        return id && typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
    };
    
    async function AddRecommendedSongs(index, id, forceAdd = false){
        // Avoid repeated fetch/add for the same track id (unless forced)
        if (!id || (!forceAdd && recommendedProcessedRef.current.has(id))) { 
            return 0; // Return count of songs added
        }
        const tracks = await TrackPlayer.getQueue();
        const totalTracks = tracks.length - 1;
        
        // Always allow adding songs when forced, or when near end, or when queue is small
        const shouldAddSongs = forceAdd || index >= totalTracks - 2 || tracks.length < MIN_QUEUE_SIZE;
        
        const isYT = isYouTubeId(id);
        
        if (shouldAddSongs){
            try {
                // Get user's preferred language for filtering
                const preferredLanguage = await GetLanguageValue();
                
                // Use appropriate API based on source
                const songs = isYT 
                    ? await getYTMusicRecommendedSongs(id)
                    : await getRecommendedSongs(id);
                
                const songData = songs?.data?.results || songs?.data;
                
                if (songData?.length){
                    const existingIds = tracks.filter(t => t && t.id).map(t => t.id);
                    const ForMusicPlayer = songData
                        .filter(song => {
                            if (!song || !song.id || existingIds.includes(song.id)) return false;
                            
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
                        .map((e)=> ({
                            url: e.downloadUrl?.[3]?.url || e.downloadUrl?.[0]?.url || e.id,
                            title: e.name?.toString() ?? "",
                            artist: FormatArtist(e?.artists?.primary)?.toString() ?? "",
                            artwork: e.image?.[2]?.url || e.image?.[2]?.link || e.image?.[0]?.url || '',
                            duration: e.duration,
                            id: e.id,
                            language: e.language || 'en',
                        }))
                        .filter(song => song.id && song.url); // Final safety check
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
    }

    useTrackPlayerEvents(events, async (event) => {
        if (event.type === Event.PlaybackError) {
            console.warn('An error occured while playing the current track.');
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
            setCurrentPlaying(event.track)
            if (event?.track?.id ){
                // Save the current track so it can be restored on app restart
                SetLastSong(event.track).catch(() => {});
                
                // Continuously add recommended songs - unlimited queue growth
                AddRecommendedSongs(event.index, event.track.id).catch(err => {
                    // Error silently handled
                });
                
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
                                lyricsCacheRef.current[cacheKey] = { lyrics: "No Lyrics Found \nOpps... O_o" }
                            }
                        })
                        .catch(() => {
                            if (lyricsCacheRef?.current) {
                                lyricsCacheRef.current[cacheKey] = { lyrics: "No Lyrics Found \nOpps... O_o" }
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
                try { await TrackPlayer.setupPlayer(); } catch (_) {}
                try { await SetRepeatMode(RepeatMode.Queue); } catch (_) {}
                hasSetupRef.current = true;
            }
            
            // Try to get current track from TrackPlayer
            let song = null;
            try {
                song = await TrackPlayer.getActiveTrack();
            } catch (_) {}
            
            // If no active track, try to restore from saved last song
            if (!song || !song.id) {
                const lastSong = await GetLastSong();
                if (lastSong && lastSong.id) {
                    try {
                        // Reset player and add the last song
                        await TrackPlayer.reset();
                        await TrackPlayer.add([lastSong]);
                        song = lastSong;
                        setCurrentPlaying(lastSong);
                        setIndex(0);
                        
                        // Auto-fill queue with recommended songs
                        await AddRecommendedSongs(0, song.id, true);
                    } catch (e) {
                        // Error restoring last song
                    }
                }
            } else {
                // Update current playing if there's already an active track
                setCurrentPlaying(song);
            }
            
            // Always update track list after setup
            await updateTrack();

            if (song && song.id) {
                setIndex(0);
                // Auto-fill queue to minimum size on startup
                const tracks = await TrackPlayer.getQueue();
                if (tracks.length < MIN_QUEUE_SIZE) {
                    await AddRecommendedSongs(0, song.id, true);
                }
            }
        } catch (error) {
            // Error silently handled
        }
    }, [updateTrack, setIndex]);
    const getCurrentSong = useCallback(async () => {
        const song = await TrackPlayer.getActiveTrack()
        setCurrentPlaying(song)
        if (song) {
            await SetLastSong(song)
        }
        return song
    }, []);
    async function loadFontSize(){
        const data = await GetFontSizeValue();
        setFontSize(data);
    }
    async function loadTheme(){
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
                }            const addedCount = await AddRecommendedSongs(0, seedTrack.id, true);
            
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
    }, []);
    
    useEffect(() => {
        InitialSetup();
        loadFontSize();
        loadTheme();
        // Deliberately empty dependency array so setup is not re-run on queue updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <Context.Provider value={{currentPlaying,  Repeat, setRepeat, updateTrack, Index, setIndex, QueueIndex, setQueueIndex, setVisible, Queue, fontSize, setFontSize, theme, setTheme, currentThemeColors, lyricsCacheRef, ensureMinimumQueue}}>
        {props.children}
         <EachSongMenuModal setVisible={setVisible} Visible={Visible}/>
    </Context.Provider>
}

export default  ContextState


