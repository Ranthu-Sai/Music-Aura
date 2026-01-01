import { View, Pressable } from "react-native";
import { useTheme } from "@react-navigation/native";
import React, { memo, useEffect } from "react";
import { PlainText } from "../Global/PlainText";
import { MarqueeText } from "../Global/MarqueeText";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, cancelAnimation, useDerivedValue } from "react-native-reanimated";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import { PlayPauseButton } from "./PlayPauseButton";
import { NextSongButton } from "./NextSongButton";
import { PreviousSongButton } from "./PreviousSongButton";
import { LikeSongButton } from "./LikeSongButton";
import FastImage from "react-native-fast-image";
import YTArtworkUtils from "../../Utils/YTMusicArtworkUtils";
import { useActiveTrack, useProgress, usePlaybackState, State } from "react-native-track-player";
import { PlayNextSong, PlayPreviousSong } from "../../MusicPlayerFunctions";

import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";

const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);

const MiniProgressBar = memo(({ progressColor }) => {
    const { position, duration } = useProgress(1000);
    const progressPercent = useDerivedValue(() => {
        if (!duration || duration <= 0) return 0;
        const p = (position / duration) * 100;
        return isNaN(p) ? 0 : p;
    });

    const animatedProgressStyle = useAnimatedStyle(() => ({
        width: `${progressPercent.value}%`,
    }));

    return (
        <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.05)',
        }}>
            <Animated.View style={[
                {
                    height: '100%',
                    backgroundColor: progressColor,
                },
                animatedProgressStyle
            ]} />
        </View>
    );
});

const MiniTimeDisplay = memo(() => {
    const { position, duration } = useProgress(1000);
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    return (
        <PlainText
            text={`${formatTime(position)} / ${formatTime(duration)}`}
            style={{ fontSize: 10, opacity: 0.6, color: '#999' }}
        />
    );
});

export const MinimizedMusic = memo(({ setIndex, color }) => {
    const playbackState = usePlaybackState();
    const theme = useTheme();

    const isPlaying = playbackState.state === State.Playing || playbackState.state === "playing" || playbackState.state === 3;

    // 1. Clockwise Continuous Rotation logic
    const discRotation = useSharedValue(0);

    useEffect(() => {
        if (isPlaying) {
            // Continuous clockwise rotation
            discRotation.value = withRepeat(
                withTiming(360, {
                    duration: 12000,
                    easing: Easing.linear,
                }),
                -1,
                false
            );
        } else {
            // Pause at current position
            cancelAnimation(discRotation);
        }
    }, [isPlaying, discRotation]);

    const discAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${discRotation.value}deg` }],
    }));

    const pan = Gesture.Pan();
    pan.onFinalize((e) => {
        if (e.translationX > 80) {
            PlayPreviousSong();
        } else if (e.translationX < -80) {
            PlayNextSong();
        } else {
            setIndex(1);
        }
    });

    const currentPlaying = useActiveTrack();
    if (!currentPlaying) return null;

    const progressColor = '#1DB954';

    return (
        <GestureHandlerRootView style={{ height: 85, backgroundColor: 'transparent' }}>
            <View style={{
                marginHorizontal: 10,
                marginBottom: 10,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: '#0c0c0c',
                height: 72,
                elevation: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
            }}>
                {/* Main Content Area */}
                <Animated.View
                    entering={FadeIn}
                    style={{
                        flexDirection: 'row',
                        justifyContent: "space-between",
                        alignItems: "center",
                        height: 68,
                        paddingHorizontal: 10,
                    }}>

                    <GestureDetector gesture={pan}>
                        <Pressable onPress={() => setIndex(1)} style={{
                            flexDirection: "row",
                            flex: 1,
                            alignItems: "center",
                            height: '100%',
                        }}>
                            {/* Spinning Artwork Disc */}
                            <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                                <AnimatedFastImage
                                    source={{
                                        uri: (() => {
                                            const art = currentPlaying?.artwork || currentPlaying?.thumbnail || "https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png";
                                            return YTArtworkUtils.upgradeArtworkQuality(art);
                                        })(),
                                    }}
                                    resizeMode={FastImage.resizeMode.cover}
                                    style={[
                                        {
                                            height: 46,
                                            width: 46,
                                            borderRadius: 23,
                                            backgroundColor: '#111',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.1)',
                                        },
                                        discAnimatedStyle
                                    ]}
                                />
                            </View>

                            {/* Song Info (Ultra Clean Title) */}
                            <View style={{
                                flex: 1,
                                justifyContent: "center",
                                paddingHorizontal: 12,
                                overflow: 'hidden'
                            }}>
                                <MarqueeText
                                    text={FormatTitleAndArtist(currentPlaying?.title ?? "", currentPlaying?.artist)}
                                    style={{ fontSize: 13, fontWeight: 'bold', color: 'white' }}
                                    nospace={true}
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                                    <MiniTimeDisplay />
                                </View>
                            </View>
                        </Pressable>
                    </GestureDetector>

                    {/* Playback Controls */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <LikeSongButton size={22} />
                        <PreviousSongButton size={22} />
                        <PlayPauseButton isFullScreen={false} size={28} />
                        <NextSongButton size={22} />
                    </View>
                </Animated.View>

                {/* GREEN PROGRESS BAR AT THE BOTTOM */}
                <MiniProgressBar progressColor={progressColor} />
            </View>
        </GestureHandlerRootView>
    );
});
