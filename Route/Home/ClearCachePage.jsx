import { MainWrapper } from "../../Layout/MainWrapper";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { Heading } from "../../Component/Global/Heading";
import { PlainText } from "../../Component/Global/PlainText";
import { SmallText } from "../../Component/Global/SmallText";
import { Pressable, ScrollView, ToastAndroid, View, Alert } from "react-native";
import { useEffect, useState, useContext } from "react";
import Context from "../../Context/Context";
import { GetCacheSizes, ClearSelectedCache, ClearAllCache } from "../../LocalStorage/ClearCache";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

function EachCacheOption({ item, isSelected, onToggle, size, currentThemeColors }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        backgroundColor: isSelected ? currentThemeColors.primary + '20' : currentThemeColors.background,
        padding: 15,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? currentThemeColors.primary : currentThemeColors.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <MaterialIcons
          name={item.icon}
          size={24}
          color={isSelected ? currentThemeColors.primary : currentThemeColors.text}
          style={{ marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <PlainText text={item.label} />
          <SmallText text={formatBytes(size)} />
        </View>
      </View>
      <MaterialIcons
        name={isSelected ? "check-box" : "check-box-outline-blank"}
        size={24}
        color={isSelected ? currentThemeColors.primary : currentThemeColors.secondaryText}
      />
    </Pressable>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}


export const ClearCachePage = ({ navigation }) => {
  const { currentThemeColors } = useContext(Context);
  const [cacheSizes, setCacheSizes] = useState({});
  const [selectedCache, setSelectedCache] = useState([]);
  const [loading, setLoading] = useState(false);

  const cacheOptions = [
    { key: 'SEARCH_HISTORY', label: 'Search History', icon: 'history' },
    { key: 'LIKED_SONGS', label: 'Liked Songs', icon: 'favorite' },
    { key: 'LIKED_PLAYLISTS', label: 'Liked Playlists', icon: 'playlist-add-check' },
    { key: 'QUEUE', label: 'Queue', icon: 'queue-music' },
    { key: 'LAST_SONG', label: 'Last Played Song', icon: 'play-circle-outline' },
    { key: 'IMAGE_CACHE', label: 'Image Cache', icon: 'image' },
  ];

  async function loadCacheSizes() {
    const sizes = await GetCacheSizes();
    setCacheSizes(sizes);
  }

  useEffect(() => {
    loadCacheSizes();
  }, []);

  function toggleCacheSelection(key) {
    if (selectedCache.includes(key)) {
      setSelectedCache(selectedCache.filter(k => k !== key));
    } else {
      setSelectedCache([...selectedCache, key]);
    }
  }

  function selectAll() {
    setSelectedCache(cacheOptions.map(opt => opt.key));
  }

  function deselectAll() {
    setSelectedCache([]);
  }

  async function handleClearSelected() {
    if (selectedCache.length === 0) {
      ToastAndroid.show("Please select at least one item to clear", ToastAndroid.SHORT);
      return;
    }

    Alert.alert(
      "Clear Selected Cache",
      `Are you sure you want to clear ${selectedCache.length} selected item(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const success = await ClearSelectedCache(selectedCache);
            if (success) {
              ToastAndroid.show("Selected cache cleared successfully", ToastAndroid.SHORT);
              setSelectedCache([]);
              await loadCacheSizes();
            } else {
              ToastAndroid.show("Error clearing cache", ToastAndroid.SHORT);
            }
            setLoading(false);
          },
        },
      ],
    );
  }

  async function handleClearAll() {
    Alert.alert(
      "Clear All Cache",
      "Are you sure you want to clear all cache data? This will remove all search history, liked songs, playlists, and queue. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const success = await ClearAllCache();
            if (success) {
              ToastAndroid.show("All cache cleared successfully", ToastAndroid.SHORT);
              setSelectedCache([]);
              await loadCacheSizes();
            } else {
              ToastAndroid.show("Error clearing cache", ToastAndroid.SHORT);
            }
            setLoading(false);
          },
        },
      ],
    );
  }

  return (
    <MainWrapper>
      <PaddingConatiner>
        <Heading text={"CLEAR CACHE"} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Total Cache Size */}
          <View style={{
            backgroundColor: currentThemeColors.primary + '20',
            padding: 20,
            borderRadius: 10,
            marginBottom: 15,
            alignItems: "center",
          }}>
            <SmallText text="Total Cache Size" />
            <PlainText text={formatBytes(cacheSizes.TOTAL || 0)} />
          </View>

          {/* Selection Controls */}
          <View style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 15,
          }}>
            <Pressable
              onPress={selectAll}
              style={{
                backgroundColor: currentThemeColors.background,
                padding: 10,
                borderRadius: 8,
                flex: 1,
                marginRight: 5,
                alignItems: "center",
              }}
            >
              <PlainText text="Select All" />
            </Pressable>
            <Pressable
              onPress={deselectAll}
              style={{
                backgroundColor: currentThemeColors.background,
                padding: 10,
                borderRadius: 8,
                flex: 1,
                marginLeft: 5,
                alignItems: "center",
              }}
            >
              <PlainText text="Deselect All" />
            </Pressable>
          </View>

          {/* Cache Options */}
          <View style={{ marginBottom: 15 }}>
            {cacheOptions.map(item => {
              const isSelected = selectedCache.includes(item.key);
              const size = cacheSizes[item.key] || 0;
              return (
                <EachCacheOption
                  key={item.key}
                  item={item}
                  isSelected={isSelected}
                  onToggle={() => toggleCacheSelection(item.key)}
                  size={size}
                  currentThemeColors={currentThemeColors}
                />
              );
            })}
          </View>

          {/* Action Buttons */}
          <Pressable
            onPress={handleClearSelected}
            disabled={loading || selectedCache.length === 0}
            style={{
              backgroundColor: selectedCache.length > 0 ? currentThemeColors.primary : currentThemeColors.background,
              padding: 15,
              borderRadius: 10,
              alignItems: "center",
              marginBottom: 10,
              opacity: loading || selectedCache.length === 0 ? 0.5 : 1,
            }}
          >
            <PlainText text={`Clear Selected (${selectedCache.length})`} />
          </Pressable>

          <Pressable
            onPress={handleClearAll}
            disabled={loading}
            style={{
              backgroundColor: currentThemeColors.background,
              padding: 15,
              borderRadius: 10,
              alignItems: "center",
              marginBottom: 10,
              borderWidth: 1,
              borderColor: 'red',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <PlainText text="Clear All Cache" />
          </Pressable>

          <SmallText text="*Note: Clearing cache will remove stored data permanently. Settings and user preferences will not be affected." />
        </ScrollView>
      </PaddingConatiner>
    </MainWrapper>
  );
};
