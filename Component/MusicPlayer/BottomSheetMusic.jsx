import React, {useCallback, useContext, useEffect, useRef} from 'react';
import {BackHandler, StyleSheet} from 'react-native';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {MinimizedMusic} from './MinimizedMusic';
import {FullScreenMusic} from './FullScreenMusic';
import Context, {ActionsContext} from '../../Context/Context';
import {useActiveTrack} from 'react-native-track-player';

const BottomSheetMusic = ({color}) => {
  const bottomSheetRef = useRef(null);
  const {Index} = useContext(Context);
  const {setIndex} = useContext(ActionsContext);
  const activeTrack = useActiveTrack();

  useEffect(() => {
    if (activeTrack && Index === -1) {
      setIndex(0);
    }
  }, [activeTrack, Index, setIndex]);
  useEffect(() => {
    const backAction = () => {
      setIndex(0);
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    if (Index === 0) {
      backHandler.remove();
    }
    return () => {
      backHandler.remove();
    };
  }, [Index, setIndex]);

  const handleSheetChanges = useCallback(
    index => {
      if (index < 0) {
        setIndex(0);
      } else if (index <= 1) {
        // Ensure index doesn't exceed snapPoints length
        setIndex(index);
      }
    },
    [setIndex],
  );
  const updateIndex = useCallback(
    index => {
      setIndex(index);
    },
    [setIndex],
  );
  return (
    <BottomSheet
      enableContentPanningGesture={false}
      detached={false}
      enableOverDrag={false}
      handleIndicatorStyle={{
        height: 0,
        width: 0,
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0)',
      }}
      backgroundStyle={{
        backgroundColor: Index === 1 ? color : 'transparent',
      }}
      // handleComponent={props => <MinimizedMusic  setIndex={updateIndex} color={color}/>}
      handleHeight={5}
      handleStyle={{
        position: 'absolute',
      }}
      snapPoints={[155, '100%']}
      ref={bottomSheetRef}
      index={Index}
      onChange={handleSheetChanges}>
      <BottomSheetView
        style={{
          ...styles.contentContainer,
        }}>
        {Index !== 1 && <MinimizedMusic setIndex={updateIndex} />}
        {Index === 1 && (
          <FullScreenMusic color={color} Index={Index} setIndex={updateIndex} />
        )}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(21,21,21)',
  },
  contentContainer: {
    flex: 1,
  },
});

export default BottomSheetMusic;
