import React from 'react';
import {Dimensions, FlatList, View} from 'react-native';
import {PlainText} from '../Global/PlainText';
import {SmallText} from '../Global/SmallText';
import {EachAlbumCard} from '../Global/EachAlbumCard';
import {useActiveTrack} from 'react-native-track-player';
import {ShimmerSearchAlbums} from '../Global/ShimmerEffect';

export default function AlbumsDisplay({
  data,
  limit,
  Searchtext,
  loadMore,
  hasMore,
  loadingMore,
}) {
  const songsData = data;
  const activeTrack = useActiveTrack();

  function FormatArtist(artists) {
    let artist = '';
    artists?.map((e, i) => {
      if (i === artists.length - 1) {
        artist += e.name;
      } else {
        artist += e.name + ', ';
      }
    });
    return artist;
  }
  const width = Dimensions.get('window').width;
  const itemWidth = (width - 40) / 2; // 20 padding on sides, 20 gap between
  return (
    <View>
      {songsData?.data?.results?.length !== 0 && (
        <FlatList
          showsVerticalScrollIndicator={false}
          numColumns={2}
          contentContainerStyle={{
            paddingBottom: activeTrack ? 105 : 70,
          }}
          keyExtractor={(item, index) => `${item?.id}_${index}`}
          data={songsData?.data?.results ?? []}
          renderItem={({item: album, index}) => {
            const isSaavn = album?.artists?.primary;
            const name = isSaavn ? album?.name : album?.title;
            const artists = isSaavn
              ? FormatArtist(album?.artists?.primary)
              : album?.artist;
            const image = Array.isArray(album?.image)
              ? album?.image[2]?.url ||
                album?.image[1]?.url ||
                album?.image[0]?.url ||
                ''
              : typeof album?.image === 'string'
              ? album?.image
              : '';
            return (
              <EachAlbumCard
                key={`${album?.id}_${index}`}
                Search={true}
                mainContainerStyle={{
                  width: itemWidth,
                  marginBottom: 10,
                  marginHorizontal: 5,
                }}
                image={image}
                artists={artists}
                name={name ?? ''}
                id={album?.id ?? ''}
              />
            );
          }}
          onEndReached={hasMore ? loadMore : null}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ShimmerSearchAlbums itemCount={2} /> : null
          }
        />
      )}
      {songsData?.data?.results?.length === 0 && (
        <View
          style={{
            height: 400,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <PlainText text={'No Album found!'} />
          <SmallText text={'Opps!  T_T'} />
        </View>
      )}
    </View>
  );
}
