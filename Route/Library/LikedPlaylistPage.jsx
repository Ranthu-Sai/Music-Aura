import Animated, {useAnimatedRef} from 'react-native-reanimated';
import {LikedPagesTopHeader} from '../../Component/Library/TopHeaderLikedPages';
import {LikedDetails} from '../../Component/Library/LikedDetails';
import {useEffect, useState} from 'react';
import {GetLikedPlaylist} from '../../LocalStorage/StoreLikedPlaylists';
import {EachPlaylistCard} from '../../Component/Global/EachPlaylistCard';
import {View} from 'react-native';

import {PaddingConatiner} from '../../Layout/PaddingConatiner';

export const LikedPlaylistPage = () => {

  const AnimatedRef = useAnimatedRef();
  const [LikedPlaylist, setLikedPlaylist] = useState([]);
  async function getAllLikedSongs() {
    const Playlists = await GetLikedPlaylist();
    const Temp = [];
    for (const [, value] of Object.entries(Playlists.playlist)) {
      Temp[value.count] = value;
    }
    setLikedPlaylist(Temp);
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
        paddingBottom: 65,
        backgroundColor: 'transparent',
      }}>
      <LikedPagesTopHeader
        AnimatedRef={AnimatedRef}
        generated={{
          icon: 'playlist',
          title: 'Liked Playlists',
          colors: ['#4776E6', '#8E54E9'],
          bgColors: ['#2C2C54', '#24243e'],
        }}
        hideOverlay={true}
        disableCollapse={true}
        extendBgToTop={true}
      />
      <LikedDetails name={'Liked Playlists'} dontShowPlayButton={true} />
      <PaddingConatiner>
        <View
          style={{
            backgroundColor: 'transparent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}>
          {LikedPlaylist.map((e, i) => {
            if (e) {
              return (
                <EachPlaylistCard
                  name={e.name}
                  image={e.image}
                  id={e.id}
                  follower={e.follower}
                  MainContainerStyle={{
                    width: '48%',
                  }}
                />
              );
            }
          })}
          <View />
        </View>
      </PaddingConatiner>
    </Animated.ScrollView>
  );
};
