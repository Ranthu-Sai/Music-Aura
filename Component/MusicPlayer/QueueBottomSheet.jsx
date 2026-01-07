import React, {useRef, useState, useEffect} from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import {QueueRenderSongs} from './QueueRenderSongs';
import {PlainText} from '../Global/PlainText';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Module-level refs used by the hoisted handle component
const _queueIndexRef = {current: -1};
const _queueCloseRef = {current: () => {}};

const QueueHandleComponent = () => {
  const idx = _queueIndexRef.current;
  const handleClose = _queueCloseRef.current;
  return (
    <View style={styles.headerContainer}>
      <View style={styles.handleBar} />
      <View style={styles.titleRow}>
        <Icon
          name="playlist-music"
          size={24}
          color="white"
          style={{marginRight: 8}}
        />
        <PlainText
          text={'Next in Queue'}
          style={{fontWeight: 'bold', fontSize: 18}}
        />
        {idx >= 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClose}
            style={styles.closeButton}>
            <AntDesign
              name="closecircle"
              size={32}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const QueueBottomSheet = React.forwardRef((props, ref) => {
  const backgroundColor = 'rgba(15,15,15,0.92)';
  const bottomSheetRef = useRef(null);
  const [index, setIndex] = useState(0);

  const handleClose = React.useCallback(() => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
  }, []);

  const handleOpen = React.useCallback(() => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.expand();
    }
  }, []);

  React.useImperativeHandle(ref, () => ({
    open: handleOpen,
    close: handleClose,
  }));

  // keep module refs in sync so the hoisted handle component can read them
  useEffect(() => {
    _queueIndexRef.current = index;
  }, [index]);

  useEffect(() => {
    _queueCloseRef.current = handleClose;
  }, [handleClose]);

  return (
    <BottomSheet
      index={-1}
      onChange={idx => {
        setIndex(idx);
      }}
      enablePanDownToClose={true}
      animateOnMount={true}
      snapPoints={['70%']}
      ref={bottomSheetRef}
      handleComponent={QueueHandleComponent}
      backgroundStyle={{
        backgroundColor: backgroundColor,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }}>
      <View style={{flex: 1, backgroundColor: 'transparent'}}>
        <QueueRenderSongs />
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 5,
  },
});

export default QueueBottomSheet;
