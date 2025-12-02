import TrackPlayer from "react-native-track-player";
//import { setRepeatMode } from "react-native-track-player/lib/trackPlayer";
import { GetPlaybackQuality } from "./LocalStorage/AppSettings";
import { getSongData } from "./Api/Songs";
import { getRecommendedSongs } from "./Api/Recommended";

async function PlayOneSong(song){
  if (!song.url.startsWith('http')) {
    // Assume it's videoId, fetch audio URL from Piped
    try {
      const response = await fetch(`https://pipedapi.in.projectsegfau.lt/streams/${song.url}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const data = await response.json();
      const audioStreams = data.audioStreams;
      if (audioStreams && audioStreams.length > 0) {
        // Select the highest bitrate audio stream
        const bestStream = audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
        song.url = bestStream.url;
      } else {
        throw new Error('No audio stream found');
      }
    } catch (error) {
      return; // Don't play
    }
  }
  await TrackPlayer.reset();
  await TrackPlayer.add([song]);
  await TrackPlayer.play();
}
async function AddPlaylist (songs){
  const processedSongs = await Promise.all(songs.map(async (song) => {
    if (!song.url.startsWith('http')) {
      try {
        const response = await fetch(`https://pipedapi.in.projectsegfau.lt/streams/${song.url}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const data = await response.json();
        const audioStreams = data.audioStreams;
        if (audioStreams && audioStreams.length > 0) {
          const bestStream = audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
          return { ...song, url: bestStream.url };
        } else {
          return song;
        }
      } catch (error) {
        return song;
      }
    }
    return song;
  }));
  await TrackPlayer.reset();
  await TrackPlayer.add(processedSongs);
  await TrackPlayer.play();
}

async function AddSongsToQueue(songs){
  const processedSongs = await Promise.all(songs.map(async (song) => {
    if (!song.url.startsWith('http')) {
      try {
        const response = await fetch(`https://pipedapi.in.projectsegfau.lt/streams/${song.url}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const data = await response.json();
        const audioStreams = data.audioStreams;
        if (audioStreams && audioStreams.length > 0) {
          const bestStream = audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
          return { ...song, url: bestStream.url };
        } else {
          return song;
        }
      } catch (error) {
        return song;
      }
    }
    return song;
  }));
  await TrackPlayer.add(processedSongs);
}
async function PlaySong(){
  await TrackPlayer.play();
}
async function PauseSong(){
  await TrackPlayer.pause();
}

async function SetProgressSong(value){
  await TrackPlayer.seekTo(value);
}

async function PlayNextSong(){
  await TrackPlayer.skipToNext();
  PlaySong()
}

async function PlayPreviousSong(){
  await TrackPlayer.skipToPrevious();
  PlaySong()
}
async function SkipToTrack(trackIndex){
  await TrackPlayer.skip(trackIndex);
  await PlaySong()
}
async function SetRepeatMode(mode){
  await TrackPlayer.setRepeatMode(mode)
}

async function getIndexQuality(){
  const PlaybackQuality = [
    { value: '12kbps' },
    { value: '48kbps' },
    { value: '96kbps' },
    { value: '160kbps' },
    { value: '320kbps' },
  ];
  const data = await GetPlaybackQuality()
  let index = 4
  PlaybackQuality.map((e, i)=>{
    if (e.value === data){
      index = i
    }
  })
  return index
}

export {PlayOneSong, PlaySong, PauseSong, SetProgressSong, PlayNextSong, AddPlaylist, PlayPreviousSong, AddSongsToQueue, SkipToTrack,SetRepeatMode, getIndexQuality}

// Build a fresh queue from a song id + related songs, then play
export async function PlaySongWithRelated(id, fallbackImage) {
  try {
    const [songData, quality, related] = await Promise.all([
      getSongData(id),
      getIndexQuality(),
      getRecommendedSongs(id).catch(() => ({ data: [] })),
    ]);
    const songObj = songData?.data?.[0];
    if (!songObj) throw new Error('Song not found');
    const mainSong = {
      url: songObj.downloadUrl?.[quality]?.url || songObj.downloadUrl?.[0]?.url,
      title: songObj.name,
      artist: (songObj.artists?.primary || []).map(a => a.name).join(', '),
      artwork: songObj.image?.[2]?.url || fallbackImage,
      duration: songObj.duration,
      id: songObj.id,
      language: songObj.language,
      artistID: songObj.primary_artists_id,
      image: songObj.image?.[2]?.url || fallbackImage,
      downloadUrl: songObj.downloadUrl,
    };
    const recs = Array.isArray(related?.data) ? related.data : [];
    const queue = [mainSong];
    const seen = new Set([mainSong.id]);
    for (const e of recs) {
      try {
        const rid = e.id || e?.more_info?.id || e?.songid;
        if (!rid || seen.has(rid)) {
          continue;
        }
        const rimg = e?.image?.[2]?.url || e?.image?.[2]?.link || e?.image?.[0]?.url || fallbackImage;
        const rdl = e?.downloadUrl || e?.more_info?.downloadUrl;
        if (!Array.isArray(rdl) || !rdl[quality]) {
          continue;
        }
        queue.push({
          url: rdl[quality].url,
          title: e?.name || e?.title || "",
          artist: (e?.artists?.primary || []).map(a => a.name).join(', '),
          artwork: rimg,
          duration: e?.duration,
          id: rid,
          language: e?.language,
          artistID: e?.primary_artists_id,
          image: rimg,
          downloadUrl: rdl,
        });
        seen.add(rid);
      } catch (_) {
        // skip malformed
      }
    }
    await AddPlaylist(queue);
  } catch (e) {
    // fallback to just attempting to play id if related or details failed
    try {
      const songData = await getSongData(id);
      const quality = await getIndexQuality();
      const songObj = songData?.data?.[0];
      if (!songObj) return;
      await PlayOneSong({
        url: songObj.downloadUrl?.[quality]?.url || songObj.downloadUrl?.[0]?.url,
        title: songObj.name,
        artist: (songObj.artists?.primary || []).map(a => a.name).join(', '),
        artwork: songObj.image?.[2]?.url || fallbackImage,
        duration: songObj.duration,
        id: songObj.id,
        language: songObj.language,
        artistID: songObj.primary_artists_id,
        image: songObj.image?.[2]?.url || fallbackImage,
        downloadUrl: songObj.downloadUrl,
      });
    } catch (_) {
      // give up silently
    }
  }
}
