import axios from "axios";

async function getAlbumData(id){
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    album_detail: "__call=webapi.get&type=album",
  };

  const urls = [
    "https://jiosavan-api-with-playlist.vercel.app/api/albums?id=" + id,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.album_detail}&id=${id}`,
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
  throw new Error('All album data API instances failed');
}

async function getSearchAlbumData(searchText,page,limit){
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    album_search: "__call=search.getAlbumResults&n=" + limit,
  };

  const urls = [
    `https://jiosavan-api-with-playlist.vercel.app/api/search/albums?query=${searchText}&page=${page}&limit=${limit}`,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.album_search}&q=${encodeURIComponent(searchText)}&p=${page}`,
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
  throw new Error('All album search API instances failed');
}
export {getAlbumData, getSearchAlbumData}
