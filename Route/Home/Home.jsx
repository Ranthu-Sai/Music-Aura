import { MainWrapper } from "../../Layout/MainWrapper";
import { ScrollView, View, RefreshControl } from "react-native";
import { Heading } from "../../Component/Global/Heading";
import { HorizontalScrollSongs } from "../../Component/Global/HorizontalScrollSongs";
import { RouteHeading } from "../../Component/Home/RouteHeading";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { EachAlbumCard } from "../../Component/Global/EachAlbumCard";
import { RenderTopCharts } from "../../Component/Home/RenderTopCharts";
import { LoadingComponent } from "../../Component/Global/Loading";
import { useEffect, useState } from "react";
import { getHomePageData } from "../../Api/HomePage";
import { getAllPlaylists } from "../../Api/Playlist";
import { EachPlaylistCard } from "../../Component/Global/EachPlaylistCard";
import { Spacer } from "../../Component/Global/Spacer";
import { EachTrendingSongCard } from "../../Component/Global/EachTrendingSongCard";
import { GetLanguageValue } from "../../LocalStorage/Languages";
import { TopHeader } from "../../Component/Home/TopHeader";
import { DisplayTopGenres } from "../../Component/Home/DisplayTopGenres";
export const Home = () => {
  const [Loading, setLoading] = useState(true);
  const [Data, setData] = useState({});
  const [showHeader, setShowHeader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allPlaylists, setAllPlaylists] = useState([]);

  const albumData = []
  for (let i = 0; i < (Data?.data?.albums ?? []).length; i = i + 2){
    if (i === (Data?.data?.albums ?? []).length - 1 && (Data?.data?.albums ?? []).length % 2 !== 0){
      albumData.push([Data?.data?.albums[i]])
    }
    else {
      albumData.push([Data?.data?.albums[i],Data?.data?.albums[i + 1]])
    }
  }

  const allPlaylistsData = []
  for (let i = 0; i < allPlaylists.length; i = i + 8){
    allPlaylistsData.push(allPlaylists.slice(i, i + 8))
  }

  async function fetchHomePageData(silent = false){
    try {
      if (!silent) {
        setLoading(true)
      }
      const Languages = await GetLanguageValue()
      const data = await getHomePageData(Languages)
      const playlists = await getAllPlaylists(Languages)
      setData(data)
      setAllPlaylists(playlists?.data?.results || [])
    } catch (e) {
      // Error fetching home page data
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomePageData();
    setRefreshing(false);
  };
  useEffect(() => {
    fetchHomePageData()
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchHomePageData(true); // silent refresh
    }, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, []);
  return (
    <MainWrapper>
      <LoadingComponent loading={Loading}/>
      {
        !Loading &&  <View>
          <ScrollView style={{zIndex:-1}} onScroll={(e)=>{
            if (e.nativeEvent.contentOffset.y > 200 && !showHeader){
              setShowHeader(true)
            } else if (e.nativeEvent.contentOffset.y < 200 && showHeader) {
              setShowHeader(false)
            }
          }} showsVerticalScrollIndicator={false} contentContainerStyle={{
            paddingBottom:90,
          }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <RouteHeading showSearch={false} showSettings={true}/>
             {/*<DisplayTopSection playlist={Data.data.charts.filter((e)=>e.type === 'playlist')}/>*/}
            <DisplayTopGenres/>
            <PaddingConatiner>
              <Heading text={"Trending Songs"}/>
            </PaddingConatiner>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
              paddingLeft:10,
              gap:10,
            }}>
              {(Data?.data?.trending?.songs ?? []).map((item, index) => <EachTrendingSongCard key={item?.id?.toString() ?? `trending-song-${index}`} image={item.image[2].url || item.image[2].link} name={item.name} artists={item.artists} id={item.id} url={item.downloadUrl} duration={item.duration} language={item.language} artistID={item.primary_artists_id}/> )}
            </ScrollView>
            <Spacer/>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[0]?.id}/>
              <Heading text={"Recommended"}/>
            </PaddingConatiner>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
              paddingLeft:10,
              gap:10,
            }}>
              {(Data?.data?.playlists ?? []).map((item, index) => <EachPlaylistCard key={item?.id?.toString() ?? `playlist-${index}`} name={item.title} follower={item.subtitle} image={item.image[2]?.url || item.image[2]?.link || item.image[0]?.url} id={item.id}/> )}
            </ScrollView>
            <PaddingConatiner>
              <Heading text={"Trending Albums"}/>
            </PaddingConatiner>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
              paddingLeft:10,
              gap:10,
            }}>
              {(Data?.data?.trending?.albums ?? []).map((item, index) => <EachAlbumCard key={item?.id?.toString() ?? `trending-album-${index}`} image={item.image[2].url || item.image[2].link} artists={item.artists} name={item.name} id={item.id}/> )}
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[1]?.id}/>
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Top Charts"}/>
            </PaddingConatiner>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
              paddingLeft:10,
            }} >
              <RenderTopCharts playlist={Data?.data?.charts || []}/>
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[3]?.id}/>
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Recommended Albums"}/>
            </PaddingConatiner>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
              paddingLeft:10,
              gap:10,
            }}>
              {albumData.map((e,i)=> <View key={`album-row-${i}`} style={{
                gap:15,
              }}>
                {e.map((item,index) => <View key={item?.id ?? `album-col-${i}-${index}`} style={{
                  // marginRight:15,
                }}>
                  <EachAlbumCard image={item?.image[2]?.url || item?.image[2]?.link || ""} artists={item.artists} name={item.name} id={item.id} isSong={true}/>
                </View>)}
              </View>)}
            </ScrollView>
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts?.[2]?.id}/>
            </PaddingConatiner>
          </ScrollView>
          <TopHeader showHeader={showHeader}/>
        </View>
      }
    </MainWrapper>
  );
};

