import {EachPlaylistCard} from '../Global/EachPlaylistCard';
import {View} from 'react-native';

export const RenderTopCharts = ({playlist}) => {
  const data = [];
  for (let i = 0; i < playlist.length; i = i + 2) {
    if (i === playlist.length - 1 && playlist.length % 2 !== 0) {
      data.push([playlist[i]]);
    } else {
      data.push([playlist[i], playlist[i + 1]]);
    }
  }
  return (
    <>
      {data.map((e, i) => (
        <View
          key={`row-${i}`}
          style={{
            gap: 15,
          }}>
          {}
          {e.map((col, index) => (
            <View
              key={col?.id ?? `col-${i}-${index}`}
              style={{
                marginRight: 15,
              }}>
              <EachPlaylistCard
                image={col.image[2].url || col.image[2].link}
                name={col.title}
                follower={col.subtitle}
                key={i + index}
                id={col.id}
              />
            </View>
          ))}
        </View>
      ))}
    </>
  );
};
