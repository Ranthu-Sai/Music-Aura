import {MainWrapper} from '../Layout/MainWrapper';
import {SearchBar} from '../Component/Global/SearchBar';
import Tabs from '../Component/Global/Tabs/Tabs';
import {useEffect, useState, useCallback, useRef} from 'react';
import {
  getSearchSongData,
  getYTSearchSongData,
  getYTSearchVideoData,
  getYTSearchAlbumData,
  getYTSearchPlaylistData,
  getSearchSuggestions,
} from '../Api/Songs';
import {View, Keyboard} from 'react-native';
import SongDisplay from '../Component/SearchPage/SongDisplay';
import {getSearchPlaylistData} from '../Api/Playlist';
import PlaylistDisplay from '../Component/SearchPage/PlaylistDisplay';
import {getSearchAlbumData} from '../Api/Album';
import AlbumsDisplay from '../Component/SearchPage/AlbumDisplay';
import {Spacer} from '../Component/Global/Spacer';
import SearchHistoryDisplay from '../Component/SearchPage/SearchHistoryDisplay';
import {
  GetSearchHistory,
  AddSearchHistory,
  RemoveSearchHistoryItem,
  ClearSearchHistory,
} from '../LocalStorage/SearchHistory';
import ContentTypeToggle from '../Component/Global/ContentTypeToggle';
import SearchSuggestions from '../Component/SearchPage/SearchSuggestions';
import {
  ShimmerSearchResults,
  ShimmerSearchAlbums,
  ShimmerSearchPlaylists,
} from '../Component/Global/ShimmerEffect';

// Add cache for search results
const searchCache = new Map();
const SEARCH_CACHE_DURATION = 180000; // 3 minutes

function getSearchCacheKey(text, engine, tab, page) {
  return `${text}_${engine}_${tab}_${page}`;
}

export const SearchPage = ({navigation}) => {
  const [ActiveTab, setActiveTab] = useState(0);
  const [engine, setEngine] = useState(0); // 0: Saavn, 1: YT Music, 2: Youtube
  const [query, setQuery] = useState('');
  const [SearchText, setSearchText] = useState('');
  const [Loading, setLoading] = useState(false);
  const [LoadingMore, setLoadingMore] = useState(false);
  const [Data, setData] = useState({data: {results: []}});
  const [hasMore, setHasMore] = useState(true);
  const [searchHistory, setSearchHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [consecutiveDuplicatePages, setConsecutiveDuplicatePages] = useState(0);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const searchBarRef = useRef(null);

  const limit = 100;

  // Fetch suggestions with robust visibility logic
  useEffect(() => {
    const trimmedQuery = query.trim();

    // If query is too short or we've already submitted a search, hide suggestions
    if (trimmedQuery.length === 0 || SearchText) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    // 1. Instant local matching (Zero Lag) - Keeps UI populated while waiting for API
    const historyMatches = searchHistory
      .filter(
        h =>
          h.toLowerCase().includes(trimmedQuery.toLowerCase()) &&
          h.toLowerCase() !== trimmedQuery.toLowerCase(),
      )
      .slice(0, 5);

    // Always show suggestions if we have a query, even if results are empty initially
    setShowSuggestions(true);
    setSuggestions(historyMatches);

    // 2. Debounced API fetch
    setIsSuggesting(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await getSearchSuggestions(trimmedQuery);

        // Only update if the query hasn't changed since the request started
        setSuggestions(prev => {
          const merged = [
            ...new Set([...historyMatches, ...res.suggestions]),
          ].slice(0, 50);
          return merged;
        });

      } catch (error) {
        console.error('Suggestions error:', error);
      } finally {
        setIsSuggesting(false);
      }
    }, 300); // 300ms debounce for better performance

    return () => clearTimeout(timeoutId);
  }, [query, SearchText, searchHistory]);

  async function fetchSearchData(text, pageNum = 1, append = false) {
    if (text !== '') {
      try {
        if (!append) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        // Check cache first (only for first page)
        const cacheKey = getSearchCacheKey(text, engine, ActiveTab, pageNum);
        if (!append && searchCache.has(cacheKey)) {
          const cached = searchCache.get(cacheKey);
          if (Date.now() - cached.timestamp < SEARCH_CACHE_DURATION) {
            setData(cached.data);
            setHasMore(cached.hasMore);
            setLoading(false);
            return;
          }
        }

        let data;
        if (engine === 0) {
          // Saavn
          if (ActiveTab === 0) {
            data = await getSearchSongData(text, pageNum, limit);
          } else if (ActiveTab === 1) {
            data = await getSearchAlbumData(text, pageNum, limit);
          } else if (ActiveTab === 2) {
            data = await getSearchPlaylistData(text, pageNum, limit);
          }
        } else if (engine === 1) {
          // YT Music
          if (ActiveTab === 0) {
            data = await getYTSearchSongData(text, pageNum, limit);
          } else if (ActiveTab === 1) {
            data = await getYTSearchAlbumData(text, pageNum, limit);
          } else if (ActiveTab === 2) {
            data = await getYTSearchPlaylistData(text, pageNum, limit);
          }
        } else {
          // Youtube
          data = await getYTSearchVideoData(text, pageNum, limit);
        }

        if (data && data.data && Array.isArray(data.data.results)) {
          if (data.data.results.length === 0) {
            if (!append) {
              setData({data: {results: []}});
            }
            setHasMore(false);
          } else if (append) {
            const existingIds = new Set(
              (Data?.data?.results || []).map(item => item.id),
            );
            const newUniqueResults = data.data.results.filter(
              item => !existingIds.has(item.id),
            );

            setData(prev => ({
              ...prev,
              data: {
                results: [...(prev?.data?.results || []), ...newUniqueResults],
              },
            }));

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
            setData(data);
            const hasMoreResults = engine !== 1 && data.data.results.length > 0;
            setHasMore(hasMoreResults);

            // Cache first page results
            searchCache.set(cacheKey, {
              data: data,
              hasMore: hasMoreResults,
              timestamp: Date.now(),
            });

            // Limit cache size
            if (searchCache.size > 50) {
              const firstKey = searchCache.keys().next().value;
              searchCache.delete(firstKey);
            }
          }
        } else {
          if (!append) {
            setData({data: {results: []}});
          }
          setHasMore(false);
        }
      } catch (e) {
        if (!append) {
          setData({data: {results: []}});
        }
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    } else {
      setData({data: {results: []}});
      setLoading(false);
    }
  }

  const loadMore = () => {
    if (!LoadingMore && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchSearchData(SearchText, nextPage, true);
    }
  };

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (SearchText) {
      // Show loading immediately and clear data to show fresh results for the new engine/tab
      setLoading(true);
      setData({data: {results: []}});
      setHasMore(false);
      setCurrentPage(1);
      setConsecutiveDuplicatePages(0);

      // Debounce search to avoid rapid API calls
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        fetchSearchData(SearchText, 1, false);
      }, 200);
    } else {
      // Ensure loading state and related flags are cleared when search text is empty
      setLoading(false);
      setLoadingMore(false);
      setData({data: {results: []}});
      setHasMore(false);
      setCurrentPage(1);
      setConsecutiveDuplicatePages(0);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SearchText, ActiveTab, engine]);

  useEffect(() => {
    GetSearchHistory().then(history => {
      setSearchHistory(history || []);
    });
  }, []);

  const handleSearchSubmit = useCallback(searchQuery => {
    if (!searchQuery.trim()) {
      return;
    }
    setSearchText(searchQuery);
    setQuery(searchQuery);
    setShowSuggestions(false);
    Keyboard.dismiss();
    AddSearchHistory(searchQuery.trim()).then(history => {
      if (history) {
        setSearchHistory(history);
      }
    });
  }, []);

  const handleSuggestionPress = useCallback(
    (suggestion, fillOnly = false) => {
      setQuery(suggestion);
      searchBarRef.current?.setText(suggestion);
      if (!fillOnly) {
        handleSearchSubmit(suggestion);
      }
    },
    [handleSearchSubmit],
  );

  const handleSelectHistory = historyQuery => {
    setQuery(historyQuery);
    searchBarRef.current?.setText(historyQuery);
    handleSearchSubmit(historyQuery);
  };

  const handleRemoveHistory = async historyQuery => {
    const newHistory = await RemoveSearchHistoryItem(historyQuery);
    setSearchHistory(newHistory || []);
  };

  const handleClearHistory = async () => {
    const newHistory = await ClearSearchHistory();
    setSearchHistory(newHistory || []);
  };



  const handleQueryChange = useCallback(
    text => {
      setQuery(text);
      if (SearchText && text !== SearchText) {
        setSearchText('');
      }
    },
    [SearchText],
  );

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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingHorizontal: 10,
          }}>
          <ContentTypeToggle
            activeTab={ActiveTab}
            setActiveTab={setActiveTab}
          />
          <View style={{marginLeft: 15}}>
            <Tabs
              tabs={['Saavn', 'YT Music', 'Youtube']}
              setState={setEngine}
              state={engine}
            />
          </View>
        </View>
      ) : null}

      <Spacer height={5} />

      {SearchText && Loading && (
        <>
          {ActiveTab === 0 && <ShimmerSearchResults itemCount={8} />}
          {ActiveTab === 1 && <ShimmerSearchAlbums itemCount={6} />}
          {ActiveTab === 2 && <ShimmerSearchPlaylists itemCount={6} />}
        </>
      )}

      {!Loading && (
        <View style={{flex: 1}}>
          {SearchText ? (
            <View style={{paddingHorizontal: 10, flex: 1}}>
              {engine === 0 ? (
                <>
                  {ActiveTab === 0 && (
                    <SongDisplay
                      source={'saavn'}
                      data={Data}
                      limit={limit}
                      Searchtext={SearchText}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      loadingMore={LoadingMore}
                    />
                  )}
                  {ActiveTab === 1 && (
                    <AlbumsDisplay
                      data={Data}
                      limit={limit}
                      Searchtext={SearchText}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      loadingMore={LoadingMore}
                    />
                  )}
                  {ActiveTab === 2 && (
                    <PlaylistDisplay
                      data={Data}
                      limit={limit}
                      Searchtext={SearchText}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      loadingMore={LoadingMore}
                    />
                  )}
                </>
              ) : engine === 1 ? (
                <>
                  {ActiveTab === 0 && (
                    <SongDisplay
                      source={'ytmusic'}
                      data={Data}
                      limit={limit}
                      Searchtext={SearchText}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      loadingMore={LoadingMore}
                    />
                  )}
                  {ActiveTab === 1 && (
                    <AlbumsDisplay
                      data={Data}
                      limit={limit}
                      Searchtext={SearchText}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      loadingMore={LoadingMore}
                    />
                  )}
                  {ActiveTab === 2 && (
                    <PlaylistDisplay
                      data={Data}
                      limit={limit}
                      Searchtext={SearchText}
                      loadMore={loadMore}
                      hasMore={hasMore}
                      loadingMore={LoadingMore}
                    />
                  )}
                </>
              ) : (
                <SongDisplay
                  source={'youtube'}
                  data={Data}
                  limit={limit}
                  Searchtext={SearchText}
                  loadMore={loadMore}
                  hasMore={hasMore}
                  loadingMore={LoadingMore}
                />
              )}
            </View>
          ) : (
            <>
              {showSuggestions ? (
                <SearchSuggestions
                  suggestions={suggestions}
                  onSuggestionPress={handleSuggestionPress}
                  isLoading={isSuggesting}
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
