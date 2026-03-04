import * as crypto from 'crypto-es';

/**
 * Decrypt JioSaavn encrypted media URL
 * @param {string} encryptedUrl - The encrypted media URL from JioSaavn API
 * @returns {string} - Decrypted streaming URL
 */
export function decryptMedia(encryptedUrl) {
  if (!encryptedUrl) {
    return '';
  }

  try {
    const key = crypto.Utf8.parse('38346591');

    const decrypted = crypto.DES.decrypt(
      {
        ciphertext: crypto.Base64.parse(encryptedUrl),
      },
      key,
      {
        mode: crypto.ECB,
        padding: crypto.Pkcs7,
      },
    );

    const decryptedUrl = decrypted.toString(crypto.Utf8);
    return decryptedUrl || '';
  } catch (error) {
    console.warn('DecryptMedia: Failed to decrypt URL', error.message);
    return '';
  }
}

/**
 * Get streaming URLs with multiple quality options
 * @param {string} encryptedMediaUrl - The encrypted media URL
 * @param {string} songId - Song ID for fallback API calls
 * @returns {Promise<Array>} - Array of quality options with URLs
 */
export async function getStreamingUrls(encryptedMediaUrl, songId = null) {
  const urls = [];
  let axios;

  // Dynamic import for axios (works in both CommonJS and ES modules)
  try {
    axios = require('axios');
  } catch {
    const axiosModule = await import('axios');
    axios = axiosModule.default;
  }

  // Try to decrypt the encrypted URL
  if (encryptedMediaUrl) {
    try {
      const decryptedUrl = decryptMedia(encryptedMediaUrl);
      if (decryptedUrl) {


        // Generate all quality variants
        const baseUrl = decryptedUrl.replace(/_\d+\.mp4/, '');
        const qualities = ['320', '160', '96', '48', '12'];

        qualities.forEach(q => {
          const url = `${baseUrl}_${q}.mp4`;
          urls.push({
            quality: `${q}kbps`,
            url: url,
            link: url,
          });
        });
      }
    } catch (error) {
      console.warn('getStreamingUrls: Decryption failed', error.message);
    }
  }

  // Second fallback: Try JioSaavn generateAuthToken API
  if (urls.length === 0 && songId && axios) {
    try {
      const response = await axios.get('https://www.jiosaavn.com/api.php', {
        params: {
          __call: 'song.generateAuthToken',
          _format: 'json',
          ctx: 'wap6dot0',
          api_version: 4,
          _marker: 0,
          bitrate: 320,
          url: songId,
        },
        timeout: 10000,
      });

      if (response.data && response.data.auth_url) {
        urls.push({
          quality: '320kbps',
          url: response.data.auth_url,
          link: response.data.auth_url,
        });
      }
    } catch (error) {
      console.warn(
        'getStreamingUrls: Second fallback API failed',
        error.message,
      );
    }
  }

  // Third fallback: Try Vercel JioSaavn API
  if (urls.length === 0 && songId && axios) {
    const apiUrls = [
      `https://jiosaavn-api-privatecvc2.vercel.app/songs?id=${songId}`,
      `https://jio-saavan-api.vercel.app/songs?id=${songId}`,
    ];

    for (const apiUrl of apiUrls) {
      try {
        const response = await axios.get(apiUrl, {
          timeout: 10000,
        });

        let data = response.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }

        // Check if response has downloadUrl array
        if (
          data?.data?.[0]?.downloadUrl &&
          Array.isArray(data.data[0].downloadUrl)
        ) {
          data.data[0].downloadUrl.forEach(item => {
            if (item.url || item.link) {
              urls.push({
                quality: item.quality || '320kbps',
                url: item.url || item.link,
                link: item.url || item.link,
              });
            }
          });
        }
        // Check direct downloadUrl
        else if (data?.downloadUrl && Array.isArray(data.downloadUrl)) {
          data.downloadUrl.forEach(item => {
            if (item.url || item.link) {
              urls.push({
                quality: item.quality || '320kbps',
                url: item.url || item.link,
                link: item.url || item.link,
              });
            }
          });
        }
        // Check if response has direct URL
        else if (data?.data?.[0]?.url) {
          urls.push({
            quality: '320kbps',
            url: data.data[0].url,
            link: data.data[0].url,
          });
        }

        // If we found URLs, break out of the loop
        if (urls.length > 0) {
          break;
        }
      } catch (error) {
        console.warn(
          `getStreamingUrls: API fallback failed for ${apiUrl}`,
          error.message,
        );
      }
    }
  }

  return urls;
}
