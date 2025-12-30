import { MainWrapper } from "../Layout/MainWrapper";
import { SearchBar } from "../Component/Global/SearchBar";
import Tabs from "../Component/Global/Tabs/Tabs";
import { useEffect, useState, useCallback, useRef } from "react";
import { getSearchSongData, getYTSearchSongData, getYTSearchVideoData, getYTSearchAlbumData, getYTSearchPlaylistData, getSearchSuggestions } from "../Api/Songs";
import { View, Keyboard } from "react-native";
import SongDisplay from "../Component/SearchPage/SongDisplay";
import { LoadingComponent } from "../Component/Global/Loading";
import { getSearchPlaylistData } from "../Api/Playlist";
import PlaylistDisplay from "../Component/SearchPage/PlaylistDisplay";
import { getSearchAlbumData } from "../Api/Album";
import AlbumsDisplay from "../Component/SearchPage/AlbumDisplay";
import { Spacer } from "../Component/Global/Spacer";
import SearchHistoryDisplay from "../Component/SearchPage/SearchHistoryDisplay";
import { GetSearchHistory, AddSearchHistory, RemoveSearchHistoryItem, ClearSearchHistory } from "../LocalStorage/SearchHistory";
import ContentTypeToggle from "../Component/Global/ContentTypeToggle";
import SearchSuggestions from "../Component/SearchPage/SearchSuggestions";

export const SearchPage = ({ navigation }) => {
  const [ActiveTab, setActiveTab] = useState(0)
  const [engine, setEngine] = useState(0) // 0: Saavn, 1: YT Music, 2: Youtube
  const [query, setQuery] = useState("");
  const [SearchText, setSearchText] = useState("")
  const [Loading, setLoading] = useState(false)
  const [LoadingMore, setLoadingMore] = useState(false)
  const [Data, setData] = useState({ data: { results: [] } });
  const [hasMore, setHasMore] = useState(true)
  const [searchHistory, setSearchHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [consecutiveDuplicatePages, setConsecutiveDuplicatePages] = useState(0);

  const [suggestions, setSuggestions] = useState([]);
  const [quickResults, setQuickResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchBarRef = useRef(null);

  const limit = 100

  // Fetch suggestions with debounce
  useEffect(() => {
    if (query.trim().length > 0 && !SearchText) {
      // Show history matches immediately for perceived speed
      const historyMatches = searchHistory.filter(h =>
        h.toLowerCase().includes(query.toLowerCase()) && h.toLowerCase() !== query.toLowerCase()
      ).slice(0, 3);
      
      if (historyMatches.length > 0) {
        setSuggestions(prev => {
          const others = prev.filter(p => !historyMatches.includes(p));
          return [...historyMatches, ...others];
        });
        setShowSuggestions(true);
      }

      const timeoutId = setTimeout(async () => {
        try {
          const res = await getSearchSuggestions(query);
          
          const combinedSuggestions = [...new Set([...historyMatches, ...res.suggestions])];

          setSuggestions(combinedSuggestions);
          setQuickResults(res.quickResults);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Suggestions error:", error);
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setShowSuggestions(false);
    }
  }, [query, SearchText, searchHistory]);

  async function fetchSearchData(text, pageNum = 1, append = false) {
    if (text !== "") {
      try {
        if (!append) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }
        let data
        if (engine === 0) { // Saavn
          if (ActiveTab === 0) {
            data = await getSearchSongData(text, pageNum, limit)
          } else if (ActiveTab === 1) {
            data = await getSearchAlbumData(text, pageNum, limit)
          }
          else if (ActiveTab === 2) {
            data = await getSearchPlaylistData(text, pageNum, limit)
          }
        } else if (engine === 1) {
          // YT Music
          if (ActiveTab === 0) {
            data = await getYTSearchSongData(text, pageNum, limit)
          } else if (ActiveTab === 1) {
            data = await getYTSearchAlbumData(text, pageNum, limit)
          } else if (ActiveTab === 2) {
            data = await getYTSearchPlaylistData(text, pageNum, limit)
          }
        } else {
          // Youtube
          data = await getYTSearchVideoData(text, pageNum, limit)
        }

        if (data && data.data && Array.isArray(data.data.results)) {
          if (data.data.results.length === 0) {
            if (!append) {
              setData({ data: { results: [] } })
            }
            setHasMore(false)
          } else if (append) {
            const existingIds = new Set((Data?.data?.results || []).map(item => item.id));
            const newUniqueResults = data.data.results.filter(item => !existingIds.has(item.id));

            setData(prev => ({
              ...prev,
              data: {
                results: [...(prev?.data?.results || []), ...newUniqueResults],
              },
            }))

            if (newUniqueResults.length === 0) {
              const newCount = consecutiveDuplicatePages + 1;
              setConsecutiveDuplicatePages(newCount);
              if (newCount >= 10) {
                setHasMore(false);
              } else {
                setHasMore(data.data.results.length > 0);
              }
            } else {
              setConsecutiveDuplicatePages(0);
              setHasMore(data.data.results.length > 0);
            }
          } else {
            setData(data)
            setHasMore(engine !== 1 && data.data.results.length > 0)
          }
        } else {
          if (!append) {
            setData({ data: { results: [] } })
          }
          setHasMore(false)
        }
      } catch (e) {
        if (!append) {
          setData({ data: { results: [] } })
        }
        setHasMore(false)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    } else {
      setData({ data: { results: [] } })
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!LoadingMore && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchSearchData(SearchText, nextPage, true);
    }
  };

  useEffect(() => {
    if (SearchText) {
      // Clear data immediately to show fresh results for the new engine/tab
      setData({ data: { results: [] } });
      setHasMore(false);
      setCurrentPage(1);
      setConsecutiveDuplicatePages(0);
      fetchSearchData(SearchText, 1, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SearchText, ActiveTab, engine]);

  useEffect(() => {
    GetSearchHistory().then(history => {
      setSearchHistory(history || []);
    });
  }, []);

  const handleSearchSubmit = useCallback((searchQuery) => {
    if (!searchQuery.trim()) return;
    setSearchText(searchQuery);
    setQuery(searchQuery);
    setShowSuggestions(false);
    Keyboard.dismiss();
    AddSearchHistory(searchQuery.trim()).then(history => {
      if (history) setSearchHistory(history);
    });
  }, []);

  const handleSuggestionPress = useCallback((suggestion, fillOnly = false) => {
    setQuery(suggestion);
    searchBarRef.current?.setText(suggestion);
    if (!fillOnly) {
      handleSearchSubmit(suggestion);
    }
  }, [handleSearchSubmit]);

  const handleSelectHistory = (historyQuery) => {
    setQuery(historyQuery);
    searchBarRef.current?.setText(historyQuery);
    handleSearchSubmit(historyQuery);
  };

  const handleRemoveHistory = async (historyQuery) => {
    const newHistory = await RemoveSearchHistoryItem(historyQuery);
    setSearchHistory(newHistory || []);
  };

  const handleClearHistory = async () => {
    const newHistory = await ClearSearchHistory();
    setSearchHistory(newHistory || []);
  };

  const handleSongPress = (song) => {
    // Switch engine based on result source
    if (song.source === 'saavn') {
      setEngine(0);
    } else if (song.source === 'ytmusic') {
      setEngine(1);
    } else if (song.source === 'youtube') {
      setEngine(2);
    }

    // Always switch to Songs tab when clicking a song suggestion
    setActiveTab(0);

    handleSearchSubmit(song.title || song.name);
  };

  const handleQueryChange = useCallback((text) => {
    setQuery(text);
    if (SearchText && text !== SearchText) {
      setSearchText("");
    }
  }, [SearchText]);

  return (
    <MainWrapper>
      <Spacer height={5} />
      <SearchBar
        ref={searchBarRef}
        navigation={navigation}
        onChange={handleQueryChange}
        onSubmit={handleSearchSubmit}
      />
      <Spacer height={5} />

      {SearchText ? (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 10,
        }}>
          <ContentTypeToggle activeTab={ActiveTab} setActiveTab={setActiveTab} />
          <View style={{ marginLeft: 15 }}>
            <Tabs tabs={["Saavn", "YT Music", "Youtube"]} setState={setEngine} state={engine} />
          </View>
        </View>
      ) : null}

      <Spacer height={5} />

      {Loading && <LoadingComponent loading={Loading} />}

      {!Loading && (
        <View style={{ flex: 1 }}>
          {SearchText ? (
            <View style={{ paddingHorizontal: 10, flex: 1 }}>
              {engine === 0 ? (
                <>
                  {ActiveTab === 0 && <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />}
                  {ActiveTab === 1 && <AlbumsDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />}
                  {ActiveTab === 2 && <PlaylistDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />}
                </>
              ) : engine === 1 ? (
                <>
                  {ActiveTab === 0 && <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />}
                  {ActiveTab === 1 && <AlbumsDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />}
                  {ActiveTab === 2 && <PlaylistDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />}
                </>
              ) : (
                <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore} />
              )}
            </View>
          ) : (
            <>
              {showSuggestions ? (
                <SearchSuggestions
                  suggestions={suggestions}
                  quickResults={quickResults}
                  onSuggestionPress={handleSuggestionPress}
                  onSongPress={handleSongPress}
                />
              ) : (
                <SearchHistoryDisplay
                  history={searchHistory}
                  onSelectQuery={handleSelectHistory}
                  onRemoveQuery={handleRemoveHistory}
                  onClearHistory={handleClearHistory}
                />
              )}
            </>
          )}
        </View>
      )}
    </MainWrapper>
  );
};
