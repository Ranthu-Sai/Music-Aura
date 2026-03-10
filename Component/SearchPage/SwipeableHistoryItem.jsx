import React, {useRef, useContext} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  Text,
} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Entypo from 'react-native-vector-icons/Entypo';
import Feather from 'react-native-vector-icons/Feather';
import {useTheme} from '@react-navigation/native';
import {ThemeContext} from '../../Context/Context';

const SwipeableHistoryItem = ({item, onPress, onEdit, onDelete, onSwipeableOpen}) => {
  const {dark} = useTheme();
  const {currentThemeColors} = useContext(ThemeContext);
  const swipeableRef = useRef(null);

  // Handle delete action with haptic feedback
  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  // Handle swipe start/end (no visual state tracked currently)
  const handleSwipeStart = () => {};

  const handleSwipeEnd = () => {};

  // Render the delete action that appears when swiping left
  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
    });

    return (
      <View style={styles.rightAction}>
        <Animated.View
          style={[styles.actionButton, {transform: [{translateX: trans}]}]}>
          <Pressable
            style={[styles.deleteButton, {backgroundColor: '#FF3B30'}]}
            onPress={handleDelete}>
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
        containerStyle={styles.swipeableContainer}>
        <Pressable
          onPress={onPress}
          style={({pressed}) => [
            styles.historyItem,
            {
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          android_ripple={{
            color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          }}>
          <Text
            style={{
              flex: 1,
              color: currentThemeColors.text,
              fontSize: 18,
              fontFamily: 'roboto',
            }}
            numberOfLines={1}>
            {item}
          </Text>
          <Pressable
            onPress={e => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              padding: 6,
              marginRight: 4,
            }}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              borderless: true,
            }}>
            <MaterialIcons
              name="north-west"
              size={20}
              color={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
            />
          </Pressable>
          <Pressable
            onPress={e => {
              e.stopPropagation();
              handleDelete();
            }}
            style={{
              padding: 6,
            }}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              borderless: true,
            }}>
            <Entypo
              name="cross"
              size={22}
              color={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
            />
          </Pressable>
        </Pressable>
      </Swipeable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 10,
  },
  swipeableContainer: {
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 4,
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
