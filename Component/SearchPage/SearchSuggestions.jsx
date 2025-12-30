import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';

/**
 * SearchSuggestions with Quick Results
 * Shows text suggestions + top 3 song results like OuterTune
 */
const SearchSuggestions = ({
    suggestions = [],
    quickResults = [],
    onSuggestionPress,
    onSongPress
}) => {
    const { colors } = useTheme();
    const navigation = useNavigation();

    const handleSongPress = (song) => {
        if (onSongPress) {
            onSongPress(song);
        }
    };

    // Fill suggestion arrow press - fills input but doesn't search
    const handleFillPress = (item) => {
        if (onSuggestionPress) {
            onSuggestionPress(item, true); // second param = fillOnly
        }
    };

    if ((!suggestions || suggestions.length === 0) && (!quickResults || quickResults.length === 0)) {
        return null;
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {/* Text Suggestions */}
            {suggestions.slice(0, 10).map((item, index) => (
                <TouchableOpacity
                    key={`suggestion-${index}`}
                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                    onPress={() => onSuggestionPress && onSuggestionPress(item)}
                >
                    <Ionicons name="search" size={20} color={colors.text} style={{ opacity: 0.5, marginRight: 15 }} />
                    <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
                        {item}
                    </Text>
                    <TouchableOpacity
                        onPress={() => handleFillPress(item)}
                        style={styles.fillButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Feather name="arrow-up-right" size={18} color={colors.text} style={{ opacity: 0.5 }} />
                    </TouchableOpacity>
                </TouchableOpacity>
            ))}

            {/* Quick Results Section */}
            {quickResults && quickResults.length > 0 && (
                <View style={styles.quickResultsSection}>
                    {quickResults.slice(0, 6).map((song, index) => (
                        <TouchableOpacity
                            key={`quick-${song.id || index}`}
                            style={[styles.songItem, { borderBottomColor: colors.border }]}
                            onPress={() => handleSongPress(song)}
                        >
                            <Image
                                source={{ uri: song.image?.[0]?.url || song.artwork || song.thumbnail }}
                                style={styles.songImage}
                            />
                            <View style={styles.songInfo}>
                                <Text
                                    style={[styles.songTitle, { color: colors.text }]}
                                    numberOfLines={1}
                                >
                                    {song.name || song.title}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {song.source && (
                                        <View style={[styles.sourceBadge, { backgroundColor: song.source === 'ytmusic' ? '#FF0000' : song.source === 'youtube' ? '#FF0000' : '#24D366' }]}>
                                            <Text style={styles.sourceText}>
                                                {song.source === 'ytmusic' ? 'YTM' : song.source === 'youtube' ? 'YT' : 'Saavn'}
                                            </Text>
                                        </View>
                                    )}
                                    <Text
                                        style={[styles.songArtist, { color: colors.text, flex: 1 }]}
                                        numberOfLines={1}
                                    >
                                        {song.artist || song.primaryArtists || 'Unknown Artist'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.moreButton}>
                                <Text style={{ color: colors.text, opacity: 0.5, fontSize: 18 }}>⋮</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 15,
    },
    contentContainer: {
        paddingBottom: 120, // Extra space for mini player and bottom navigation
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    suggestionText: {
        fontSize: 16,
        flex: 1,
    },
    fillButton: {
        padding: 5,
    },
    quickResultsSection: {
        marginTop: 8,
    },
    songItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    songImage: {
        width: 48,
        height: 48,
        borderRadius: 4,
        backgroundColor: '#333',
    },
    songInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    songTitle: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    songArtist: {
        fontSize: 13,
        opacity: 0.7,
    },
    sourceBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        marginRight: 6,
    },
    sourceText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    moreButton: {
        padding: 8,
    },
});

export default React.memo(SearchSuggestions);
