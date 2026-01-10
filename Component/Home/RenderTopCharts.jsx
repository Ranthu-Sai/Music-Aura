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
          {e.map((col, index) => {
            // Defensive extraction of image URL and title to support different API shapes
            const resolveImage = image => {
              if (!image) {return 'https://via.placeholder.com/150x150?text=No+Image';}
              if (typeof image === 'string') {return image;}
              if (Array.isArray(image)) {
                for (let k = image.length - 1; k >= 0; k--) {
                  const it = image[k];
                  if (!it) {continue;}
                  if (typeof it === 'string') {return it;}
                  if (it.url) {return it.url;}
                  if (it.link) {return it.link;}
                }
              }
              if (image.url) {return image.url;}
              if (image.link) {return image.link;}
              return 'https://via.placeholder.com/150x150?text=No+Image';
            };

            const imageUrl = resolveImage(col?.image);
            const title = col?.title || col?.name || col?.subtitle || '';

            return (
              <View
                key={col?.id ?? `col-${i}-${index}`}
                style={{
                  marginRight: 15,
                }}>
                <EachPlaylistCard
                  image={imageUrl}
                  name={title}
                  follower={col?.subtitle}
                  key={i + index}
                  id={col?.id}
                />
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
};
