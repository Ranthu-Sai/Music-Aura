import Animated, { useAnimatedRef } from "react-native-reanimated";
import { LikedPagesTopHeader } from "../../Component/Library/TopHeaderLikedPages";
import { LikedDetails } from "../../Component/Library/LikedDetails";
import { useEffect, useState, useCallback } from "react";
import { scanLocalMusic, deleteLocalSong } from "../../Utils/LocalMusicScanner";
import { EachSongCard } from "../../Component/Global/EachSongCard";
import { Dimensions, View, ActivityIndicator, Text, TouchableOpacity, ToastAndroid } from "react-native";
import { useTheme } from "@react-navigation/native";
import AntDesign from "react-native-vector-icons/AntDesign";

export const DownloadedSongsPage = () => {
    const AnimatedRef = useAnimatedRef()
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const width = Dimensions.get("window").width
    const theme = useTheme()

    const fetchSongs = useCallback(async () => {
        setLoading(true);
        const localSongs = await scanLocalMusic();
        setSongs(localSongs);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchSongs();
    }, [fetchSongs]);

    const handleRefresh = () => {
        fetchSongs();
        ToastAndroid.show("Scanning for music...", ToastAndroid.SHORT);
    };

    return (
        <Animated.ScrollView
            scrollEventThrottle={16}
            ref={AnimatedRef}
            contentContainerStyle={{
                paddingBottom: 100,
                backgroundColor: "rgba(0,0,0)",
            }}
        >
            <LikedPagesTopHeader
                AnimatedRef={AnimatedRef}
                url={{ uri: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop' }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 }}>
                <View>
                    <LikedDetails name={"Downloads"} Data={songs} />
                </View>
                <TouchableOpacity onPress={handleRefresh} style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 50 }}>
                    <AntDesign name="reload1" size={20} color="#1DB954" />
                </TouchableOpacity>
            </View>

            {!loading && songs.length > 0 && (
                <Text style={{ color: 'white', opacity: 0.6, fontSize: 12, paddingHorizontal: 20, marginBottom: 10 }}>
                    Found {songs.length} audio files on your device
                </Text>
            )}

            <View style={{ paddingHorizontal: 10, backgroundColor: theme.colors.background, minHeight: 400 }}>
                {loading ? (
                    <View style={{ marginTop: 50 }}>
                        <ActivityIndicator size="large" color="#1DB954" />
                        <Text style={{ color: 'white', textAlign: 'center', marginTop: 10 }}>Scanning entire phone for music...</Text>
                        <Text style={{ color: 'white', opacity: 0.5, textAlign: 'center', fontSize: 10 }}>This might take a moment depending on your storage size.</Text>
                    </View>
                ) : songs.length === 0 ? (
                    <View style={{ marginTop: 50 }}>
                        <Text style={{ color: 'white', opacity: 0.6, textAlign: 'center' }}>No music files found on storage.</Text>
                        <Text style={{ color: 'white', opacity: 0.4, textAlign: 'center', fontSize: 12, marginTop: 5 }}>Try adding some MP3s or other audio files to your device.</Text>
                    </View>
                ) : (
                    songs.map((e, i) => (
                        <EachSongCard
                            width={width * 0.95}
                            Data={songs}
                            index={i}
                            url={e?.url}
                            id={e?.url} // For local songs, URL is a good ID
                            title={e?.title}
                            artist={e?.artist}
                            image={e?.artwork}
                            duration={e?.duration}
                            key={e.url}
                        />
                    ))
                )}
            </View>
        </Animated.ScrollView>
    );
};
