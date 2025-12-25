import { MainWrapper } from "../Layout/MainWrapper";
import { SearchBar } from "../Component/Global/SearchBar";
import Tabs from "../Component/Global/Tabs/Tabs";
import { useEffect, useState } from "react";
import { getSearchSongData, getYTSearchSongData, getYTSearchVideoData, getYTSearchAlbumData, getYTSearchPlaylistData } from "../Api/Songs";
import { View } from "react-native";
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

export const SearchPage = ({ navigation }) => {
  const [ActiveTab, setActiveTab] = useState(0)
  const [engine, setEngine] = useState(0) // 0: Saavn, 1: YT Music, 2: Youtube
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [SearchText, setSearchText] = useState("")
  const [Loading, setLoading] = useState(false)
  const [LoadingMore, setLoadingMore] = useState(false)
  const [Data, setData] = useState({ data: { results: [] } });
  const [hasMore, setHasMore] = useState(true)
  const [searchHistory, setSearchHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1); // Track current page
  const [consecutiveDuplicatePages, setConsecutiveDuplicatePages] = useState(0); // Track pages with no unique results
  const limit = 100
  async function fetchSearchData(text, pageNum = 1, append = false) {
    if (SearchText !== "") {
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

        // Check if data is valid
        if (data && data.data && Array.isArray(data.data.results)) {
          // Check if results are empty - stop loading immediately for YT Music and YouTube
          if (data.data.results.length === 0) {
            if (!append) {
              setData({ data: { results: [] } })
            }
            setHasMore(false)
          } else if (append) {
            // Filter out duplicates based on song ID
            const existingIds = new Set((Data?.data?.results || []).map(item => item.id));
            const newUniqueResults = data.data.results.filter(item => !existingIds.has(item.id));

            setData(prev => ({
              ...prev,
              data: {
                results: [...(prev?.data?.results || []), ...newUniqueResults],
              },
            }))

            // Track consecutive pages with no unique results
            if (newUniqueResults.length === 0) {
              const newCount = consecutiveDuplicatePages + 1;
              setConsecutiveDuplicatePages(newCount);

              // Stop loading after 10 consecutive pages with no unique results
              if (newCount >= 10) {
                setHasMore(false);
              } else {
                setHasMore(data.data.results.length > 0);
              }
            } else {
              // Reset counter when we find unique results
              setConsecutiveDuplicatePages(0);
              setHasMore(data.data.results.length > 0);
            }
          } else {
            setData(data)
            // Disable pagination for YT Music (engine 1) as it doesn't support it
            // Keep pagination enabled for Saavn (0) and YouTube (2)
            setHasMore(engine !== 1 && data.data.results.length > 0)
          }
        } else {
          // No valid data returned
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
      setHasMore(false);
      setCurrentPage(1); // Reset to page 1 for new search
      setConsecutiveDuplicatePages(0); // Reset duplicate counter
      fetchSearchData(SearchText, 1, false)
    } else {
      setData({ data: { results: [] } })
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SearchText]);
  useEffect(() => {
    const timeoutId = setTimeout(() => setSearchText(query), 350)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [query]);
  useEffect(() => {
    if (SearchText) {
      // Clear old data immediately to prevent showing wrong engine's data
      setData({ data: { results: [] } });
      setLoading(true);
      setHasMore(false);
      setCurrentPage(1); // Reset to page 1 for new tab/engine
      setConsecutiveDuplicatePages(0); // Reset duplicate counter
      fetchSearchData(SearchText, 1, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ActiveTab, engine])

  useEffect(() => {
    GetSearchHistory().then(history => {
      setSearchHistory(history || []);
    });
  }, []);

  useEffect(() => {
    if (submittedQuery && submittedQuery.trim()) {
      AddSearchHistory(submittedQuery.trim()).then(history => {
        if (history) {
          setSearchHistory(history);
        }
      });
    }
  }, [submittedQuery]);

  const handleSearchSubmit = (searchQuery) => {
    setSubmittedQuery(searchQuery);
    setQuery(searchQuery);
  };

  const handleSelectHistory = (historyQuery) => {
    setSubmittedQuery(historyQuery);
    setQuery(historyQuery);
  };

  const handleRemoveHistory = async (historyQuery) => {
    const newHistory = await RemoveSearchHistoryItem(historyQuery);
    setSearchHistory(newHistory || []);
  };

  const handleClearHistory = async () => {
    const newHistory = await ClearSearchHistory();
    setSearchHistory(newHistory || []);
  };
  return (
    <MainWrapper>
      <Spacer height={5} />
      <SearchBar
        navigation={navigation}
        value={query}
        onChange={(text) => {
          setQuery(text)
        }}
        onSubmit={handleSearchSubmit}
      />
      <Spacer height={5} />
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
      <Spacer height={5} />
      {Loading && <LoadingComponent loading={Loading} />}
      {!Loading && !SearchText && (
        <SearchHistoryDisplay
          history={searchHistory}
          onSelectQuery={handleSelectHistory}
          onRemoveQuery={handleRemoveHistory}
          onClearHistory={handleClearHistory}
        />
      )}
      {!Loading && SearchText && <View style={{
        paddingHorizontal: 10,
      }}>
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
      </View>}
    </MainWrapper>
  );
};
