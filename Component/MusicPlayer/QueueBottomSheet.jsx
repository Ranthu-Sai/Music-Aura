import React, { useRef, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { QueueRenderSongs } from "./QueueRenderSongs";
import { PlainText } from "../Global/PlainText";
import Entypo from "react-native-vector-icons/Entypo";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Octicons from "react-native-vector-icons/Octicons";
import AntDesign from "react-native-vector-icons/AntDesign";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const QueueBottomSheet = React.forwardRef((props, ref) => {
  const backgroundColor = 'rgba(15,15,15,0.92)'
  const bottomSheetRef = useRef(null);
  const [index, setIndex] = useState(0);

  const handleClose = () => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
  };

  const handleOpen = () => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.expand();
    }
  };

  React.useImperativeHandle(ref, () => ({
    open: handleOpen,
    close: handleClose,
  }));

  return (
    <BottomSheet
      index={-1}
      onChange={(idx) => {
        setIndex(idx)
      }}
      enablePanDownToClose={true}
      animateOnMount={true}
      snapPoints={['70%']}
      ref={bottomSheetRef}
      handleComponent={props => {
        return (
          <View style={styles.headerContainer}>
            <View style={styles.handleBar} />
            <View style={styles.titleRow}>
              <Icon name="playlist-music" size={24} color="white" style={{ marginRight: 8 }} />
              <PlainText text={"Next in Queue"} style={{ fontWeight: 'bold', fontSize: 18 }} />
              {index >= 0 && (
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={handleClose} 
                  style={styles.closeButton}
                >
                  <AntDesign name="closecircle" size={32} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      }}
      backgroundStyle={{
        backgroundColor: backgroundColor,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }}
    >
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <QueueRenderSongs />
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  closeButton: {
    position: "absolute",
    right: 20,
    padding: 5,
  },
});

export default QueueBottomSheet;
