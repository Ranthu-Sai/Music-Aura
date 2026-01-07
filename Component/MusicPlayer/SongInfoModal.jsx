import React, {useMemo} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Image,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {PlainText} from '../Global/PlainText';
import {SmallText} from '../Global/SmallText';
import useSongDetails, {cleanText} from '../../hooks/useSongDetails';

// Simple theme object
const defaultTheme = {
  colors: {
    primary: '#1DB954',
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2A2A2A',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#B3B3B3',
    outlineVariant: '#333333',
    error: '#CF6679',
    onPrimary: '#000000',
    onError: '#FFFFFF',
  },
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignSelf: 'center',
    margin: 16,
    width: '100%',
  },
  modalSurface: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  coverArt: {
    width: 88,
    height: 88,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    fontWeight: '600',
    fontSize: 18,
  },
  trackSubtitle: {
    opacity: 0.8,
    fontSize: 14,
  },
  scrollArea: {
    flexGrow: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  sectionSurface: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 2,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: 15,
  },
  rowDivider: {
    marginVertical: 10,
    height: StyleSheet.hairlineWidth,
  },
  listItem: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    flexBasis: '45%',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
    flexBasis: '45%',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  loadingContainer: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  errorDescription: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderArt: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    margin: 0,
    marginLeft: 8,
    alignSelf: 'flex-start',
    padding: 8,
  },
});

const InfoSection = ({title, icon, children}) => {
  return (
    <View
      style={[
        styles.sectionSurface,
        {backgroundColor: defaultTheme.colors.surface},
      ]}>
      <View
        style={[
          styles.sectionHeader,
          {borderBottomColor: defaultTheme.colors.outlineVariant},
        ]}>
        {icon && (
          <MaterialIcons
            name={icon}
            size={20}
            color={defaultTheme.colors.primary}
            style={styles.sectionIcon}
          />
        )}
        <PlainText
          text={title}
          style={StyleSheet.flatten([
            styles.sectionTitle,
            {color: defaultTheme.colors.onSurface},
          ])}
        />
      </View>
      {children}
    </View>
  );
};

const SongInfoModal = ({visible, onDismiss, track}) => {
  const dimensions = useWindowDimensions();
  const {songDetails, loading, error, reload} = useSongDetails(track);

  const trackTitle = useMemo(
    () =>
      cleanText(track?.title) ||
      songDetails?.basicInfo?.[0]?.value ||
      'Unknown Track',
    [track?.title, songDetails?.basicInfo],
  );
  const trackSubtitle = useMemo(() => {
    const artist = cleanText(track?.artist);
    if (artist) {
      return artist;
    }

    // Try to find Artist or Artists in basicInfo
    const artistInfo = songDetails?.basicInfo?.find(
      item => item.label === 'Artist' || item.label === 'Artists',
    );
    return artistInfo?.value || 'Unknown Artist';
  }, [track?.artist, songDetails?.basicInfo]);

  const renderSection = (title, icon, rows) => {
    if (!rows || rows.length === 0) {
      return null;
    }

    return (
      <InfoSection title={title} icon={icon}>
        {rows.map((row, index) => (
          <React.Fragment key={`${title}-${index}`}>
            <View style={styles.listItem}>
              <PlainText
                text={row.label}
                style={StyleSheet.flatten([
                  styles.infoLabel,
                  {color: defaultTheme.colors.onSurfaceVariant},
                ])}
                numberOfLines={2}
              />
              <PlainText
                text={row.value || 'N/A'}
                style={StyleSheet.flatten([
                  styles.infoValue,
                  {
                    color: row.highlight
                      ? defaultTheme.colors.primary
                      : defaultTheme.colors.onSurface,
                  },
                ])}
                numberOfLines={2}
              />
            </View>
            {index < rows.length - 1 && (
              <View
                style={[
                  styles.rowDivider,
                  {backgroundColor: defaultTheme.colors.outlineVariant},
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </InfoSection>
    );
  };

  const getCurrentPlayingQuality = useMemo(() => {
    return track?.currentPlayingQuality || null;
  }, [track?.currentPlayingQuality]);

  const renderChips = (title, icon, chips) => {
    if (!chips || chips.length === 0) {
      return null;
    }

    return (
      <InfoSection title={title} icon={icon}>
        <View style={styles.chipGroup}>
          {chips.map((chip, index) => {
            const isCurrentlyPlaying = chip.label === getCurrentPlayingQuality;

            return (
              <View
                key={`${title}-${chip.label}-${index}`}
                style={[
                  styles.chip,
                  isCurrentlyPlaying
                    ? {
                        backgroundColor: defaultTheme.colors.primary,
                        borderColor: defaultTheme.colors.primary,
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: defaultTheme.colors.outlineVariant,
                      },
                ]}>
                <SmallText
                  text={chip.label}
                  style={{
                    color: isCurrentlyPlaying
                      ? defaultTheme.colors.onPrimary
                      : defaultTheme.colors.onSurfaceVariant,
                  }}
                />
              </View>
            );
          })}
        </View>
      </InfoSection>
    );
  };

  const modalMaxHeight = Math.min(dimensions.height * 0.85, 680);

  return (
    <Modal
      visible={visible}
      onRequestClose={onDismiss}
      transparent
      animationType="fade"
      statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalContainer,
            {maxWidth: Math.min(dimensions.width - 32, 520)},
          ]}>
          <View
            style={[
              styles.modalSurface,
              {backgroundColor: defaultTheme.colors.background},
            ]}>
            <View
              style={[
                styles.header,
                {
                  borderBottomColor: defaultTheme.colors.outlineVariant,
                  backgroundColor: defaultTheme.colors.surface,
                },
              ]}>
              {songDetails?.imageUrl || track?.artwork || track?.image ? (
                <Image
                  source={{
                    uri:
                      songDetails?.imageUrl || track?.artwork || track?.image,
                  }}
                  style={styles.coverArt}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.coverArt,
                    styles.placeholderArt,
                    {backgroundColor: defaultTheme.colors.surfaceVariant},
                  ]}>
                  <MaterialIcons
                    name="music-note"
                    size={34}
                    color={defaultTheme.colors.onSurfaceVariant}
                  />
                </View>
              )}
              <View style={styles.headerContent}>
                <PlainText
                  text={trackTitle}
                  style={StyleSheet.flatten([
                    styles.trackTitle,
                    {color: defaultTheme.colors.onSurface},
                  ])}
                  numberOfLines={1}
                />
                <SmallText
                  text={trackSubtitle}
                  style={StyleSheet.flatten([
                    styles.trackSubtitle,
                    {color: defaultTheme.colors.onSurfaceVariant},
                  ])}
                  numberOfLines={1}
                />
              </View>
              <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={defaultTheme.colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={StyleSheet.flatten([
                styles.scrollContent,
                {paddingBottom: 32},
              ])}
              style={{maxHeight: modalMaxHeight - 130}}
              showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    animating
                    size="large"
                    color={defaultTheme.colors.primary}
                  />
                  <PlainText
                    text="Fetching song details…"
                    style={{
                      marginTop: 16,
                      color: defaultTheme.colors.onSurfaceVariant,
                    }}
                  />
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <MaterialIcons
                    name="error-outline"
                    size={50}
                    color={defaultTheme.colors.error}
                  />
                  <PlainText
                    text="Unable to load details"
                    style={StyleSheet.flatten([
                      styles.errorTitle,
                      {color: defaultTheme.colors.error},
                    ])}
                  />
                  <PlainText
                    text={
                      error || 'Please check your connection and try again.'
                    }
                    style={StyleSheet.flatten([
                      styles.errorDescription,
                      {color: defaultTheme.colors.onSurfaceVariant},
                    ])}
                  />
                  <TouchableOpacity
                    onPress={reload}
                    style={[
                      styles.retryButton,
                      {backgroundColor: defaultTheme.colors.primary},
                    ]}>
                    <MaterialCommunityIcons
                      name="refresh"
                      size={18}
                      color={defaultTheme.colors.onPrimary}
                    />
                    <PlainText
                      text="Try again"
                      style={{
                        color: defaultTheme.colors.onPrimary,
                        marginLeft: 8,
                      }}
                    />
                  </TouchableOpacity>
                </View>
              ) : songDetails ? (
                <>
                  {renderSection(
                    'Track information',
                    'music-note',
                    songDetails.basicInfo,
                  )}
                  {songDetails.featuredArtists
                    ? renderSection('Featured artists', 'group', [
                        {label: 'Artists', value: songDetails.featuredArtists},
                      ])
                    : null}
                  {renderSection(
                    'Additional details',
                    'info-outline',
                    songDetails.additionalInfo,
                  )}
                  {renderSection(
                    'Media information',
                    'album',
                    songDetails.mediaInfo,
                  )}
                  {renderChips(
                    'Available qualities',
                    'high-quality',
                    songDetails.availableQualities?.map(quality => ({
                      label: quality,
                    })),
                  )}
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    animating
                    size="small"
                    color={defaultTheme.colors.primary}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SongInfoModal;
