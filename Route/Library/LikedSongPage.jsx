import Animated, {useAnimatedRef} from 'react-native-reanimated';
import {LikedPagesTopHeader} from '../../Component/Library/TopHeaderLikedPages';
import {LikedDetails} from '../../Component/Library/LikedDetails';
import {useEffect, useState} from 'react';
import {GetLikedSongs} from '../../LocalStorage/StoreLikedSongs';
import {EachSongCard} from '../../Component/Global/EachSongCard';
import {Dimensions, View} from 'react-native';


export const LikedSongPage = () => {
  const AnimatedRef = useAnimatedRef();
  const [LikedSongs, setLikedSongs] = useState([]);
  const width = Dimensions.get('window').width;
  async function getAllLikedSongs() {
    const Songs = await GetLikedSongs();
    const Temp = [];

    for (const [, value] of Object.entries(Songs.songs)) {
      Temp[value.count] = value;
    }
    const Final = [];
    Temp?.map(e => {
      if (e) {
        Final.push({
          url: e.url,
          title: e?.title,
          artist: e?.artist,
          artwork: e?.image,
          duration: e?.duration,
          id: e?.id,
          language: e?.language,
          artistID: e?.primary_artists_id,
        });
      }
    });
    setLikedSongs(Final);
  }
  useEffect(() => {
    getAllLikedSongs();
  }, []);
  return (
    <Animated.ScrollView
      scrollEventThrottle={16}
      ref={AnimatedRef}
      style={{backgroundColor: 'transparent'}}
      contentContainerStyle={{
        paddingBottom: 55,
        backgroundColor: 'transparent',
      }}>
      <LikedPagesTopHeader
        AnimatedRef={AnimatedRef}
        generated={{
          icon: 'heart',
          title: 'Liked Songs',
          colors: ['#FF416C', '#FF4B2B'],
          bgColors: ['#2C2C54', '#24243e'],
        }}
        hideOverlay={true}
        disableCollapse={true}
        extendBgToTop={true}
      />
      <LikedDetails name={'Liked Songs'} Data={LikedSongs}/>
      <View style={{paddingHorizontal: 10, backgroundColor: 'transparent'}}>
        {LikedSongs.map((e, i) => {
          return (
            <EachSongCard
              width={width * 0.95}
              Data={LikedSongs}
              index={i}
              url={e?.url}
              id={e?.id}
              title={e?.title}
              artist={e?.artist}
              image={e?.artwork}
              language={e?.language}
              duration={e?.duration}
              artistID={e?.artistID}
              key={i}
            />
          );
        })}
      </View>
    </Animated.ScrollView>
  );
};
