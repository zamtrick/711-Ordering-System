import { View } from "react-native";
import { useColorScheme } from "react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";

const ThemedView = ({ style, ...props }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  return (
    <View
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
