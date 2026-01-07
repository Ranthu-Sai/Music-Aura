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

const SwipeableHistoryItem = ({item, onPress, onDelete, onSwipeableOpen}) => {
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
              backgroundColor:
                currentThemeColors.secondaryBackground ||
                (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
              borderColor: currentThemeColors.secondaryText
                ? currentThemeColors.secondaryText + '22'
                : dark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.08)',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          android_ripple={{
            color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: dark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.06)',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
            <MaterialIcons
              name="history"
              size={20}
              color={dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}
            />
          </View>
          <Text
            style={{
              flex: 1,
              color: currentThemeColors.text,
              fontSize: 17,
              fontFamily: 'roboto',
            }}
            numberOfLines={1}>
            {item}
          </Text>
          <Pressable
            onPress={e => {
              e.stopPropagation();
              handleDelete();
            }}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: dark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)',
            }}
            android_ripple={{
              color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              borderless: true,
            }}>
            <Entypo
              name="cross"
              size={18}
              color={dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
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
    marginVertical: 2,
    paddingHorizontal: 10,
  },
  swipeableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
