import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import useTheme from "@/hooks/useTheme";
import { useFavorites } from "@/context/FavoriteContext";

// --------------------------------------------------
// FAVORITE HEART BUTTON (shared)
// --------------------------------------------------
// Theme-aware favorite toggle for product-card images.
// - Chip follows the theme surface: white card chip in light mode,
//   dark surface chip in dark mode, with a subtle border.
// - Idle heart uses the theme headline color (visible on both themes).
// - Active heart uses the theme primary green (7-Eleven green / teal in dark).
// --------------------------------------------------

type FavoriteHeartButtonProps = {
  product: {
    _id: string;
    name: string;
    price: number;
    image?: string;
    stock?: number;
    categoryId?: { _id: string; name: string } | string | null;
  };
  size?: number;
  /** Which corner of the parent image container the chip anchors to. */
  placement?: "top-left" | "top-right";
};

function FavoriteHeartButton({ product, size = 18, placement = "top-left" }: FavoriteHeartButtonProps) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const { isFavorite, toggleFavorite } = useFavorites();

  const active = isFavorite(product._id);

  return (
    <Pressable
      onPress={() => toggleFavorite(product)}
      style={[
        styles.heartButton,
        placement === "top-right" ? styles.heartButtonRight : null,
        {
          backgroundColor: active ? colors.surface : isDark ? "rgba(18,18,18,0.55)" : "rgba(255,255,254,0.85)",
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      hitSlop={8}
    >
      <Heart
        size={size}
        color={active ? colors.primary : colors.headline}
        fill={active ? colors.primary : "transparent"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heartButton: {
    position: "absolute" as const,
    left: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
  },
  heartButtonRight: {
    left: undefined,
    right: 8,
  },
});

export default memo(FavoriteHeartButton);
