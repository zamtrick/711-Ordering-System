import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import useTheme from "@/hooks/useTheme";

// --------------------------------------------------
// Single skeleton bone — pulses between two opacities
// --------------------------------------------------
export function SkeletonBone({
  width,
  height = 14,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { theme, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius,
          backgroundColor: isDark ? "#2E2E2E" : "#E5E5E5",
          opacity,
        },
        style,
      ]}
    />
  );
}

// --------------------------------------------------
// Product card skeleton — mirrors the real product card
// --------------------------------------------------
export function ProductCardSkeleton() {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SkeletonBone height={130} borderRadius={12} style={{ marginBottom: 10 }} />
      <SkeletonBone width="70%" height={13} style={{ marginBottom: 6 }} />
      <SkeletonBone width="40%" height={11} style={{ marginBottom: 10 }} />
      <View style={cardStyles.row}>
        <SkeletonBone width={60} height={20} borderRadius={10} />
        <SkeletonBone width={36} height={36} borderRadius={12} />
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    width: "48%",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

// --------------------------------------------------
// Order card skeleton
// --------------------------------------------------
export function OrderCardSkeleton() {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={[orderStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={orderStyles.row}>
        <SkeletonBone width={100} height={14} />
        <SkeletonBone width={70} height={24} borderRadius={12} />
      </View>
      <SkeletonBone width="50%" height={11} style={{ marginTop: 6, marginBottom: 14 }} />
      <SkeletonBone height={1} borderRadius={0} style={{ marginBottom: 14 }} />
      <SkeletonBone width="80%" height={12} style={{ marginBottom: 6 }} />
      <SkeletonBone width="60%" height={12} style={{ marginBottom: 14 }} />
      <View style={orderStyles.row}>
        <SkeletonBone width={100} height={20} />
        <SkeletonBone width={80} height={36} borderRadius={10} />
      </View>
    </View>
  );
}

const orderStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

// --------------------------------------------------
// Category chip skeleton row
// --------------------------------------------------
export function CategoryRowSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingBottom: 16 }}>
      {[80, 90, 70, 95, 75].map((w, i) => (
        <SkeletonBone key={i} width={w} height={36} borderRadius={18} />
      ))}
    </View>
  );
}

// --------------------------------------------------
// Profile skeleton
// --------------------------------------------------
export function ProfileSkeleton() {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={{ padding: 20 }}>
      {/* Profile card */}
      <View style={[profileStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SkeletonBone width={70} height={70} borderRadius={22} style={{ marginBottom: 0 }} />
        <View style={{ flex: 1, marginLeft: 14, gap: 8 }}>
          <SkeletonBone width="60%" height={16} />
          <SkeletonBone width="80%" height={12} />
          <SkeletonBone width={70} height={22} borderRadius={10} />
        </View>
      </View>
      {/* Info card */}
      <SkeletonBone width={120} height={18} style={{ marginBottom: 12, marginTop: 24 }} />
      <View style={[profileStyles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i}>
            <View style={profileStyles.infoRow}>
              <SkeletonBone width={40} height={40} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                <SkeletonBone width="30%" height={10} />
                <SkeletonBone width="60%" height={13} />
              </View>
            </View>
            {i < 4 && <SkeletonBone height={1} borderRadius={0} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const profileStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
});

// --------------------------------------------------
// Home screen skeleton — promo banner + category row + product grid
// --------------------------------------------------
export function HomeScreenSkeleton() {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={{ padding: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <View style={{ gap: 8 }}>
          <SkeletonBone width={100} height={13} />
          <SkeletonBone width={200} height={22} />
        </View>
        <SkeletonBone width={46} height={46} borderRadius={14} />
      </View>
      {/* Search bar */}
      <SkeletonBone height={48} borderRadius={16} style={{ marginBottom: 22 }} />
      {/* Promo banner */}
      <SkeletonBone height={160} borderRadius={18} style={{ marginBottom: 24 }} />
      {/* Section title */}
      <SkeletonBone width={130} height={18} style={{ marginBottom: 14 }} />
      {/* Category chips */}
      <CategoryRowSkeleton />
      {/* Product grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {[1, 2, 3, 4].map((i) => <ProductCardSkeleton key={i} />)}
      </View>
    </View>
  );
}
