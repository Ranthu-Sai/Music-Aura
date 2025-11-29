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

export const SearchPage = ({navigation}) => {
  const [ActiveTab, setActiveTab] = useState(0)
  const [engine, setEngine] = useState(0) // 0: Saavn, 1: Yt Music, 2: Youtube
  const [query, setQuery] = useState("");
  // const [ApiQuery, setApiQuery] = useState("");
  const [SearchText, setSearchText] = useState("")
  const [Loading, setLoading] = useState(false)
  const [Data, setData] = useState({});
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const limit = 100
  async function fetchSearchData(text, pageNum = 1, append = false){
    if (SearchText !== ""){
      try {
        setLoading(true)
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
        if (append) {
          setData(prev => ({...prev, data: {results: [...prev.data.results, ...data.data.results]}}))
          setHasMore(data.data.results.length === limit)
        } else {
          setData(data)
          setHasMore(data.data.results.length === limit)
        }
      } catch (e) {
        if (!append) {
          setData({data: {results: []}})
        }
      } finally {
        setLoading(false)
      }
    } else {
      setData([])
    }
  }
  const loadMore = () => {
    setPage(prev => {
      const newPage = prev + 1;
      fetchSearchData(SearchText, newPage, true);
      return newPage;
    });
  };
  useEffect(() => {
    if (SearchText){
      setPage(1);
      setHasMore(false);
      fetchSearchData(SearchText,1,false)
    } else {
      setData([])
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
        setPage(1);
        setHasMore(false);
        fetchSearchData(SearchText,1,false)
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ActiveTab, engine])
  return (
    <MainWrapper>
      <Spacer/>
      <SearchBar navigation={navigation} onChange={(text)=>{
        setQuery(text)
      }}/>
      <Spacer height={15}/>
      <Tabs tabs={["Saavn","Yt Music","Youtube"]} setState={setEngine} state={engine}/>
      <Spacer height={15}/>
      {engine === 0 && <Tabs tabs={["Songs","Albums","Playlists"]} setState={setActiveTab} state={ActiveTab}/>}
      {engine === 1 && <Tabs tabs={["Songs","Albums","Playlists"]} setState={setActiveTab} state={ActiveTab}/>}
      {engine === 0 && <Spacer height={15}/>}
      {engine === 1 && <Spacer height={15}/>}
      {Loading && <LoadingComponent loading={Loading}/>}
      {!Loading && <View style={{
        paddingHorizontal:10,
      }}>
          {engine === 0 ? (
            <>
              {ActiveTab === 0 && <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore}/>}
              {ActiveTab === 1 && <AlbumsDisplay data={Data} limit={limit} Searchtext={SearchText}/>}
              {ActiveTab === 2 && <PlaylistDisplay data={Data} limit={limit} Searchtext={SearchText}/>}
            </>
          ) : engine === 1 ? (
            <>
              {ActiveTab === 0 && <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore}/>}
              {ActiveTab === 1 && <AlbumsDisplay data={Data} limit={limit} Searchtext={SearchText}/>}
              {ActiveTab === 2 && <PlaylistDisplay data={Data} limit={limit} Searchtext={SearchText}/>}
            </>
          ) : (
            <SongDisplay data={Data} limit={limit} Searchtext={SearchText} loadMore={loadMore} hasMore={hasMore}/>
          )}
      </View>}
    </MainWrapper>
  );
};
