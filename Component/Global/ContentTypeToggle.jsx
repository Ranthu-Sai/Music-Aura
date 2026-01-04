import { View, Text, Pressable, Animated } from "react-native";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@react-navigation/native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

export default function ContentTypeToggle({ activeTab, setActiveTab }) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const contentTypes = [
    { id: 0, label: "Songs", icon: "music-note" },
    { id: 1, label: "Albums", icon: "album" },
    { id: 2, label: "Playlists", icon: "queue-music" },
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpanded, slideAnim, rotateAnim]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const selectContentType = (id) => {
    setActiveTab(id);
    setIsExpanded(false);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={{
      alignItems: "flex-start",
      marginLeft: 0,
    }}>
      {/* Main Toggle Button */}
      <Pressable
        onPress={toggleExpanded}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: theme.dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)",
          minWidth: 100,
        }}
        android_ripple={{ color: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}
      >
        <MaterialIcons
          name={contentTypes[activeTab].icon}
          size={16}
          color={theme.colors.text}
          style={{ marginRight: 6 }}
        />
        <Text style={{
          color: theme.colors.text,
          fontSize: 14,
          fontFamily: "roboto",
          fontWeight: "500",
        }}>
          {contentTypes[activeTab].label}
        </Text>
        <Animated.View style={{
          marginLeft: 6,
          transform: [{ rotate }],
        }}>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={16}
            color={theme.dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)"}
          />
        </Animated.View>
      </Pressable>

      {/* Expanded Options */}
      <Animated.View
        style={{
          flexDirection: "column",
          marginTop: 8,
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, 0],
            }),
          }],
        }}
      >
        {isExpanded && contentTypes
          .filter(type => type.id !== activeTab)
          .map((type, index) => (
            <Pressable
              key={type.id}
              onPress={() => selectContentType(type.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                borderRadius: 18,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginBottom: 4,
                borderWidth: 1,
                borderColor: theme.dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                minWidth: 90,
              }}
              android_ripple={{ color: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}
            >
              <MaterialIcons
                name={type.icon}
                size={14}
                color={theme.dark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)"}
                style={{ marginRight: 5 }}
              />
              <Text style={{
                color: theme.colors.text,
                fontSize: 13,
                fontFamily: "roboto",
                fontWeight: "400",
              }}>
                {type.label}
              </Text>
            </Pressable>
          ))}
      </Animated.View>
    </View>
  );
}
