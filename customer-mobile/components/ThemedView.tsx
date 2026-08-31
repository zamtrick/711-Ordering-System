import { View } from "react-native";
import { useColorScheme } from "react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

const ThemedView = ({ style, ...props }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  return (
    <SafeAreaView
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        style,
      ]}
      {...props}
    />
  );
};

export default ThemedView;
