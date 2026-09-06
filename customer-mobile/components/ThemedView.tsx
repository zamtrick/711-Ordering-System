import { View, ViewStyle } from "react-native";
import { useColorScheme } from "react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

type ThemedViewProps = React.ComponentProps<typeof View> & {
  style?: ViewStyle | (ViewStyle | undefined | null | false)[];
};

const ThemedView = ({ style, ...props }: ThemedViewProps) => {
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
