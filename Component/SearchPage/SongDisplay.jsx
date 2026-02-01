import React, {useState, useEffect} from 'react';
import {Dimensions, FlatList, View} from 'react-native';
import {useActiveTrack, usePlaybackState} from 'react-native-track-player';
import {EachSongCard} from '../Global/EachSongCard';
import {PlainText} from '../Global/PlainText';
import {SmallText} from '../Global/SmallText';
import {useTheme} from '@react-navigation/native';
import {ShimmerSearchResults} from '../Global/ShimmerEffect';

// Module-scoped footer to avoid defining components during render
const ListFooter = ({footerSource, footerLoadingMore, footerHasMore}) => {
  if (!(footerSource === 'saavn' || footerSource === 'youtube' || footerSource === 'ytmusic')) {
    return null;
  }
  if (footerLoadingMore) {
    return <ShimmerSearchResults itemCount={3} />;
  }
  if (footerHasMore && !footerLoadingMore) {
    return <ShimmerSearchResults itemCount={1} />;
  }
  return null;
};


export default function SongDisplay({
  data,
  source = 'saavn',
  loadMore,
  hasMore,
  loadingMore,
}) {
  const [displayData, setDisplayData] = useState(data);
  const theme = useTheme();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();

  useEffect(() => {
    // Deduplicate results to avoid duplicate key warnings
    if (data?.data?.results) {
      const seen = new Set();
      const dedupedResults = data.data.results.filter(item => {
        if (!item?.id) {return false;}
        if (seen.has(item.id)) {return false;}
        seen.add(item.id);
        return true;
      });

      setDisplayData({
        ...data,
        data: {
          ...data.data,
          results: dedupedResults,
        },
      });
    } else {
      setDisplayData(data);
    }
  }, [data, source]);

  const width = Dimensions.get('window').width;

  function FormatArtist(artists) {
    if (!artists || !Array.isArray(artists)) {
      return '';
    }
    return artists.map(e => e.name).join(', ');
  }

  // Enhanced image handling for YouTube thumbnails
  function getImageUrl(item) {
    const itemSource = item?.source || 'saavn';

    if (itemSource === 'youtube') {
      // For YouTube, try multiple fallback options
      const imageArray = item?.image;
      if (Array.isArray(imageArray) && imageArray.length > 0) {
        // Try the highest quality first, then fallbacks
        const primaryUrl =
          imageArray[2]?.url || imageArray[1]?.url || imageArray[0]?.url;
        if (primaryUrl) {
          // If it's maxresdefault, provide fallback to hqdefault
          if (primaryUrl.includes('maxresdefault.jpg')) {
            return primaryUrl.replace('maxresdefault.jpg', 'hqdefault.jpg');
          }
          return primaryUrl;
        }
      }

      // Fallback: construct YouTube thumbnail URL from video ID
      if (item?.id) {
        return `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
      }
    }

    // For other sources, use existing logic
    return (
      item?.image?.[2]?.url || item?.image?.[0]?.url || item?.artwork || ''
    );
  }

  if (!displayData?.data?.results || displayData.data.results.length === 0) {
    return (
      <View
        style={{height: 400, alignItems: 'center', justifyContent: 'center'}}>
        <PlainText
          text={'No Songs Found!'}
          style={{
            color: theme.dark ? '#CCCCCC' : '#666666',
            fontSize: 18,
            fontWeight: '600',
          }}
        />
        <SmallText
          text={'Try searching for something else. T_T'}
          style={{
            color: theme.dark ? '#999999' : '#888888',
            marginTop: 8,
          }}
        />
      </View>
    );
  }



  return (
    <View>
      <FlatList
        showsVerticalScrollIndicator={false}
        keyExtractor={(item, index) => `${item?.id}_${index}`}
        contentContainerStyle={{paddingBottom: 220}}
        data={displayData.data.results}
        onEndReached={hasMore ? loadMore : null}
        // Use slightly earlier threshold for youtube/ytmusic for smoother prefetch
        onEndReachedThreshold={
          source === 'youtube' || source === 'ytmusic' ? 0.75 : 0.5
        }
        renderItem={({item}) => {
          if (!item || !item.id) {
            return null;
          } // Render nothing if item is invalid
          return (
            <EachSongCard
              artistID={item?.primaryArtistsId || item?.primary_artists_id}
              language={item?.language}
              duration={item?.duration}
              image={getImageUrl(item)}
              id={item?.id}
              width={width * 0.95}
              title={item?.name || item?.title}
              artist={FormatArtist(item?.artists?.primary) || item?.artist}
              url={item?.downloadUrl} // This is used for Saavn downloads
              showNumber={false}
              source={item?.source || source || 'saavn'} // Preserve item's original source (dab, ytmusic, saavn)
              item={item} // Pass full item for isDabTrack and other metadata
              Data={displayData}
              index={displayData.data.results.findIndex(x => x.id === item.id)}
              activeTrackId={activeTrack?.id}
              isPlaying={
                playbackState.state === 'playing' || playbackState.state === 3
              }
            />
          );
        }}
        ListFooterComponent={<ListFooter footerSource={source} footerLoadingMore={loadingMore} footerHasMore={hasMore} />}
      />
    </View>
  );
}
