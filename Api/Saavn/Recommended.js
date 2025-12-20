import axios from "axios";
import InnerTubeClient from "../InnertubeClient";

// Get recommended songs for JioSaavn tracks
async function getRecommendedSongs(id) {
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    song_reco: "__call=reco.getreco",
  };

  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/songs/${id}/suggestions`,
    `${baseUrl}?${Object.keys(defaultParams)
      .map((k) => `${k}=${defaultParams[k]}`)
      .join("&")}&${sources.song_reco}&id=${id}`,
  ];

  for (let url of urls) {
    try {
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: url,
        headers: {},
      };
      const response = await axios.request(config);
      return response.data;
    } catch (error) {
      continue;
    }
  }
  throw new Error("All recommended songs API instances failed");
}

// Helper function to parse duration from YouTube Music format
function parseDuration(durationText) {
  if (!durationText) {
    return 0;
  }
  const parts = durationText.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Get recommended songs for YouTube Music tracks
async function getYTMusicRecommendedSongs(videoId) {
  try {
    // Use InnerTube to get recommendations/radio
    const result = await InnerTubeClient.getNext(videoId);
    if (!result || !result.items) {
      return { data: { results: [] } };
    }

    // Filter to get only songs from the next list and format for the UI
    const recommendedSongs = result.items
      .filter(item => item.type === 'song' && item.videoId !== videoId)
      .map(item => ({
        id: item.videoId,
        name: item.title,
        image: item.thumbnails ? item.thumbnails.map(t => ({ url: t.url })) : [{ url: item.thumbnail }],
        artists: {
          primary: item.artists || [{ name: item.artist }]
        },
        downloadUrl: item.videoId,
        duration: item.duration,
        language: "en",
        source: "ytmusic",
      }));

    return { data: { results: recommendedSongs.slice(0, 10) } };
  } catch (error) {
    return { data: { results: [] } };
  }
}

export { getRecommendedSongs, getYTMusicRecommendedSongs };
