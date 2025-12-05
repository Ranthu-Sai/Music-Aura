import { View, Text, Pressable, FlatList, Animated } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Entypo from "react-native-vector-icons/Entypo";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useEffect, useRef } from "react";

const AnimatedHistoryItem = ({ item, index, onSelectQuery, onRemoveQuery }) => {
  const itemAnim = useRef(new Animated.Value(0)).current;
  const itemSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(itemAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(itemSlide, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, itemAnim, itemSlide]);

  return (
    <Animated.View
      style={{
        opacity: itemAnim,
        transform: [{ translateX: itemSlide }],
      }}
    >
      <Pressable
        onPress={() => onSelectQuery(item)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginHorizontal: 10,
          marginVertical: 4,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
        }}
        android_ripple={{ color: "rgba(255,255,255,0.1)" }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "rgba(255,255,255,0.1)",
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <MaterialIcons name="history" size={20} color="rgba(255,255,255,0.7)" />
        </View>
        <Text
          style={{
            flex: 1,
            color: "white",
            fontSize: 17,
            fontFamily: "roboto",
          }}
          numberOfLines={1}
        >
          {item}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemoveQuery(item);
          }}
          style={{
            padding: 8,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
          android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: true }}
        >
          <Entypo name="cross" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

export default function SearchHistoryDisplay({ history, onSelectQuery, onRemoveQuery, onClearHistory }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, history]);

  if (!history || history.length === 0) {
    return (
      <Animated.View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 60,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <Ionicons name="search-outline" size={80} color="rgba(255,255,255,0.2)" />
        <Text
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
            fontFamily: "roboto",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          No recent searches
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
            fontFamily: "roboto",
            marginTop: 8,
            textAlign: "center",
            paddingHorizontal: 40,
          }}
        >
          Your search history will appear here
        </Text>
      </Animated.View>
    );
  }

  const renderHistoryItem = ({ item, index }) => {
    return (
      <AnimatedHistoryItem
        item={item}
        index={index}
        onSelectQuery={onSelectQuery}
        onRemoveQuery={onRemoveQuery}
      />
    );
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: fadeAnim,
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          marginBottom: 8,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MaterialIcons name="history" size={24} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 20,
              fontFamily: "roboto",
              fontWeight: "bold",
              marginLeft: 10,
            }}
          >
            Recent Searches
          </Text>
        </View>
        <Pressable
          onPress={onClearHistory}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            backgroundColor: "rgba(255,107,107,0.15)",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "rgba(255,107,107,0.3)",
          }}
          android_ripple={{ color: "rgba(255,107,107,0.3)" }}
        >
          <Text
            style={{
              color: "#FF6B6B",
              fontSize: 13,
              fontFamily: "roboto",
              fontWeight: "600",
            }}
          >
            Clear All
          </Text>
        </Pressable>
      </Animated.View>
      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, index) => `${item}_${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 20,
        }}
      />
    </Animated.View>
  );
}
