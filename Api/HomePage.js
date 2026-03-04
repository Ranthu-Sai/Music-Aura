export * from './Saavn/HomePage';
import axios from 'axios';

// JioSaavn API Fallback URLs (only hosts that support /modules endpoint)
const JIOSAAVN_API_FALLBACKS = [
  'https://jiosaavn-api-privatecvc2.vercel.app', // Primary fallback
  'https://jio-saavan-api.vercel.app', // Secondary fallback
];

// Cache for home page data
const cache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 180000, // 3 minutes
};

async function getHomePageData(languages) {
  // Return cached data if still valid
  if (
    cache.data &&
    cache.timestamp &&
    Date.now() - cache.timestamp < cache.CACHE_DURATION
  ) {
    return cache.data;
  }

  const baseUrl = 'https://www.jiosaavn.com/api.php';
  const defaultParams = {
    ctx: 'wap6dot0',
    api_version: 4,
    _format: 'json',
    _marker: 0,
  };
  const sources = {
    launch_data: '__call=webapi.getLaunchData',
  };

  const urls = [
    'https://jiosaavn-api-privatecvc2.vercel.app/modules?language=' + languages,
    'https://jio-saavan-api.vercel.app/modules?language=' + languages,
    `${baseUrl}?${Object.keys(defaultParams)
      .map(k => `${k}=${defaultParams[k]}`)
      .join('&')}&${sources.launch_data}`,
  ];

  // Add fallback API URLs with /modules endpoint
  JIOSAAVN_API_FALLBACKS.forEach(apiBase => {
    urls.push(`${apiBase}/modules?language=${languages}`);
  });

  for (let url of urls) {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: url,
        headers: {},
      };
      const response = await axios.request(config);

      // Cache the response
      cache.data = response.data;
      cache.timestamp = Date.now();

      return response.data;
    } catch (error) {
      continue;
    }
  }

  // If all APIs fail, return cached data if available (even if expired)
  if (cache.data) {
    return cache.data;
  }

  throw new Error('All home page API instances failed');
}

export {getHomePageData};
