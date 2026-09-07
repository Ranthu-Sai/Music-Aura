import React, {useCallback, useContext, useEffect} from 'react';
import {BackHandler, Modal, StyleSheet, View} from 'react-native';
import {MinimizedMusic} from './MinimizedMusic';
import {FullScreenMusic} from './FullScreenMusic';
import Context, {ActionsContext} from '../../Context/Context';
import {useActiveTrack} from 'react-native-track-player';

const BottomSheetMusic = ({color}) => {
  const {Index} = useContext(Context);
  const {setIndex} = useContext(ActionsContext);
  const activeTrack = useActiveTrack();

  const updateIndex = useCallback(
    index => {
      setIndex(index);
    },
    [setIndex],
  );

  useEffect(() => {
    const backAction = () => {
      if (Index === 1) {
        setIndex(0);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => {
      backHandler.remove();
    };
  }, [Index, setIndex]);

  if (!activeTrack) {
    return null;
  }

  return (
    <View style={styles.container}>
      <MinimizedMusic setIndex={updateIndex} color={color} />
      <Modal
        visible={Index === 1}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setIndex(0)}>
        <FullScreenMusic color={color} Index={Index} setIndex={updateIndex} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});

export default BottomSheetMusic;
