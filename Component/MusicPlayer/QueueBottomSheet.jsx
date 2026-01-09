import React, {useRef, useState, useEffect, useCallback} from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import {QueueRenderSongs} from './QueueRenderSongs';
import {PlainText} from '../Global/PlainText';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Module-level ref for close function (kept for external access if needed)
const _queueCloseRef = {current: () => {}};

// Separated Handle component to avoid unstable nested component warning
const LocalQueueHandle = ({index, handleClose}) => {
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
        {index >= 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClose}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityLabel="Close queue"
            accessibilityRole="button"
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

  // keep module ref for close in sync for external use (if any)
  useEffect(() => {
    _queueCloseRef.current = handleClose;
  }, [handleClose]);

  // Stable handle component renderer
  const renderHandle = useCallback(
    () => <LocalQueueHandle index={index} handleClose={handleClose} />,
    [index, handleClose]
  );

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
      handleComponent={renderHandle}
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
