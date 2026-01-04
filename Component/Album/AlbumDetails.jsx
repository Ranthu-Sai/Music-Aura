import { Dimensions, View, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import { cleanText } from "../../hooks/useSongDetails";
import { useTheme } from "@react-navigation/native";
import { AddPlaylist, getIndexQuality } from "../../MusicPlayerFunctions";
import { useContext, useState, useCallback } from "react";
import { ActionsContext } from "../../Context/Context";
import FormatArtist from "../../Utils/FormatArtists";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import FastImage from "react-native-fast-image";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH * 0.38;

export const AlbumDetails = ({ name, artist, year, songCount, duration, Data }) => {
  const { updateTrack } = useContext(ActionsContext);
  const theme = useTheme();
  const [isPlayingLoading, setIsPlayingLoading] = useState(false);
  const [isShufflingLoading, setIsShufflingLoading] = useState(false);

  const AddToPlayer = useCallback(async () => {
    if (isPlayingLoading) return;
    
    try {
      setIsPlayingLoading(true);
      const quality = await getIndexQuality();
      const ForMusicPlayer = Data?.data?.songs?.map((e) => {
        const download = Array.isArray(e?.downloadUrl) 
          ? (e?.downloadUrl[quality]?.url || e?.downloadUrl[0]?.url) 
          : e?.downloadUrl;

        return {
          url: download,
          title: FormatTitleAndArtist(e?.name),
          artist: FormatTitleAndArtist(FormatArtist(e?.artists?.primary)),
          artwork: Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[0]?.url) : e?.image,
          image: Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[0]?.url) : e?.image,
          duration: e?.duration,
          id: e?.id,
          language: e?.language,
          artistID: e?.primary_artists_id,
          source: 'ytmusic',
        };
      });
      
      await AddPlaylist(ForMusicPlayer);
      updateTrack();
    } catch (error) {
      console.error('Error playing album:', error);
    } finally {
      setIsPlayingLoading(false);
    }
  }, [isPlayingLoading, Data, updateTrack]);

  const handleShufflePress = useCallback(async () => {
    if (isShufflingLoading) return;
    
    try {
      setIsShufflingLoading(true);
      const quality = await getIndexQuality();
      const songs = Data?.data?.songs || [];
      
      // Shuffle array
      const shuffled = [...songs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const ForMusicPlayer = shuffled.map((e) => {
        const download = Array.isArray(e?.downloadUrl) 
          ? (e?.downloadUrl[quality]?.url || e?.downloadUrl[0]?.url) 
          : e?.downloadUrl;

        return {
          url: download,
          title: FormatTitleAndArtist(e?.name),
          artist: FormatTitleAndArtist(FormatArtist(e?.artists?.primary)),
          artwork: Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[0]?.url) : e?.image,
          image: Array.isArray(e?.image) ? (e?.image[2]?.url || e?.image[0]?.url) : e?.image,
          duration: e?.duration,
          id: e?.id,
          language: e?.language,
          artistID: e?.primary_artists_id,
          source: 'ytmusic',
        };
      });
      
      await AddPlaylist(ForMusicPlayer);
      updateTrack();
    } catch (error) {
      console.error('Error shuffling album:', error);
    } finally {
      setIsShufflingLoading(false);
    }
  }, [isShufflingLoading, Data, updateTrack]);

  // Get album image
  const albumImage = Data?.data?.image?.[2]?.url || Data?.data?.image?.[0]?.url || '';

  // Compute the best album display name: prefer API name, but if it's identical
  // to the song title (common for single-song albums), try extracting the
  // actual album from song metadata or from "From ..." patterns.
  const computeAlbumName = () => {
    const rawAlbum = name || (Data?.data?.name ?? '');
    const song = Data?.data?.songs?.[0] || null;
    const rawSongTitle = song?.name || song?.title || '';

    const decodeHtmlEntitiesLocal = (text) => {
      if (!text) return text;
      return text.toString()
        .replace(/&quot;/g, '"')
        .replace(/&apos;|&#039;/g, "'")
        .replace(/&amp;/g, 'and')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    };

    const extractFromPattern = (txt) => {
      if (!txt) return null;
      const decoded = decodeHtmlEntitiesLocal(txt);
      const m = decoded.match(/from\s+["'“”]?([^"'\)\]]+)["'“”]?/i) ||
                decoded.match(/\((?:From|from)\s+["'“”]?([^"'\)\]]+)["'“”]?\)/i) ||
                decoded.match(/\[(?:From|from)\s+([^\]]+)\]/i);
      if (m && m[1]) return m[1].trim();
      return null;
    };

    const cleanedRawAlbum = rawAlbum ? cleanText(rawAlbum) : '';
    const cleanedSongTitle = rawSongTitle ? cleanText(rawSongTitle) : '';

    // If API-provided album is meaningful and different from song title, use it
    if (cleanedRawAlbum && cleanedRawAlbum !== cleanedSongTitle && cleanedRawAlbum !== 'N/A') {
      return cleanedRawAlbum;
    }

    // Try album field on the song object
    const albumFromSongField = song ? (typeof song.album === 'object' ? song.album?.name : song.album) : null;
    if (albumFromSongField) {
      const extracted = extractFromPattern(albumFromSongField) || cleanText(albumFromSongField);
      if (extracted && extracted !== cleanedSongTitle && extracted !== 'N/A') return extracted;
    }

    // Try extracting album name from the song title itself
    const extractedFromTitle = extractFromPattern(rawSongTitle);
    if (extractedFromTitle && extractedFromTitle !== cleanedSongTitle) return decodeHtmlEntitiesLocal(extractedFromTitle);

    // Fallback to cleaned API album or generic label
    return cleanedRawAlbum || 'Album';
  };

  const displayAlbumName = computeAlbumName();

  return (
    <View style={styles.container}>
      {/* Top Section: Image + Info */}
      <View style={styles.topSection}>
        {/* Cover Image */}
        <FastImage
          source={{ uri: albumImage, priority: FastImage.priority.high }}
          style={styles.coverImage}
          resizeMode={FastImage.resizeMode.cover}
        />

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Title removed as per design: show image only on left */}

          {/* Show exact cleaned album name only */}
          {displayAlbumName && (
            <PlainText
              text={displayAlbumName}
              numberOfLines={1}
              style={StyleSheet.flatten([styles.title, { color: theme.colors.text }])}
            />
          )}

          {/* Info Chips Row */}
          <View style={styles.infoRow}>
            {/* Track Count Chip */}
            <View style={[styles.infoChip, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <SmallText
                text={`${songCount} ${songCount === 1 ? 'track' : 'tracks'}`}
                style={StyleSheet.flatten([styles.chipText, { color: theme.colors.text }])}
              />
            </View>

            {/* Year Chip */}
            {year && (
              <View style={[styles.infoChip, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                <SmallText
                  text={year}
                  style={StyleSheet.flatten([styles.chipText, { color: theme.colors.text }])}
                />
              </View>
            )}

            {/* Duration Chip */}
            {duration && (
              <View style={[styles.infoChip, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                <SmallText
                  text={duration}
                  style={StyleSheet.flatten([styles.chipText, { color: theme.colors.text }])}
                />
              </View>
            )}
          </View>

          {/* Action Icons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name="favorite-border" 
                size={20} 
                color={theme.colors.text} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name="download-outline" 
                size={20} 
                color={theme.colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Button Row */}
      <View style={styles.buttonRow}>
        {/* Play Button */}
        <TouchableOpacity
          style={[styles.playButton, { 
            backgroundColor: isPlayingLoading ? '#32CD32' + '80' : '#32CD32' 
          }]}
          onPress={AddToPlayer}
          disabled={isPlayingLoading}
          activeOpacity={0.8}
        >
          {isPlayingLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialIcons name="play-arrow" size={22} color="#FFFFFF" />
          )}
          <PlainText
            text={isPlayingLoading ? "Loading..." : "Play"}
            style={styles.buttonText}
          />
        </TouchableOpacity>

        {/* Shuffle Button */}
        <TouchableOpacity
          style={StyleSheet.flatten([
            styles.shuffleButton,
            { 
              backgroundColor: theme.dark ? 'transparent' : 'rgba(0,0,0,0.05)',
              borderColor: theme.dark ? 'rgba(255,255,255,0.3)' : theme.colors.primary,
            }
          ])}
          onPress={handleShufflePress}
          disabled={isShufflingLoading}
          activeOpacity={0.8}
        >
          {isShufflingLoading ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <MaterialCommunityIcons name="shuffle" size={22} color={theme.dark ? '#FFFFFF' : theme.colors.primary} />
          )}
          <PlainText
            text="Shuffle"
            style={StyleSheet.flatten([styles.buttonText, { color: theme.dark ? '#FFFFFF' : theme.colors.primary }])}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  coverImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  contentSection: {
    flex: 1,
    marginLeft: 20,
    paddingLeft: 4,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 22,
  },
  artist: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    opacity: 0.85,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  infoChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 24,
    gap: 6,
  },
  shuffleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 24,
    gap: 6,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
