import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useTheme from "@/hooks/useTheme";

type ThemedViewProps = React.ComponentProps<typeof View> & {
  style?: ViewStyle | (ViewStyle | undefined | null | false)[];
};

const ThemedView = ({ style, ...props }: ThemedViewProps) => {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
      {...props}
    />
  );
};

export default ThemedView;
