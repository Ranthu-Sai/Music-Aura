import React, { useRef, useState } from 'react';
import { View, StyleSheet, Animated, Pressable, Dimensions, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Entypo from "react-native-vector-icons/Entypo";
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SwipeableHistoryItem = ({
  item,
  onPress,
  onDelete,
  onSwipeableOpen
}) => {
  const { colors, dark } = useTheme();
  const swipeableRef = useRef(null);
  const [isSwiped, setIsSwiped] = useState(false);

  // Handle delete action with haptic feedback
  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  // Handle swipe start/end
  const handleSwipeStart = () => {
    setIsSwiped(true);
  };

  const handleSwipeEnd = () => {
    setIsSwiped(false);
  };

  // Render the delete action that appears when swiping left
  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
    });

    return (
      <View style={styles.rightAction}>
        <Animated.View style={[styles.actionButton, { transform: [{ translateX: trans }] }]}>
          <Pressable
            style={[styles.deleteButton, { backgroundColor: '#FF3B30' }]}
            onPress={handleDelete}
          >
            <Feather name="trash-2" size={20} color="white" />
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={onSwipeableOpen}
        onSwipeStart={handleSwipeStart}
        onSwipeEnd={handleSwipeEnd}
        rightThreshold={40}
        friction={2}
        overshootFriction={8}
        overshootRight={false}
        containerStyle={styles.swipeableContainer}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => ([
            styles.historyItem,
            {
              backgroundColor: "rgba(255,255,255,0.08)",
              borderColor: "rgba(255,255,255,0.1)",
              opacity: pressed ? 0.7 : 1,
            }
          ])}
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
              handleDelete();
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
      </Swipeable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 2,
    paddingHorizontal: 10,
  },
  swipeableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  rightAction: {
    width: 80,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
});

export default SwipeableHistoryItem;
