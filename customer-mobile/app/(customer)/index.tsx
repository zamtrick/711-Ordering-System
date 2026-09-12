import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Search, ShoppingCart, ChevronRight, PackageSearch, Heart } from "lucide-react-native";
import { playTap } from "@/utils/sound";

import useTheme from "@/hooks/useTheme";
import { useFavorites } from "@/context/FavoriteContext";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import api from "@/api/axios";
import { useCart } from "@/context/CartContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Category = {
  _id: string;
  name: string;
  image?: string;
};

type Product = {
  _id: string;
  name: string;
  price: number;
  image?: string;
  categoryId?: Category;
  stock: number;
};

type Promo = {
  _id: string;
  title: string;
  subtitle?: string;
  image?: string;
};

// Home screen category chips — emoji chosen per known category name, with a
// sensible default for anything else.
const CATEGORY_ICONS: Record<string, string> = {
  food: "🍔",
  drinks: "🥤",
  snacks: "🍿",
  grocery: "🛒",
  "personal care": "🧴",
  bakery: "🥐",
  "canned goods": "🥫",
  "dairy & chilled": "🥛",
  "frozen goods": "🧊",
  desserts: "🍰",
};

const iconFor = (name: string) =>
  CATEGORY_ICONS[name.toLowerCase()] ?? "🛍️";

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const Home = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const { addItem, items, totalCount } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  // ── data ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [activePromo, setActivePromo] = useState(0);
  const promoListRef = useRef<FlatList<Promo>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── fetch categories + latest products (same shape as products.tsx) ──────
  const fetchData = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [catRes, prodRes, promoRes] = await Promise.all([
        api.get("/customer/branches"), // keepalive warm-up (also validates auth)
        api.get("/customer/products"),
        api.get("/customer/promos").catch(() => ({ data: { data: [] } })),
      ]);
      void catRes;

      const products: Product[] = prodRes.data?.data ?? [];
      const uniqueCats: Category[] = [];
      const seen = new Set<string>();
      for (const p of products) {
        const c = p.categoryId;
        if (c?._id && !seen.has(c._id)) {
          seen.add(c._id);
          uniqueCats.push({ _id: c._id, name: c.name, image: c.image });
        }
      }

      setCategories(uniqueCats);
      // "Popular" = 2 newest products (same sort the backend already returns)
      setPopular(products.slice(0, 2));
      setPromos(promoRes.data?.data ?? []);
      setActivePromo(0);
    } catch (err: any) {
      console.log("Fetch home data error:", err);
      setError("Could not load the store. Please try again.");

      if (err?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    }  finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchData();
  }, [fetchData]);

  // ── promo carousel auto-play ────────────────────────────────────────────
  useEffect(() => {
    if (promos.length <= 1) return;
    const timer = setInterval(() => {
      setActivePromo((prev) => {
        const next = (prev + 1) % promos.length;
        try {
          promoListRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {
          // index out of range during fast updates — safe to ignore
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [promos.length]);

  const onPromoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const width = Dimensions.get("window").width - 40;
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index >= 0 && index < promos.length) setActivePromo(index);
  };

  // ── actions (all keep the homepage design; they just go somewhere) ───────
  const goProducts = () => router.push("/(customer)/products");

  const goCategory = (name: string) => {
    router.push({
      pathname: "/(customer)/products",
      params: { category: name },
    });
  };

  const handleAdd = (product: Product) => {
    const inCart = items.find((i) => i.id === product._id)?.quantity ?? 0;
    if (inCart >= product.stock) return; // same guard as products.tsx
    addItem({
      id: product._id,
      name: product.name,
      category: product.categoryId?.name ?? "Product",
      price: product.price,
      image: product.image,
    });

    playTap();
  };

  // ── loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading the store...
        </Text>
      </ThemedView>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <Text style={[styles.errorText, { color: colors.headline }]}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.muted }]}>
              Good day 👋
            </Text>

            <Text style={[styles.title, { color: colors.headline }]}>
              What are you looking for?
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/(customer)/cart")}
            style={[
              styles.cartButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ShoppingCart size={22} color="#007A53" />

            {totalCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {totalCount > 99 ? "99+" : totalCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search — jumps to the products screen which has live search */}
        <Pressable onPress={goProducts} style={styles.searchPressable}>
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Search size={20} color={colors.muted} />

            <Text style={[styles.searchText, { color: colors.muted }]}>
              Search products...
            </Text>
          </View>
        </Pressable>

        {/* Promo carousel — superadmin-managed slides, fallback to static card */}
        {promos.length === 0 ? (
          <View style={[styles.promo, { backgroundColor: "#007A53" }]}>
            <View style={styles.promoContent}>
              <Text style={styles.promoSmall}>SPECIAL OFFER</Text>

              <Text style={styles.promoTitle}>Fresh deals{"\n"}just for you</Text>

              <Pressable style={styles.shopButton} onPress={goProducts}>
                <Text style={[styles.shopButtonText, { color: "#007A53" }]}>
                  Shop Now
                </Text>

                <ChevronRight size={16} color="#007A53" />
              </Pressable>
            </View>

            <View style={styles.promoAccent}>
              <View
                style={[styles.orangeAccent, { backgroundColor: "#FF6720" }]}
              />

              <View style={[styles.redAccent, { backgroundColor: "#DA291C" }]} />
            </View>
          </View>
        ) : (
          <View style={styles.carouselWrap}>
            <FlatList
              ref={promoListRef}
              data={promos}
              keyExtractor={(item) => item._id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPromoScroll}
              renderItem={({ item }) => (
                <View style={[styles.promoSlide, { backgroundColor: "#007A53" }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.promoImage} resizeMode="cover" />
                  ) : null}
                  <View style={styles.promoOverlay} />
                  <View style={styles.promoContent}>
                    <Text style={styles.promoSmall}>
                      {(item.subtitle || "SPECIAL OFFER").toUpperCase()}
                    </Text>

                    <Text style={styles.promoTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <Pressable style={styles.shopButton} onPress={goProducts}>
                      <Text style={[styles.shopButtonText, { color: "#007A53" }]}>
                        Shop Now
                      </Text>

                      <ChevronRight size={16} color="#007A53" />
                    </Pressable>
                  </View>
                </View>
              )}
            />
            {promos.length > 1 && (
              <View style={styles.dots}>
                {promos.map((p, i) => (
                  <View
                    key={p._id}
                    style={[
                      styles.dot,
                      { backgroundColor: i === activePromo ? "#FFFFFF" : "rgba(255,255,255,0.45)", width: i === activePromo ? 22 : 8 },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            Categories
          </Text>

          <Pressable onPress={goProducts}>
            <Text style={[styles.seeAll, { color: "#007A53" }]}>See all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => (
            <Pressable
              key={category._id}
              onPress={() => goCategory(category.name)}
              style={[
                styles.category,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {category.image ? (
                <Image
                  source={{ uri: category.image }}
                  style={styles.categoryImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.categoryIcon}>{iconFor(category.name)}</Text>
              )}

              <Text
                style={[styles.categoryName, { color: colors.headline }]}
                numberOfLines={2}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Popular Products */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            Popular Products
          </Text>

          <Pressable onPress={goProducts}>
            <Text style={[styles.seeAll, { color: "#007A53" }]}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.productRow}>
          {popular.map((product) => (
            <Pressable
              key={product._id}
              style={[
                styles.productCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.productImage,
                  { backgroundColor: colors.background },
                ]}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImageContent}
                    resizeMode="cover"
                  />
                ) : (
                  <PackageSearch size={44} color={colors.muted} />
                )}

                {product.stock > 0 && (
                  <Pressable
                    onPress={() => handleAdd(product)}
                    style={[styles.addButton, { backgroundColor: "#007A53" }]}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => toggleFavorite(product)}
                  style={styles.heartButton}
                  hitSlop={8}
                >
                  <Heart
                    size={18}
                    color={isFavorite(product._id) ? "#DA291C" : "#FFFFFF"}
                    fill={isFavorite(product._id) ? "#DA291C" : "rgba(0,0,0,0.25)"}
                  />
                </Pressable>
              </View>

              <Text
                style={[styles.productName, { color: colors.headline }]}
                numberOfLines={1}
              >
                {product.name}
              </Text>

              <Text style={[styles.productPrice, { color: "#007A53" }]}>
                ₱{product.price.toFixed(2)}
              </Text>
            </Pressable>
          ))}
        </View>

        {popular.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No products yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Check back soon — the store is being stocked!
            </Text>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 30,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  errorText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },

  retryButton: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
  },

  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
  },

  cartButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  cartBadge: {
    position: "absolute",
    right: -3,
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#DA291C",
    alignItems: "center",
    justifyContent: "center",
  },

  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  searchPressable: {
    // wrapper so the whole search bar is tappable
  },

  searchContainer: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 20,
  },

  searchText: {
    fontSize: 14,
    marginLeft: 10,
  },

  promo: {
    height: 170,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    marginBottom: 28,
  },

  carouselWrap: {
    marginBottom: 28,
  },

  promoSlide: {
    width: Dimensions.get("window").width - 40,
    height: 170,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    marginRight: 12,
  },

  promoImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },

  promoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },

  dot: {
    height: 8,
    borderRadius: 4,
  },

  promoContent: {
    zIndex: 2,
  },

  promoSmall: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  promoTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 29,
    marginTop: 6,
  },

  shopButton: {
    backgroundColor: "#FFFFFF",
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
  },

  shopButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },

  promoAccent: {
    position: "absolute",
    right: -15,
    top: -15,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  orangeAccent: {
    width: 70,
    height: 12,
    borderRadius: 10,
    transform: [{ rotate: "-25deg" }],
  },

  redAccent: {
    width: 55,
    height: 12,
    borderRadius: 10,
    transform: [{ rotate: "-25deg" }],
    marginTop: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  seeAll: {
    fontSize: 13,
    fontWeight: "700",
  },

  categoryList: {
    gap: 12,
    paddingBottom: 28,
  },

  category: {
    width: 90,
    height: 95,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  categoryIcon: {
    fontSize: 28,
    marginBottom: 7,
  },

  categoryImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 7,
  },

  categoryName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  productRow: {
    flexDirection: "row",
    gap: 12,
  },

  productCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },

  productImage: {
    height: 120,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative" as const,
    overflow: "hidden",
  },

  productImageContent: {
    width: "100%" as const,
    height: "100%" as const,
    borderRadius: 12,
  },

  heartButton: {
    position: "absolute" as const,
    left: 6,
    top: 6,
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  addButton: {
    position: "absolute" as const,
    right: 6,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },

  productName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 5,
  },

  productPrice: {
    fontSize: 15,
    fontWeight: "800",
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
  },

  emptyEmoji: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  emptyText: {
    fontSize: 13,
    marginTop: 5,
  },
});

export default Home;
