import React, {
  useState,
  useCallback,
  useImperativeHandle,
  useContext,
} from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Text,
} from 'react-native';
import {QueueRenderSongs} from './QueueRenderSongs';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Context from '../../Context/Context';

const {height} = Dimensions.get('window');

const QueueBottomSheet = React.forwardRef((props, ref) => {
  const {Queue} = useContext(Context);
  const [internalVisible, setInternalVisible] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false);

  // Controlled or uncontrolled visibility
  const isVisible = props.visible !== undefined ? props.visible : internalVisible;

  const handleOpen = useCallback(() => {
    setInternalVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setInternalVisible(false);
    if (props.onClose) {
      props.onClose();
    }
  }, [props]);

  const handleRefresh = useCallback(() => {
    if (isRefreshingQueue) {
      return;
    }

    setIsRefreshingQueue(true);
    setRefreshSignal(prev => prev + 1);

    setTimeout(() => {
      setIsRefreshingQueue(false);
    }, 1000);
  }, [isRefreshingQueue]);

  useImperativeHandle(ref, () => ({
    open: handleOpen,
    close: handleClose,
  }));

  const queueCount = React.useMemo(() => {
    if (!Array.isArray(Queue)) {
      return 0;
    }
    const seen = new Set();
    let count = 0;
    for (const item of Queue) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        count++;
      }
    }
    return count;
  }, [Queue]);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop: tap outside to dismiss */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        {/* Bottom Sheet Container */}
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.handleBar} />
            <View style={styles.titleRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleRefresh}
                disabled={isRefreshingQueue}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                style={styles.refreshButton}>
                {isRefreshingQueue ? (
                  <ActivityIndicator size="small" color="#1DB954" />
                ) : (
                  <Icon name="refresh" size={22} color="white" />
                )}
              </TouchableOpacity>

              <View style={styles.titleGroup}>
                <Icon
                  name="playlist-music"
                  size={24}
                  color="#1DB954"
                  style={{marginRight: 6}}
                />
                <Text style={styles.titleText}>Next in Queue</Text>
                {queueCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{queueCount}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleClose}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                style={styles.closeButton}>
                <AntDesign
                  name="closecircle"
                  size={26}
                  color="rgba(255,255,255,0.65)"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Song List Content */}
          <View style={styles.contentContainer}>
            <QueueRenderSongs refreshSignal={refreshSignal} />
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    height: height * 0.74,
    backgroundColor: '#121212',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#161616',
  },
  handleBar: {
    width: 42,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.4)',
  },
  countText: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
});

export default QueueBottomSheet;
