import axios from "axios";

async function getRecommendedSongs(id){
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
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.song_reco}&id=${id}`,
  ];

  for (let url of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: url,
        headers: { },
      };
      const response = await axios.request(config);
      return response.data
    } catch (error) {
      continue;
    }
  }
  throw new Error('All recommended songs API instances failed');
}

export {getRecommendedSongs}
