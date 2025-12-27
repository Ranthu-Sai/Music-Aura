import { useCallback, useEffect, useState } from "react";
import { getHomePageData } from "../../Api/HomePage";
import { MainWrapper } from "../../Layout/MainWrapper";
import { LoadingComponent } from "../Global/Loading";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FlatList, ScrollView } from "react-native";
import { PaddingConatiner } from "../../Layout/PaddingConatiner";
import { Heading } from "../Global/Heading";
import { EachPlaylistCard } from "../Global/EachPlaylistCard";
import { HorizontalScrollSongs } from "../Global/HorizontalScrollSongs";
import { EachAlbumCard } from "../Global/EachAlbumCard";
import { RenderTopCharts } from "../Home/RenderTopCharts";
import { Spacer } from "../Global/Spacer";
import { View } from "react-native";

const HorizontalSeparator = () => <View style={{width:12}}/>;

export const LanguageDetailPage = ({route}) => {
  const [Loading, setLoading] = useState(true);
  const [Data, setData] = useState({});
  const {language} = route.params
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  const fetchHomePageData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getHomePageData(language)

      // Filter albums by selected language
      if (data?.data?.albums && language) {
        const languageLower = language.toLowerCase();
        data.data.albums = data.data.albums.filter(album => {
          const albumLanguage = (album?.language || '').toLowerCase();
          // Keep only albums that match the selected language
          return albumLanguage === languageLower || !albumLanguage || albumLanguage === 'unknown';
        });
      }

      // Filter trending albums by selected language
      if (data?.data?.trending?.albums && language) {
        const languageLower = language.toLowerCase();
        data.data.trending.albums = data.data.trending.albums.filter(album => {
          const albumLanguage = (album?.language || '').toLowerCase();
          // Keep only albums that match the selected language
          return albumLanguage === languageLower || !albumLanguage || albumLanguage === 'unknown';
        });
      }

      setData(data)
    } catch (e) {
        } finally {
      setLoading(false)
    }
  }, [language])
  useEffect(() => {
    fetchHomePageData()
  }, [fetchHomePageData]);
  return (
    <MainWrapper>
      <LoadingComponent loading={Loading}/>
      {
        !Loading &&  <Animated.View entering={FadeInDown.delay(200)}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{
            paddingBottom:90,
          }}>
            <Spacer/>
            <PaddingConatiner>
              <Heading nospace={true} text={capitalizeFirstLetter(language)}/>
              <Heading text={"Recommended"}/>
            </PaddingConatiner>
            <FlatList
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft:13,
                paddingRight:13,
              }}
              ItemSeparatorComponent={HorizontalSeparator}
              data={Data?.data?.playlists ?? []}
              keyExtractor={(item, index) => item?.id?.toString() ?? `playlist-${index}`}
              renderItem={(item,i)=>(
                <EachPlaylistCard name={item.item.title} follower={item.item.subtitle} image={item.item.image[2].link} id={item.item.id}/>
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data.data.charts[4].id}/>
              <Heading text={"Trending Albums"}/>
            </PaddingConatiner>
            <FlatList
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft:13,
                paddingRight:13,
              }}
              ItemSeparatorComponent={HorizontalSeparator}
              data={Data?.data?.trending?.albums ?? []}
              keyExtractor={(item,index) => item?.id?.toString() ?? `trending-album-${index}`}
              renderItem={(item)=>(
                <EachAlbumCard image={item.item.image[2].link} artists={item.item.artists} name={item.item.name} id={item.item.id}/>
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts[1]?.id}/>
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Top Charts"}/>
            </PaddingConatiner>
            <FlatList
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft:13,
                paddingRight:13,
              }}
              ItemSeparatorComponent={HorizontalSeparator}
              data={[1]}
              renderItem={()=>(
                <RenderTopCharts playlist={Data.data.charts.filter((e)=>e.type === 'playlist')}/>
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts[3]?.id}/>
            </PaddingConatiner>
            <PaddingConatiner>
              <Heading text={"Recommended Albums"}/>
            </PaddingConatiner>
            <FlatList
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft:13,
                paddingRight:13,
              }}
              ItemSeparatorComponent={HorizontalSeparator}
              data={Data?.data?.albums ?? []}
              keyExtractor={(item, index) => item?.id?.toString() ?? `album-${index}`}
              renderItem={(item)=>(
                <EachAlbumCard image={item?.item?.image[2]?.link ?? ""} artists={item.item.artists} name={item.item.name} id={item.item.id}/>
              )}
            />
            <PaddingConatiner>
              <HorizontalScrollSongs id={Data?.data?.charts[2]?.id}/>
            </PaddingConatiner>
          </ScrollView>
        </Animated.View>
      }
    </MainWrapper>
  );
};

