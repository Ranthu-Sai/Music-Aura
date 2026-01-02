import { Dimensions, Pressable, View, StyleSheet } from "react-native";
import { PlainText } from "../Global/PlainText";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import LinearGradient from "react-native-linear-gradient";
import { useContext } from "react";
import { ThemeContext } from "../../Context/Context";

export const EachLibraryCard = ({ iconName, text, navigate, colors }) => {
  const width = Dimensions.get("window").width;
  const containerWidth = width * 0.44;
  const navigation = useNavigation();
  const { currentThemeColors } = useContext(ThemeContext);

  // Default gradient if none provided
  const backgroundColors = colors || [
    currentThemeColors.secondaryBackground || "#333",
    currentThemeColors.background || "#000"
  ];

  return (
    <Pressable
      onPress={() => {
        navigation.navigate(navigate);
      }}
      style={({ pressed }) => [
        {
          marginVertical: 10,
          height: containerWidth * 0.9,
          width: containerWidth,
          borderRadius: 15,
          overflow: "hidden",
          elevation: 5,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        }
      ]}
    >
      <LinearGradient
        colors={backgroundColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name={iconName} size={containerWidth * 0.35} color="white" />
          </View>
          <View style={styles.textContainer}>
            <PlainText
              text={text}
              style={styles.text}
            />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
  },
  iconContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: 15,
    borderRadius: 50,
    marginBottom: 10,
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  }
});
