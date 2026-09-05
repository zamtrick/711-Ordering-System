import { ViewStyle } from "react-native";
import { useColorScheme } from "react-native";
import { LightTheme, DarkTheme } from "@/constants/Theme";
import { SafeAreaView } from "react-native-safe-area-context";

interface ThemedViewProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  [key: string]: any;
}

const ThemedView = ({ children, style, ...props }: ThemedViewProps) => {
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
    >
      {children}
    </SafeAreaView>
  );
};

export default ThemedView;
