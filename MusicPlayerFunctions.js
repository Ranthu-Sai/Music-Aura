import TrackPlayer from "react-native-track-player";
//import { setRepeatMode } from "react-native-track-player/lib/trackPlayer";
import { GetPlaybackQuality } from "./LocalStorage/AppSettings";
import { getSongData } from "./Api/Songs";
import { getRecommendedSongs } from "./Api/Recommended";

async function PlayOneSong(song){
  
  if (!song.url) {
      alert('Cannot play: Song URL is missing');
    return;
  }
  
  if (!song.url.startsWith('http')) {
      // Assume it's videoId, fetch audio URL from Invidious
    const instances = [
      'https://yt.omada.cafe',
      'https://yewtu.be',
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://inv.perditum.com',
    ];
    
    let audioUrl = null;
    for (let instance of instances) {
      try {
              const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(`${instance}/api/v1/videos/${song.url}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
              
        if (!response.ok) {
                  continue;
        }
        
        const data = await response.json();
              
        // STRATEGY 1: Request video with local=true to get Invidious-proxied URLs
        // This forces Invidious to proxy the stream through its server, bypassing Google blocking
              const proxiedResponse = await fetch(`${instance}/api/v1/videos/${song.url}?local=true`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: controller.signal,
        });
        
        if (proxiedResponse.ok) {
          const proxiedData = await proxiedResponse.json();
                  
          // Try formatStreams from proxied request
          if (proxiedData.formatStreams && proxiedData.formatStreams.length > 0) {
                      const audioOrLowQuality = proxiedData.formatStreams.filter(f => 
              f.resolution === '360p' || f.resolution === '240p' || f.quality === 'small'
            );
            
            if (audioOrLowQuality.length > 0) {
              audioUrl = audioOrLowQuality[0].url;
                        } else {
              audioUrl = proxiedData.formatStreams[0].url;
                        }
          }
          
          // Try adaptiveFormats from proxied request
          if (!audioUrl && proxiedData.adaptiveFormats && proxiedData.adaptiveFormats.length > 0) {
                      const audioFormats = proxiedData.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
            
            if (audioFormats.length > 0) {
              let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
              if (!bestAudio) {
                bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              }
              audioUrl = bestAudio.url;
                        }
          }
        }
        
        // STRATEGY 2: Use formatStreams from original request (may not be proxied)
        if (!audioUrl && data.formatStreams && data.formatStreams.length > 0) {
                  const audioOrLowQuality = data.formatStreams.filter(f => 
            f.resolution === '360p' || f.resolution === '240p' || f.quality === 'small'
          );
          
          if (audioOrLowQuality.length > 0) {
            audioUrl = audioOrLowQuality[0].url;
                    } else {
            audioUrl = data.formatStreams[0].url;
                    }
        }
        
        // STRATEGY 3: Direct adaptiveFormats (last resort)
        if (!audioUrl && data.adaptiveFormats && data.adaptiveFormats.length > 0) {
                  const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
          
          if (audioFormats.length > 0) {
            let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
            if (!bestAudio) {
              bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            }
            audioUrl = bestAudio.url;          }
        }
        
        if (audioUrl) {
                          song.url = audioUrl;
          break;
        } else {
                }
      } catch (error) {
                    if (error.stack) {        }
        continue;
      }
    }
    
    if (!song.url.startsWith('http')) {
          console.error('Tried instances:', instances.join(', '));
      alert('Unable to play this song. YouTube stream unavailable from all servers.');
      return; // Don't play
    } else {
        }
  } else {
    }  
  // Add headers for Google Video URLs
  // Note: Google Video CDN is very restrictive and may still fail
  // This is a limitation of using unofficial APIs
  const trackToAdd = {
    ...song,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    }
  };
  
  await TrackPlayer.reset();
  await TrackPlayer.add([trackToAdd]);
  await TrackPlayer.play();
}
async function AddPlaylist (songs){
  if (!songs || !Array.isArray(songs)) {
      return;
  }
  
  // Filter out null/undefined songs and songs without required properties
  const validSongs = songs.filter(song => song && song.id && song.url);
  
  if (validSongs.length === 0) {
      return;
  }
  
  const instances = [
    'https://yt.omada.cafe',
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.perditum.com',
  ];
  
  const processedSongs = await Promise.all(validSongs.map(async (song) => {
    if (!song.url.startsWith('http')) {
      for (let instance of instances) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          const response = await fetch(`${instance}/api/v1/videos/${song.url}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          const data = await response.json();
          
          let audioUrl = null;
          // STRATEGY 1: formatStreams (proxied)
          if (data.formatStreams && data.formatStreams.length > 0) {
            const lowQuality = data.formatStreams.filter(f => 
              f.resolution === '360p' || f.resolution === '240p'
            );
            audioUrl = lowQuality.length > 0 ? lowQuality[0].url : data.formatStreams[0].url;
          }
          
          // STRATEGY 2: Invidious proxy with &local=true
          if (!audioUrl && data.adaptiveFormats && data.adaptiveFormats.length > 0) {
            const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
            if (audioFormats.length > 0) {
              let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
              if (!bestAudio) {
                bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              }
              const baseUrl = bestAudio.url.split('?')[0];
              const params = new URLSearchParams(bestAudio.url.split('?')[1] || '');
              params.set('local', 'true');
              audioUrl = `${baseUrl}?${params.toString()}`;
            }
          }
          
          // STRATEGY 3: Direct adaptiveFormats (fallback)
          if (!audioUrl && data.adaptiveFormats && data.adaptiveFormats.length > 0) {
            const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
            if (audioFormats.length > 0) {
              let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
              if (!bestAudio) {
                bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              }
              audioUrl = bestAudio.url;
            }
          }
          
          if (audioUrl) {
            return { 
              ...song, 
              url: audioUrl,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
                'Accept': '*/*',
              }
            };
          }
        } catch (error) {
          continue;
        }
      }
    }
    return song;
  }));
  await TrackPlayer.reset();
  await TrackPlayer.add(processedSongs);
  await TrackPlayer.play();
}

async function AddSongsToQueue(songs){
  if (!songs || !Array.isArray(songs)) {
      return;
  }
  
  // Filter out null/undefined songs and songs without required properties
  const validSongs = songs.filter(song => song && song.id && song.url);
  
  if (validSongs.length === 0) {
      return;
  }
  
  const instances = [
    'https://yt.omada.cafe',
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.perditum.com',
  ];
  
  const processedSongs = await Promise.all(validSongs.map(async (song) => {
    if (!song.url.startsWith('http')) {
      for (let instance of instances) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          let audioUrl = null;
          // STRATEGY 1: Request with &local=true for proxied streams
          try {
            const proxiedResponse = await fetch(`${instance}/api/v1/videos/${song.url}?local=true`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (proxiedResponse.ok) {
              const proxiedData = await proxiedResponse.json();
              
              if (proxiedData.formatStreams && proxiedData.formatStreams.length > 0) {
                const lowQuality = proxiedData.formatStreams.filter(f => 
                  f.resolution === '360p' || f.resolution === '240p'
                );
                audioUrl = lowQuality.length > 0 ? lowQuality[0].url : proxiedData.formatStreams[0].url;
              } else if (proxiedData.adaptiveFormats && proxiedData.adaptiveFormats.length > 0) {
                const audioFormats = proxiedData.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
                if (audioFormats.length > 0) {
                  let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
                  if (!bestAudio) {
                    bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                  }
                  audioUrl = bestAudio.url;
                }
              }
            }
          } catch (proxyError) {
            // Proxy failed, try fallback
          }
          
          // STRATEGY 2: Fallback to non-proxied
          if (!audioUrl) {
            const response = await fetch(`${instance}/api/v1/videos/${song.url}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              signal: controller.signal,
            });
            
            const data = await response.json();
            
            if (data.formatStreams && data.formatStreams.length > 0) {
              const lowQuality = data.formatStreams.filter(f => 
                f.resolution === '360p' || f.resolution === '240p'
              );
              audioUrl = lowQuality.length > 0 ? lowQuality[0].url : data.formatStreams[0].url;
            } else if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
              const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
              if (audioFormats.length > 0) {
                let bestAudio = audioFormats.find(f => f.type && (f.type.includes('mp4') || f.type.includes('m4a')));
                if (!bestAudio) {
                  bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                }
                audioUrl = bestAudio.url;
              }
            }
          }
          
          if (audioUrl) {
            return { 
              ...song, 
              url: audioUrl,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36',
                'Accept': '*/*',
              }
            };
          }
        } catch (error) {
          continue;
        }
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
export async function PlaySongWithRelated(id, fallbackImage, songInfo = null) {
  
  // Check if this is a YouTube video ID (11 chars, alphanumeric with - and _)
  const isYouTubeId = /^[a-zA-Z0-9_-]{11}$/.test(id);
  
  if (isYouTubeId) {    // For YouTube, play directly without fetching related (Invidious doesn't provide good related)
    await PlayOneSong({
      url: songInfo?.url || id, // Use provided URL or fallback to ID
      title: songInfo?.title || 'Loading...',
      artist: songInfo?.artist || 'YouTube',
      artwork: fallbackImage || `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      duration: songInfo?.duration || 0,
      id: id,
      language: songInfo?.language || 'en',
      image: fallbackImage || `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    });
    return;
  }
  
  // JioSaavn song handling (original code)
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



