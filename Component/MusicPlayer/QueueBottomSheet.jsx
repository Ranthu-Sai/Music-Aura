import React, { useRef, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { QueueRenderSongs } from "./QueueRenderSongs";
import { PlainText } from "../Global/PlainText";
import Entypo from "react-native-vector-icons/Entypo";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Octicons from "react-native-vector-icons/Octicons";
import AntDesign from "react-native-vector-icons/AntDesign";

const QueueBottomSheet = React.forwardRef((props, ref) => {
  const backgroundColor = 'rgba(5,5,5,0.76)'
  const bottomSheetRef = useRef(null);
  const [index, setIndex] = useState(0);
  
  const handleClose = () => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.snapToIndex(0);
      setIndex(0);
    }
  };

  const handleOpen = () => {
    // Add a small delay to ensure BottomSheet is ready
    setTimeout(() => {
      if (bottomSheetRef.current) {
        bottomSheetRef.current.snapToIndex(1);
        setIndex(1);
      }
    }, 100);
  };

  // Expose methods to parent component
  React.useImperativeHandle(ref, () => ({
    open: handleOpen,
    close: handleClose,
  }));

  return (
      <BottomSheet
        index={0}
        onChange={(index)=>{
          setIndex(index)
        }}
        enablePanDownToClose={false}
        animateOnMount={false}
        snapPoints={[130, '50%']}
        ref={bottomSheetRef}
        style={{
          backgroundColor,
        }}
        handleComponent={props => {
          return <View style={styles.headerContainer}>
            <Octicons name={"dash"} size={24} color="white" />
            <View style={styles.titleRow}>
              <PlainText text={"Song Queue"}/>
              {index === 1 && (
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <AntDesign name="close" size={22} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }}
        backgroundStyle={{
          backgroundColor:"rgb(0,0,0,0)",
        }}
        handleStyle={{
          backgroundColor:backgroundColor,
        }}
      >
        <QueueRenderSongs/>
      </BottomSheet>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    height: 60,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    right: 20,
    padding: 5,
  },
});

export default QueueBottomSheet;
