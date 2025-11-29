import Context from "./Context";
import { useEffect, useState, useMemo, useCallback } from "react";
import TrackPlayer, { Event, useTrackPlayerEvents, RepeatMode } from "react-native-track-player";
import { getRecommendedSongs } from "../Api/Recommended";
import { AddSongsToQueue, SetRepeatMode } from "../MusicPlayerFunctions";
import FormatArtist from "../Utils/FormatArtists";
import { Repeats } from "../Utils/Repeats";
import { SetQueueSongs } from "../LocalStorage/storeQueue";
import { EachSongMenuModal } from "../Component/Global/EachSongMenuModal";
import { GetFontSizeValue, GetTheme, GetLastSong, SetLastSong } from "../LocalStorage/AppSettings";


const events = [
    Event.PlaybackActiveTrackChanged,
    Event.PlaybackError,
    Event.PlaybackState,
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

    const currentThemeColors = useMemo(() => themes[theme] || themes.Dark, [theme]);

    const [Queue, setQueue] = useState([]);
    const updateTrack = useCallback(async () => {
        const tracks = await TrackPlayer.getQueue();
        // await SetQueueSongs(tracks)
        // console.log(tracks);
        const ids = tracks.map((e)=>e.id)
        const queuesId = Queue.map((e)=>e.id)
        if (JSON.stringify(ids) !== JSON.stringify(queuesId)){
            setQueue(tracks)
        }
    }, [Queue]);
    async function AddRecommendedSongs(index,id){
        const tracks = await TrackPlayer.getQueue();
        const totalTracks = tracks.length - 1
        if (index >= totalTracks - 2){
           try {
               const songs = await getRecommendedSongs(id)
               if (songs?.data?.length !== 0){
                   const existingIds = tracks.map(t => t.id);
                   const ForMusicPlayer = songs.data.filter(song => !existingIds.includes(song.id)).map((e)=> {
                       return {
                           url:e.downloadUrl[3].url,
                           title:e.name.toString().replaceAll("&quot;","\"").replaceAll("&amp;","and").replaceAll("&#039;","'").replaceAll("&trade;","™"),
                           artist:FormatArtist(e?.artists?.primary).toString().replaceAll("&quot;","\"").replaceAll("&amp;","and").replaceAll("&#039;","'").replaceAll("&trade;","™"),
                           artwork:e.image[2].url,
                           duration:e.duration,
                           id:e.id,
                           language:e.language,
                       }
                   })
                   if (ForMusicPlayer.length > 0) {
                       await AddSongsToQueue(ForMusicPlayer)
                   }
               }
           } catch (e) {
               // Error adding recommended songs
           } finally {
               await updateTrack()
           }
        }
    }

    useTrackPlayerEvents(events, (event) => {
        if (event.type === Event.PlaybackError) {
            console.warn('An error occured while playing the current track.');
        }
        if (event.type === Event.PlaybackActiveTrackChanged) {
            setCurrentPlaying(event.track)
            if (event.track?.id ){
                AddRecommendedSongs(event.index,event.track?.id)
            }
        }
    });
    const InitialSetup = useCallback(async () => {
        try {
            await TrackPlayer.setupPlayer()
        } catch (error) {
            // Player already initialized
        }
        await SetRepeatMode(RepeatMode.Queue)
        await updateTrack()
        const song = await getCurrentSong()
        if (song) {
            setIndex(1)
        }
        // await updateTrack()
    }, [updateTrack, getCurrentSong, setIndex]);
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
    useEffect(() => {
        InitialSetup()
        loadFontSize()
        loadTheme()
    }, [InitialSetup]);
    return <Context.Provider value={{currentPlaying,  Repeat, setRepeat, updateTrack, Index, setIndex, QueueIndex, setQueueIndex, setVisible, Queue, fontSize, setFontSize, theme, setTheme, currentThemeColors}}>
        {props.children}
         <EachSongMenuModal setVisible={setVisible} Visible={Visible}/>
    </Context.Provider>
}

export default  ContextState
