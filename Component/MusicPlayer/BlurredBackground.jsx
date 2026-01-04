import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';

const BlurredBackground = ({ uri, blurRadius = 18, overlayColors }) => {
  const source = useMemo(() => ({
    uri: uri,
    priority: FastImage.priority.high,
    cache: FastImage.cacheControl.immutable,
  }), [uri]);

  if (!uri) {
    return <View style={{ flex: 1, backgroundColor: 'black' }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FastImage
        source={source}
        style={{ flex: 1 }}
        resizeMode={FastImage.resizeMode.cover}
        blurRadius={blurRadius}
      />
      {Array.isArray(overlayColors) && overlayColors.length > 0 && (
        <LinearGradient
          colors={overlayColors}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      )}
    </View>
  );
};

export default memo(BlurredBackground);
