import React, {useMemo, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {ThemeContext} from '../../Context/Context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';



/**
 * Modern High-End Search Suggestions Page
 * Pure minimalist design focusing on text-based suggestions.
 */
const SearchSuggestions = ({
  suggestions = [],
  onSuggestionPress,
  isLoading = false,
}) => {
  const {colors, dark} = useTheme();
  const {currentThemeColors} = useContext(ThemeContext);

  const handleFillPress = item => {
    if (onSuggestionPress) {
      onSuggestionPress(item, true);
    }
  };

  // Deep list of optimized text suggestions
  const textSuggestions = useMemo(() => {
    // Remove duplicates and empty strings
    return [
      ...new Set(suggestions.filter(s => s && s.trim().length > 0)),
    ].slice(0, 25);
  }, [suggestions]);

  if (!textSuggestions.length && !isLoading) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.list}>
        {textSuggestions.map((item, index) => (
          <TouchableOpacity
            key={`suggest-${index}`}
            style={styles.item}
            onPress={() => onSuggestionPress && onSuggestionPress(item)}
            activeOpacity={0.6}>
            <View
              style={[
                styles.iconBg,
                {
                  backgroundColor:
                    currentThemeColors?.secondaryBackground ||
                    (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                },
              ]}>
              <Ionicons
                name="search"
                size={16}
                color={colors.text}
                style={{opacity: 0.5}}
              />
            </View>

            <Text
              style={[styles.label, {color: colors.text}]}
              numberOfLines={1}>
              {item}
            </Text>

            <TouchableOpacity
              onPress={() => handleFillPress(item)}
              style={styles.fillButton}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
              <Feather
                name="arrow-up-left"
                size={20}
                color={colors.text}
                style={{opacity: 0.3}}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && textSuggestions.length === 0 && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 150,
    paddingTop: 10,
  },
  list: {
    borderRadius: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  label: {
    fontSize: 17,
    flex: 1,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  fillButton: {
    padding: 5,
    marginLeft: 10,
  },
  loader: {
    marginTop: 50,
    alignItems: 'center',
  },
});

export default React.memo(SearchSuggestions);
