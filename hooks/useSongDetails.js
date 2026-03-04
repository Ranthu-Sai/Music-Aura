import {useState, useEffect} from 'react';
import axios from 'axios';

// Helper function to remove "From [Album/Movie]" suffix
const removeFromSuffix = text => {
  if (!text) {
    return text;
  }
  let result = text.toString();
  // Remove " From ..." or " from ..." patterns
  result = result.replace(/\s+from\s+.*/gi, '');
  // Remove "(From ...)" and "[From ...]" patterns separately to avoid nested char classes
  result = result.replace(/\s*\(from\s+[^)]*\)/gi, '');
  result = result.replace(/\s*\[from\s+[^\]]*\]/gi, '');
  // Remove language suffixes like "- Telugu", "- Hindi", "- Tamil", etc.
  result = result.replace(
    /\s*-\s*(Telugu|Hindi|Tamil|Kannada|Malayalam|Bengali|Punjabi|Gujarati|Marathi|English|Odia|Assamese)$/gi,
    '',
  );
  return result.trim();
};

// Helper function to decode HTML entities
const decodeHtmlEntities = text => {
  if (!text) {
    return text;
  }
  return text
    .toString()
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, 'and')
    .replace(/&trade;/g, '™')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

// Helper to clean text: decode HTML entities and remove "From" suffix
export const cleanText = text => {
  if (!text) {
    return text;
  }
  return removeFromSuffix(decodeHtmlEntities(text));
};

// Helper function to format duration
const formatDuration = seconds => {
  if (!seconds || isNaN(seconds)) {
    return 'N/A';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Helper function to format artists
const formatArtists = artists => {
  if (!artists || !Array.isArray(artists)) {
    return 'N/A';
  }
  return artists.map(a => cleanText(a.name)).join(', ');
};

// Helper to get best available image
const getBestImage = images => {
  if (!images || !images.length) {
    return null;
  }
  const bestImage = [...images].sort(
    (a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10),
  )[0];
  return bestImage?.url || null;
};

const useSongDetails = track => {
  const [songDetails, setSongDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = () => {
    if (track?.id) {
      setLoading(true);
      setError(null);
    }
  };

  useEffect(() => {
    const fetchSongDetails = async () => {
      if (!track?.id) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // For local tracks
        if (track.isLocal) {
          // Handle both string album and object album {name: '...'}
          const albumValue =
            typeof track.album === 'object' ? track.album?.name : track.album;
          const albumName =
            albumValue && albumValue !== track.title
              ? cleanText(albumValue)
              : 'N/A';

          setSongDetails({
            basicInfo: [
              {
                label: 'Title',
                value: cleanText(track.title) || 'Unknown Track',
              },
              {
                label: 'Artist',
                value: cleanText(track.artist) || 'Unknown Artist',
              },
              {label: 'Album', value: albumName},
              {label: 'Duration', value: formatDuration(track.duration)},
              {label: 'Year', value: track.year || 'N/A'},
              {label: 'Genre', value: track.genre || 'N/A'},
            ],
            fileInfo: [
              {
                label: 'File Type',
                value: track.url
                  ? track.url.split('.').pop().toUpperCase()
                  : 'N/A',
              },
              {
                label: 'Bitrate',
                value: track.bitrate
                  ? `${Math.round(track.bitrate / 1000)} kbps`
                  : 'N/A',
              },
              {
                label: 'File Size',
                value: track.size
                  ? `${(track.size / (1024 * 1024)).toFixed(2)} MB`
                  : 'N/A',
              },
              {label: 'Location', value: 'Local Storage'},
            ],
          });
          setLoading(false);
          return;
        }

        // For YouTube Music tracks
        const isYTMusicTrack =
          track.isYTMusic ||
          track.source === 'ytmusic' ||
          (track.id?.length === 11 && !track.isLocalMusic);

        if (isYTMusicTrack) {
          let actualQuality = track.currentPlayingQuality || 'Opus ~148kbps';
          if (
            actualQuality === '320kbps' ||
            actualQuality === '320kbs' ||
            actualQuality === 'High Quality'
          ) {
            actualQuality = 'Opus ~148kbps';
          }

          const artistInfo =
            track.artist ||
            track.primaryArtists ||
            (track.artists?.primary
              ? formatArtists(track.artists.primary)
              : 'Unknown Artist');

          // For YouTube Music, album data is often unreliable or same as title
          // Handle both string album and object album {name: '...'}
          const albumValue =
            typeof track.album === 'object' ? track.album?.name : track.album;
          const albumName =
            albumValue &&
            albumValue !== track.title &&
            albumValue !== track.name
              ? cleanText(albumValue)
              : 'N/A';

          setSongDetails({
            basicInfo: [
              {
                label: 'Title',
                value: cleanText(track.title || track.name) || 'Unknown Track',
              },
              {label: 'Artist', value: cleanText(artistInfo)},
              {label: 'Album', value: albumName},
              {label: 'Duration', value: formatDuration(track.duration)},
              {label: 'Source', value: 'YouTube Music', highlight: true},
              {
                label: 'Language',
                value:
                  track.language !== 'unknown'
                    ? track.language?.toUpperCase()
                    : 'N/A',
              },
            ],
            additionalInfo: [
              {label: 'Video ID', value: track.id || 'N/A'},
              {label: 'Quality', value: actualQuality},
              {label: 'Type', value: track.type || 'Song'},
              {label: 'Year', value: track.year || 'N/A'},
            ],
            mediaInfo: [
              {label: 'Streaming', value: 'YouTube Music'},
              {label: 'Song ID', value: track.id || 'N/A'},
            ],
            imageUrl: track.artwork || track.image,
            availableQualities: ['Opus ~128-160kbps'],
          });
          setLoading(false);
          return;
        }

        // For online tracks from API
        const response = await axios.get(
          `https://jiosaavn-api-privatecvc2.vercel.app/songs?id=${track.id}`,
        );

        if (response.data && (response.data.success || response.data.status === 'SUCCESS')) {
          const data = response.data.data?.[0];
          if (!data) {
            throw new Error('No song data found');
          }

          const primaryArtists = formatArtists(data.artists?.primary);
          const featuredArtists = formatArtists(data.artists?.featured);
          const availableQualities =
            data.downloadUrl?.map(item => item.quality) || [];
          const bestQuality =
            availableQualities.length > 0
              ? availableQualities[availableQualities.length - 1]
              : 'N/A';

          // Validate album name is different from title (compare cleaned versions)
          const albumName = (() => {
            const albumFromAPI = data.album?.name;
            const albumFromTrack =
              typeof track.album === 'object' ? track.album?.name : track.album;
            const titleFromAPI = data.name || track.title;

            // Function to extract album from "From..." patterns
            const extractAlbumFromTitle = text => {
              if (!text) {
                return null;
              }
              const decodedText = decodeHtmlEntities(text);
              const fromMatch =
                decodedText.match(/from\s+["']([^"']+)["']/i) ||
                decodedText.match(/from\s+["“]([^"”]+)["”]/i) || // Handles different quote characters
                decodedText.match(/from\s+\(([^)]+)\)/i) ||
                decodedText.match(/from\s+\[([^\]]+)\]/i);

              if (fromMatch && fromMatch[1]) {
                const extracted = fromMatch[1].trim();
                // Final cleaning on the extracted part, but don't remove "From" again
                return decodeHtmlEntities(extracted);
              }
              return null;
            };

            // Attempt extraction from API data first
            const extractedFromAPI = extractAlbumFromTitle(albumFromAPI);
            if (extractedFromAPI) {
              return extractedFromAPI;
            }

            const extractedFromTrack = extractAlbumFromTitle(albumFromTrack);
            if (extractedFromTrack) {
              return extractedFromTrack;
            }

            // Fallback to existing logic if no "From..." pattern is found
            const cleanedAPIAlbum = albumFromAPI
              ? cleanText(albumFromAPI)
              : null;
            const cleanedTrackAlbum = albumFromTrack
              ? cleanText(albumFromTrack)
              : null;
            const cleanedTitle = cleanText(titleFromAPI);

            if (
              cleanedAPIAlbum &&
              cleanedAPIAlbum !== cleanedTitle &&
              cleanedAPIAlbum !== 'N/A'
            ) {
              return cleanedAPIAlbum;
            }
            if (
              cleanedTrackAlbum &&
              cleanedTrackAlbum !== cleanedTitle &&
              cleanedTrackAlbum !== 'N/A'
            ) {
              return cleanedTrackAlbum;
            }

            return 'N/A';
          })();

          setSongDetails({
            basicInfo: [
              {
                label: 'Title',
                value: cleanText(data.name || track.title) || 'Unknown Track',
              },
              {label: 'Artists', value: primaryArtists},
              {label: 'Album', value: albumName},
              {
                label: 'Duration',
                value: formatDuration(data.duration || track.duration),
              },
              {label: 'Year', value: data.year || track.year || 'N/A'},
              {
                label: 'Language',
                value: data.language ? data.language.toUpperCase() : 'N/A',
              },
            ],
            additionalInfo: [
              {label: 'Release Date', value: data.releaseDate || 'N/A'},
              {label: 'Label', value: cleanText(data.label) || 'N/A'},
              {label: 'Copyright', value: cleanText(data.copyright) || 'N/A'},
              {label: 'Explicit', value: data.explicitContent ? 'Yes' : 'No'},
              {
                label: 'Lyrics',
                value: data.hasLyrics ? 'Available' : 'Not Available',
              },
              {label: 'Type', value: data.type || 'N/A'},
            ],
            mediaInfo: [
              {label: 'Best Quality', value: bestQuality},
              {
                label: 'Play Count',
                value: data.playCount?.toLocaleString() || 'N/A',
              },
              {label: 'Song ID', value: data.id || 'N/A'},
              {label: 'Album ID', value: data.album?.id || 'N/A'},
            ],
            availableQualities,
            imageUrl: getBestImage(data.image),
            featuredArtists: featuredArtists !== 'N/A' ? featuredArtists : null,
          });
        } else {
          // Fallback to track data if API request fails
          // Handle both string album and object album {name: '...'}
          const albumValue =
            typeof track.album === 'object' ? track.album?.name : track.album;
          const albumName =
            albumValue && albumValue !== track.title
              ? cleanText(albumValue)
              : 'N/A';

          setSongDetails({
            basicInfo: [
              {
                label: 'Title',
                value: cleanText(track.title) || 'Unknown Track',
              },
              {
                label: 'Artist',
                value: cleanText(track.artist) || 'Unknown Artist',
              },
              {label: 'Album', value: albumName},
              {label: 'Duration', value: formatDuration(track.duration)},
            ],
            additionalInfo: [
              {label: 'Status', value: 'Using local track data'},
              {label: 'ID', value: track.id || 'N/A'},
              {
                label: 'Source',
                value: track.isLocal ? 'Local File' : 'Streaming',
              },
            ],
          });
        }
      } catch (err) {
        console.error('Error fetching song details:', err);
        setError('Failed to load song details. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchSongDetails();
  }, [track]);

  return {songDetails, loading, error, reload};
};

export default useSongDetails;
