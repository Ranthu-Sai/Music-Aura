export * from './Saavn/HomePage';
import axios from "axios";

async function getHomePageData(languages){
  const baseUrl = "https://www.jiosaavn.com/api.php";
  const defaultParams = {
    ctx: "wap6dot0",
    api_version: 4,
    _format: "json",
    _marker: 0,
  };
  const sources = {
    launch_data: "__call=webapi.getLaunchData",
  };

  const urls = [
    'https://jio-savan-api-sigma.vercel.app/modules?language=' + languages,
    `${baseUrl}?${Object.keys(defaultParams).map(k => `${k}=${defaultParams[k]}`).join('&')}&${sources.launch_data}`,
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
  throw new Error('All home page API instances failed');
}

export {getHomePageData}
