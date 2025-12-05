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

export const SearchPage = ({navigation}) => {
  const [ActiveTab, setActiveTab] = useState(0)
  const [engine, setEngine] = useState(0) // 0: Saavn, 1: Yt Music, 2: Youtube
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [SearchText, setSearchText] = useState("")
  const [Loading, setLoading] = useState(false)
  const [LoadingMore, setLoadingMore] = useState(false)
  const [Data, setData] = useState({data: {results: []}});
  const [hasMore, setHasMore] = useState(true)
  const [searchHistory, setSearchHistory] = useState([]);
  const limit = 50
  async function fetchSearchData(text, pageNum = 1, append = false){
    if (SearchText !== ""){
      try {
        if (!append) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }
        let data
        if (engine === 0){ // Saavn
          if (ActiveTab === 0){
            data = await getSearchSongData(text,pageNum,limit)
          } else if (ActiveTab === 1){
            data = await getSearchAlbumData(text,pageNum,limit)
          }
          else if (ActiveTab === 2){
            data = await getSearchPlaylistData(text,pageNum,limit)
          }
        } else if (engine === 1) {
          // Yt Music
          if (ActiveTab === 0){
            data = await getYTSearchSongData(text,pageNum,limit)
          } else if (ActiveTab === 1){
            data = await getYTSearchAlbumData(text,pageNum,limit)
          } else if (ActiveTab === 2){
            data = await getYTSearchPlaylistData(text,pageNum,limit)
          }
        } else {
          // Youtube
          data = await getYTSearchVideoData(text,pageNum,limit)
        }
        
        // Check if data is valid
        if (data && data.data && Array.isArray(data.data.results)) {
          if (append) {
            setData(prev => ({
              ...prev,
              data: {
                results: [...(prev?.data?.results || []), ...data.data.results],
              },
            }))
            // Continue loading if we got results
            setHasMore(data.data.results.length > 0)
          } else {
            setData(data)
            // Start with hasMore true if we got any results
            setHasMore(data.data.results.length > 0)
          }
        } else {
          // No valid data returned
          if (!append) {
            setData({data: {results: []}})
          }
          setHasMore(false)
        }
      } catch (e) {
        if (!append) {
          setData({data: {results: []}})
        }
        setHasMore(false)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    } else {
      setData({data: {results: []}})
      setLoading(false)
    }
  }
  const loadMore = () => {
    if (!LoadingMore && hasMore) {
      const currentLength = Data?.data?.results?.length || 0;
      const newPage = Math.floor(currentLength / limit) + 1;
      fetchSearchData(SearchText, newPage, true);
    }
  };
  useEffect(() => {
    if (SearchText){
      setHasMore(false);
      fetchSearchData(SearchText,1,false)
    } else {
      setData({data: {results: []}})
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SearchText]);
  useEffect(() => {
    const timeoutId = setTimeout(()=>setSearchText(query), 350)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [query]);
  useEffect(()=>{
      if (SearchText) {
        setHasMore(false);
        fetchSearchData(SearchText,1,false)
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ActiveTab, engine])
  
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
      <Spacer/>
      <SearchBar
        navigation={navigation}
        value={query}
        onChange={(text)=>{
          setQuery(text)
        }}
        onSubmit={handleSearchSubmit}
      />
      <Spacer height={10}/>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingHorizontal: 10,
      }}>
        <ContentTypeToggle activeTab={ActiveTab} setActiveTab={setActiveTab} />
        <View style={{marginLeft: 15}}>
          <Tabs tabs={["Saavn","Yt Music","Youtube"]} setState={setEngine} state={engine}/>
        </View>
      </View>
      <Spacer height={10}/>
      {Loading && <LoadingComponent loading={Loading}/>}
      {!Loading && !SearchText && (
        <SearchHistoryDisplay
          history={searchHistory}
          onSelectQuery={handleSelectHistory}
          onRemoveQuery={handleRemoveHistory}
          onClearHistory={handleClearHistory}
        />
      )}
      {!Loading && SearchText && <View style={{
        paddingHorizontal:10,
      }}>
          {engine === 0 ? (
            <>
              {ActiveTab === 0 && <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>}
              {ActiveTab === 1 && <AlbumsDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>}
              {ActiveTab === 2 && <PlaylistDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>}
            </>
          ) : engine === 1 ? (
            <>
              {ActiveTab === 0 && <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>}
              {ActiveTab === 1 && <AlbumsDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>}
              {ActiveTab === 2 && <PlaylistDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>}
            </>
          ) : (
            <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore} loadingMore={LoadingMore}/>
          )}
      </View>}
    </MainWrapper>
  );
};
