import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ytAuthService from '../../Utils/YouTubeAuthService';
const LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&continue=https://music.youtube.com/';

// JavaScript to inject for extracting user info from YouTube Music page
// This runs on music.youtube.com after login to extract account details
const USER_INFO_EXTRACTION_JS = `
(function() {
    try {
        let name = '';
        let handle = '';
        let avatarUrl = '';
        
        // Method 1: Find avatar from the account button in YouTube Music
        const ytmAvatarSelectors = [
            'ytmusic-pivot-bar-item-renderer[tab-id="SPaccount"] img',
            '#right-content ytmusic-pivot-bar-item-renderer:last-child img',
            'tp-yt-paper-icon-button#avatar-btn img',
            '#avatar-btn img',
            'img.yt-img-shadow'
        ];
        
        for (const selector of ytmAvatarSelectors) {
            const img = document.querySelector(selector);
            if (img && img.src && !img.src.includes('default_avatar') && !img.src.includes('no_avatar')) {
                avatarUrl = img.src;
                // Get higher resolution
                if (avatarUrl.includes('=s')) {
                    avatarUrl = avatarUrl.replace(/=s\\d+-/, '=s176-');
                    avatarUrl = avatarUrl.replace(/=s\\d+$/, '=s176');
                }
                break;
            }
        }
        
        // Method 2: Try to get name from ytcfg
        if (typeof ytcfg !== 'undefined' && ytcfg.get) {
            const context = ytcfg.get('INNERTUBE_CONTEXT');
            if (context && context.user && context.user.lockedSafetyMode === false) {
                // User is logged in, but name might not be directly available
            }
        }
        
        // Method 3: Look for account info in ytInitialData
        if (typeof ytInitialData !== 'undefined' && ytInitialData) {
            // Check header for account info
            const header = ytInitialData.header;
            if (header && header.musicVisualHeaderRenderer) {
                const title = header.musicVisualHeaderRenderer.title;
                if (title && title.runs && title.runs[0]) {
                    name = title.runs[0].text;
                }
            }
        }
        
        // Method 4: Click account button to load menu, then extract
        const accountBtn = document.querySelector('ytmusic-pivot-bar-item-renderer[tab-id="SPaccount"]') ||
                          document.querySelector('#avatar-btn');
        if (accountBtn && !name) {
            // We'll try to get name from somewhere else since menu clicking is complex
        }
        
        // If we have avatar, send it
        if (avatarUrl) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'userInfo',
                data: { name: name || '', handle, avatarUrl }
            }));
        }
    } catch (e) {
        console.error('User info extraction error:', e);
    }
})();
true;
`;

// More aggressive extraction that waits for page to fully load
const DELAYED_USER_INFO_EXTRACTION_JS = `
(function() {
    setTimeout(function() {
        try {
            let avatarUrl = '';
            
            // Find all images and look for avatar
            const images = document.querySelectorAll('img');
            for (const img of images) {
                const src = img.src || '';
                // Google user avatars usually contain these patterns
                if (src.includes('googleusercontent.com') && 
                    (src.includes('/a/') || src.includes('=s') || src.includes('-c-'))) {
                    // Skip very small avatars (likely icons)
                    if (!src.includes('=s16') && !src.includes('=s24') && !src.includes('=s32')) {
                        avatarUrl = src;
                        // Get higher resolution
                        if (avatarUrl.includes('=s')) {
                            avatarUrl = avatarUrl.replace(/=s\\d+-/, '=s176-');
                            avatarUrl = avatarUrl.replace(/=s\\d+(-c)?$/, '=s176$1');
                        }
                        break;
                    }
                }
            }
            
            if (avatarUrl) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'userInfo',
                    data: { name: '', handle: '', avatarUrl: avatarUrl }
                }));
            }
        } catch (e) {
            console.error('Delayed user info extraction error:', e);
        }
    }, 3000);
})();
true;
`;

/**
 * Pure JavaScript SHA1 implementation for SAPISIDHASH
 * No external dependencies required
 */
/* eslint-disable no-bitwise */
const sha1 = (message) => {
  const rotateLeft = (n, s) => (n << s) | (n >>> (32 - s));

  const cvtHex = (val) => {
    let str = '';
    for (let i = 7; i >= 0; i--) {
      str += ((val >>> (i * 4)) & 0x0f).toString(16);
    }
    return str;
  };

  const utf8Encode = (str) => {
    return unescape(encodeURIComponent(str));
  };

  let H0 = 0x67452301;
  let H1 = 0xefcdab89;
  let H2 = 0x98badcfe;
  let H3 = 0x10325476;
  let H4 = 0xc3d2e1f0;

  const msg = utf8Encode(message);
  const msgLen = msg.length;

  const wordArray = [];
  for (let i = 0; i < msgLen - 3; i += 4) {
    wordArray.push(
      (msg.charCodeAt(i) << 24) |
        (msg.charCodeAt(i + 1) << 16) |
        (msg.charCodeAt(i + 2) << 8) |
        msg.charCodeAt(i + 3)
    );
  }

  let i = msgLen % 4;
  let temp = 0x80;
  if (i === 0) {
    wordArray.push(0x80000000);
  } else if (i === 1) {
    temp |= msg.charCodeAt(msgLen - 1) << 24;
    wordArray.push(temp << 24);
  } else if (i === 2) {
    temp =
      (msg.charCodeAt(msgLen - 2) << 24) |
      (msg.charCodeAt(msgLen - 1) << 16) |
      0x8000;
    wordArray.push(temp);
  } else {
    temp =
      (msg.charCodeAt(msgLen - 3) << 24) |
      (msg.charCodeAt(msgLen - 2) << 16) |
      (msg.charCodeAt(msgLen - 1) << 8) |
      0x80;
    wordArray.push(temp);
  }

  while (wordArray.length % 16 !== 14) {
    wordArray.push(0);
  }
  wordArray.push(0);
  wordArray.push(msgLen * 8);

  for (let blockStart = 0; blockStart < wordArray.length; blockStart += 16) {
    const W = new Array(80);

    for (let t = 0; t < 16; t++) {
      W[t] = wordArray[blockStart + t];
    }
    for (let t = 16; t < 80; t++) {
      W[t] = rotateLeft(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let A = H0,
      B = H1,
      C = H2,
      D = H3,
      E = H4;

    for (let t = 0; t < 80; t++) {
      let K, f;
      if (t < 20) {
        f = (B & C) | (~B & D);
        K = 0x5a827999;
      } else if (t < 40) {
        f = B ^ C ^ D;
        K = 0x6ed9eba1;
      } else if (t < 60) {
        f = (B & C) | (B & D) | (C & D);
        K = 0x8f1bbcdc;
      } else {
        f = B ^ C ^ D;
        K = 0xca62c1d6;
      }

      const temp2 = (rotateLeft(A, 5) + f + E + K + W[t]) & 0xffffffff;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp2;
    }

    H0 = (H0 + A) & 0xffffffff;
    H1 = (H1 + B) & 0xffffffff;
    H2 = (H2 + C) & 0xffffffff;
    H3 = (H3 + D) & 0xffffffff;
    H4 = (H4 + E) & 0xffffffff;
  }

  return cvtHex(H0) + cvtHex(H1) + cvtHex(H2) + cvtHex(H3) + cvtHex(H4);
};
/* eslint-enable no-bitwise */

/**
 * Parse cookie string into a map
 */
const parseCookieString = (cookieString) => {
  const cookies = {};
  cookieString.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
};

/**
 * Fetch YouTube account info using cookies
 * This makes a request to YouTube Music to get the actual account details
 * Based on ArchiveTune's implementation
 */
const fetchYouTubeAccountInfo = async (cookieString) => {
  try {
    const cookieMap = parseCookieString(cookieString);
    const sapisid = cookieMap.SAPISID;

    if (!sapisid) {
      return null;
    }

    // Generate SAPISIDHASH
    const origin = 'https://music.youtube.com';
    const currentTime = Math.floor(Date.now() / 1000);
    const sapisidHash = sha1(`${currentTime} ${sapisid} ${origin}`);
    const authorization = `SAPISIDHASH ${currentTime}_${sapisidHash}`;

    // Make request to account menu endpoint
    const response = await fetch(
      'https://music.youtube.com/youtubei/v1/account/account_menu?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieString,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0',
          Origin: origin,
          Referer: 'https://music.youtube.com/',
          'X-Origin': origin,
          'X-Goog-AuthUser': '0',
          Authorization: authorization,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20231219.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Parse the response - ArchiveTune's path:
      // actions[0].openPopupAction.popup.multiPageMenuRenderer.header.activeAccountHeaderRenderer
      const activeAccountHeader =
        data?.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer
          ?.header?.activeAccountHeaderRenderer;

      if (activeAccountHeader) {
        const name = activeAccountHeader.accountName?.runs?.[0]?.text || '';
        const email = activeAccountHeader.email?.runs?.[0]?.text || '';
        const channelHandle =
          activeAccountHeader.channelHandle?.runs?.[0]?.text || '';
        const avatarUrl =
          activeAccountHeader.accountPhoto?.thumbnails?.slice(-1)?.[0]?.url ||
          '';
        return {
          name: name || email?.split('@')?.[0] || 'YouTube User',
          handle: channelHandle || (email ? `@${email.split('@')[0]}` : ''),
          avatarUrl: avatarUrl,
        };
      }
    } else {
    }

    return null;
  } catch (error) {
    return null;
  }
};

const LoginScreen = () => {
  const navigation = useNavigation();
  const webViewRef = useRef(null);
  const hasSavedCookiesRef = useRef(false);
  const lastCookieRef = useRef('');
  const [cookieInput, setCookieInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('webview'); // 'webview' or 'manual'

  const stopCookieWatcher = () => {
    webViewRef.current?.injectJavaScript(`
if (window.__cookieWatcher) {
    clearInterval(window.__cookieWatcher);
    window.__cookieWatcher = null;
}
true;
`);
  };

  useEffect(() => {
    return () => {
      stopCookieWatcher();
    };
  }, []);

  const handleCookieExtraction = async () => {
    try {
      setLoading(true);
      const cookies = await CookieManager.get('https://music.youtube.com');
      // Convert to cookie string format expected by Python requests
      // Format: "name=value; name2=value2"
      const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value.value} `)
        .join('; ');

      if (cookieString.includes('SAPISID')) {
        await saveAndSendCookies(cookieString);
      } else {
        Alert.alert(
          'Login Incomplete',
          'Could not find essential cookies. Please ensure you are fully logged in.'
        );
      }
    } catch (error) {
      console.error('Cookie extraction failed:', error);
      Alert.alert('Error', 'Failed to extract cookies.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCookieSave = async () => {
    if (!cookieInput.trim()) {
      Alert.alert('Error', 'Please paste your cookies first.');
      return;
    }
    await saveAndSendCookies(cookieInput.trim());
  };

  const saveAndSendCookies = async (
    cookieString,
    { fromAutoCapture = false, userInfo = null } = {}
  ) => {
    try {
      if (fromAutoCapture && hasSavedCookiesRef.current) {
        return;
      }
      if (cookieString === lastCookieRef.current) {
        return;
      }
      setLoading(true);
      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem('yt_cookies', cookieString);

      const RNFS = require('react-native-fs');
      const path = `${RNFS.DocumentDirectoryPath}/headers_auth.json`;

      // Create the JSON structure expected by ytmusicapi (browser.json format roughly)
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/json',
        'X-Goog-AuthUser': '0',
        Cookie: cookieString,
      };

      await RNFS.writeFile(path, JSON.stringify(headers), 'utf8');
      // Try to fetch actual YouTube account info
      let finalUserInfo = userInfo;
      if (
        !finalUserInfo ||
        !finalUserInfo.name ||
        finalUserInfo.name === 'YouTube User'
      ) {
        const fetchedInfo = await fetchYouTubeAccountInfo(cookieString);
        if (fetchedInfo) {
          finalUserInfo = fetchedInfo;
        }
      }

      // Save user info to YouTubeAuthService
      if (finalUserInfo && (finalUserInfo.name || finalUserInfo.handle)) {
        await ytAuthService.setUser(finalUserInfo);
      } else {
        // Set as authenticated even if we don't have user info
        // Try to extract email from cookies as fallback
        let fallbackName = 'YouTube User';
        const emailMatch = cookieString.match(/LOGIN_INFO=([^;]+)/);
        if (emailMatch) {
          // LOGIN_INFO contains base64 encoded data, but extracting name is complex
        }

        await ytAuthService.setUser({
          name: fallbackName,
          handle: '',
          avatarUrl: null,
        });
      }

      hasSavedCookiesRef.current = true;
      lastCookieRef.current = cookieString;
      stopCookieWatcher();

      // Try to extract user info from WebView if we're in webview mode
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(USER_INFO_EXTRACTION_JS);
      }

      Alert.alert('Success', 'Login successful! You can now stream music.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Save cookies failed:', error);
      Alert.alert('Error', 'Failed to save login session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Login to YouTube Music</Text>
        <TouchableOpacity
          onPress={() => setMode(mode === 'webview' ? 'manual' : 'webview')}
        >
          <Text style={styles.switchMode}>
            {mode === 'webview' ? 'Manual' : 'WebView'}
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'webview' ? (
        <>
          <WebView
            ref={webViewRef}
            source={{ uri: LOGIN_URL }}
            style={styles.webview}
            injectedJavaScript={`
                            if (!window.__cookieWatcher) {
                                window.__cookieWatcher = setInterval(() => {
                                    window.ReactNativeWebView.postMessage(document.cookie || '');
                                }, 1200);
                            }
                            true;
                        `}
            onLoadEnd={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              const url = nativeEvent.url || '';

              // Check if we're on YouTube Music after login
              if (
                url.includes('music.youtube.com') &&
                !hasSavedCookiesRef.current
              ) {
                // Inject script to extract user info from the page
                webViewRef.current?.injectJavaScript(
                  DELAYED_USER_INFO_EXTRACTION_JS
                );
              }
            }}
            onMessage={(event) => {
              const data = event.nativeEvent.data;

              // Try to parse as JSON (user info message)
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'userInfo' && parsed.data) {
                  // Get current user data
                  const currentUser = ytAuthService.getUser();

                  // Only update if we have better data than what's stored
                  // Don't overwrite good name with empty/default name
                  const hasGoodName =
                    currentUser?.name && currentUser.name !== 'YouTube User';
                  const newHasName =
                    parsed.data.name &&
                    parsed.data.name !== '' &&
                    parsed.data.name !== 'YouTube User';

                  if (newHasName || !hasGoodName) {
                    // Merge data, keeping existing good values
                    ytAuthService.setUser({
                      name:
                        parsed.data.name && parsed.data.name !== ''
                          ? parsed.data.name
                          : currentUser?.name || 'YouTube User',
                      handle: parsed.data.handle || currentUser?.handle || '',
                      avatarUrl:
                        parsed.data.avatarUrl || currentUser?.avatarUrl || null,
                    });
                  } else if (parsed.data.avatarUrl && !currentUser?.avatarUrl) {
                    // Just update avatar if that's all we need it
                    ytAuthService.setUser({
                      ...currentUser,
                      avatarUrl: parsed.data.avatarUrl,
                    });
                  }
                  return;
                }
              } catch (e) {
                // Not JSON, treat as cookie string
              }

              // Handle as cookie string
              const cookies = data;
              if (
                cookies &&
                cookies.includes('SAPISID') &&
                !loading &&
                !hasSavedCookiesRef.current
              ) {
                saveAndSendCookies(cookies, { fromAutoCapture: true });
              }
            }}
          />
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCookieExtraction}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.captureText}>Manual Capture (Backup)</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.manualContainer}>
          <Text style={styles.instruction}>
            Paste your "Cookie" header string here. You can get this from your
            browser's developer tools (Network tab to request to
            music.youtube.com).
          </Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Paste cookies here..."
            placeholderTextColor="#666"
            value={cookieInput}
            onChangeText={setCookieInput}
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleManualCookieSave}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save Cookies</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: '#121212',
  },
  backButton: { padding: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchMode: { color: '#3ea6ff', fontSize: 14 },
  webview: { flex: 1 },
  captureButton: {
    backgroundColor: '#fff',
    padding: 16,
    alignItems: 'center',
    margin: 16,
    borderRadius: 8,
  },
  captureText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  manualContainer: { flex: 1, padding: 20 },
  instruction: { color: '#ccc', marginBottom: 20, lineHeight: 20 },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    height: 150,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#3ea6ff',
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    borderRadius: 8,
  },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default LoginScreen;




