import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Heart, PackageSearch, Plus, ShoppingCart, ChevronRight } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import { useFavorites } from "@/context/FavoriteContext";
import { useCart } from "@/context/CartContext";
import { playTap } from "@/utils/sound";

// --------------------------------------------------
// FAVORITES SCREEN
// --------------------------------------------------
// Shows the customer's saved products. Hearts here (and on product cards)
// remove items; "Add" drops them straight into the cart.
// --------------------------------------------------

const Favorites = () => {
  const { theme } = useTheme();
  const { colors } = theme;
  const router = useRouter();

  const { items, loading, refresh, removeFavorite } = useFavorites();
  const { addItem } = useCart();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Re-sync with the server whenever the screen becomes visible —
  // hearts may have changed on Products/Home while we were away.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleRemove = (productId: string, name: string) => {
    Alert.alert("Remove favorite", `Remove "${name}" from your favorites?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFavorite(productId) },
    ]);
  };

  const handleAddToCart = (product: {
    _id: string;
    name: string;
    price: number;
    image?: string;
    stock: number;
    categoryId?: { _id: string; name: string };
  }) => {
    if (product.stock <= 0) return;
    addItem({
      id: product._id,
      name: product.name,
      category: product.categoryId?.name ?? "Product",
      price: product.price,
      image: product.image,
    });
    playTap();
  };

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading favorites...
        </Text>
      </ThemedView>
    );
  }

  // ── empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <View
          style={[
            styles.emptyIconWrap,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Heart size={44} color={colors.muted} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.headline }]}>
          No favorites yet
        </Text>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Tap the heart on any product to save it here.
        </Text>

        <Pressable
          style={[styles.browseButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(customer)/products")}
        >
          <Text style={styles.browseText}>Browse Products</Text>
          <ChevronRight size={18} color="#FFFFFF" />
        </Pressable>
      </ThemedView>
    );
  }

  // ── list ─────────────────────────────────────────────────────────────────
  return (
    <ThemedView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.headline }]}>
            My Favorites
          </Text>
          <Text style={[styles.countText, { color: colors.muted }]}>
            {items.length} saved {items.length === 1 ? "item" : "items"}
          </Text>
        </View>

        {items.map(({ product }) => (
          <View
            key={product._id}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.imageWrap,
                { backgroundColor: colors.background },
              ]}
            >
              {product.image ? (
                <Image
                  source={{ uri: product.image }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <PackageSearch size={32} color={colors.muted} />
              )}
            </View>

            <View style={styles.info}>
              <Text style={[styles.category, { color: colors.muted }]}>
                {product.categoryId?.name ?? "Product"}
              </Text>
              <Text
                style={[styles.name, { color: colors.headline }]}
                numberOfLines={1}
              >
                {product.name}
              </Text>
              <Text style={[styles.price, { color: colors.primary }]}>
                ₱{product.price.toFixed(2)}
              </Text>
              {product.stock <= 0 && (
                <Text style={[styles.outOfStock, { color: colors.error }]}>
                  Out of stock
                </Text>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => handleRemove(product._id, product.name)}
                style={styles.heartButton}
                hitSlop={8}
              >
                <Heart size={20} color="#DA291C" fill="#DA291C" />
              </Pressable>

              {product.stock > 0 ? (
                <Pressable
                  onPress={() => handleAddToCart(product)}
                  style={[
                    styles.addButton,
                    { backgroundColor: colors.primary },
                  ]}
                  disabled={busyId === product._id}
                >
                  {busyId === product._id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Plus size={16} color="#FFFFFF" />
                      <ShoppingCart size={16} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  emptyText: {
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
    marginBottom: 22,
  },

  browseButton: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  browseText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  content: {
    padding: 20,
    paddingBottom: 30,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
  },

  countText: {
    fontSize: 13,
    marginTop: 3,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },

  imageWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  info: {
    flex: 1,
  },

  category: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  name: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },

  price: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },

  outOfStock: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  actions: {
    alignItems: "flex-end",
    gap: 10,
  },

  heartButton: {
    padding: 4,
  },

  addButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default Favorites;
