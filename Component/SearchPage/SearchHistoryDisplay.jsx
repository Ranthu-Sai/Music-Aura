import {View, Text, Pressable, FlatList, Animated} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useEffect, useRef, useContext} from 'react';
import {ThemeContext} from '../../Context/Context';
import {useActiveTrack} from 'react-native-track-player';
import SwipeableHistoryItem from './SwipeableHistoryItem';

export default function SearchHistoryDisplay({
  history,
  onSelectQuery,
  onRemoveQuery,
  onClearHistory,
}) {
  const {currentThemeColors} = useContext(ThemeContext);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const activeTrack = useActiveTrack();

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
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 60,
          opacity: fadeAnim,
          transform: [{translateY: slideAnim}],
        }}>
        <Ionicons
          name="search-outline"
          size={80}
          color={
            currentThemeColors.text === '#000000'
              ? 'rgba(0,0,0,0.2)'
              : 'rgba(255,255,255,0.2)'
          }
        />
        <Text
          style={{
            color: currentThemeColors.secondaryText || 'rgba(255,255,255,0.5)',
            fontSize: 18,
            fontFamily: 'roboto',
            marginTop: 20,
            textAlign: 'center',
          }}>
          No recent searches
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: fadeAnim,
      }}>
      <Animated.View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 16,
          marginBottom: 8,
          transform: [{translateY: slideAnim}],
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <MaterialIcons
            name="history"
            size={24}
            color={currentThemeColors.text}
          />
          <Text
            style={{
              color: currentThemeColors.text,
              fontSize: 20,
              fontFamily: 'roboto',
              fontWeight: 'bold',
              marginLeft: 10,
            }}>
            Recent Searches
          </Text>
        </View>
        <Pressable
          onPress={onClearHistory}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            backgroundColor:
              currentThemeColors.text === '#000000'
                ? 'rgba(255,107,107,0.12)'
                : 'rgba(255,107,107,0.15)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,107,107,0.3)',
          }}
          android_ripple={{
            color:
              currentThemeColors.text === '#000000'
                ? 'rgba(255,107,107,0.25)'
                : 'rgba(255,107,107,0.3)',
          }}>
          <Text
            style={{
              color: '#FF6B6B',
              fontSize: 13,
              fontFamily: 'roboto',
              fontWeight: '600',
            }}>
            Clear All
          </Text>
        </Pressable>
      </Animated.View>
      <FlatList
        data={history}
        renderItem={({item}) => (
          <SwipeableHistoryItem
            item={item}
            onPress={() => onSelectQuery(item)}
            onDelete={() => onRemoveQuery(item)}
          />
        )}
        keyExtractor={(item, index) => `${item}_${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: activeTrack ? 105 : 70,
        }}
      />
    </Animated.View>
  );
}
