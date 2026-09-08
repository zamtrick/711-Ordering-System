import { useCart } from "@/context/CartContext";
import { ShoppingCart } from "lucide-react-native";
import { View, Text, useColorScheme, type ColorValue } from "react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";

export default function CartTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;
  const { totalCount } = useCart();

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <ShoppingCart color={color} size={size} />
      {totalCount > 0 && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: "#DA291C",
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={styles.badgeText}>
            {totalCount > 99 ? "99+" : totalCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = {
  badge: {
    position: "absolute" as const,
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 18,
  },
} as const;
