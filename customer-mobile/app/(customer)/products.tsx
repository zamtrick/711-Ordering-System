import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import {
  Search,
  ShoppingCart,
  Plus,
  Star,
  PackageSearch,
  Store,
  Check,
  LayoutGrid,
} from "lucide-react-native";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import FavoriteHeartButton from "@/components/FavoriteHeartButton";
import { router, useLocalSearchParams } from "expo-router";
import api from "@/api/axios";
import { useCart } from "@/context/CartContext";
import { playTap } from "@/utils/sound";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
};

type Category = {
  _id: string;
  name: string;
  image?: string;
};

type CategoryFilter = {
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
  ratingAvg?: number;
  ratingCount?: number;
};

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const Products = () => {
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  // Soft brand tint for selected/accent backgrounds (theme-aware)
  const primaryTint = isDark ? "rgba(7,128,128,0.16)" : "rgba(0,122,83,0.08)";

  const { addItem, totalCount, items } = useCart();

  // Home screen deep-links here with a preselected category
  const params = useLocalSearchParams<{ category?: string }>();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(params.category ?? "All");
  const [categories, setCategories] = useState<CategoryFilter[]>([{ name: "All" }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Branch filter
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  // "all" means no branchId filter — show full global catalogue
  const ALL_BRANCHES_ID = "all";
  const [selectedBranchId, setSelectedBranchId] = useState<string>(ALL_BRANCHES_ID);

  // --------------------------------------------------
  // FETCH BRANCHES + PRODUCTS in parallel on mount,
  // then re-fetch only products when branchId changes
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setError("");
        setLoading(true);

        const params: Record<string, string> = {};
        if (selectedBranchId !== ALL_BRANCHES_ID) {
          params.branchId = selectedBranchId;
        }

        // Fire both requests at the same time — don't wait for branches
        // to finish before starting the product fetch.
        const [branchRes, productRes] = await Promise.all([
          selectedBranchId === ALL_BRANCHES_ID
            ? api.get("/customer/branches")
            : Promise.resolve(null),
          api.get("/customer/products", { params }),
        ]);

        if (cancelled) return;

        if (branchRes) {
          setBranches(branchRes.data?.data ?? []);
        }

        const data: Product[] = productRes.data?.data ?? [];
        setProducts(data);

        const seen = new Map<string, CategoryFilter>();
        for (const p of data) {
          const c = p.categoryId;
          if (c?.name && !seen.has(c.name)) {
            seen.set(c.name, { name: c.name, image: c.image });
          }
        }
        const unique = [...seen.values()];
        setCategories([{ name: "All" }, ...unique]);
        setSelectedCategory((prev) =>
          prev === "All" || seen.has(prev) ? prev : "All",
        );
      } catch (err: any) {
        if (cancelled) return;
        console.log("Fetch products error:", err);
        setError("Could not load products. Please try again.");
        if (err?.response?.status === 401) {
          router.replace("/(auth)/login");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedBranchId, retryCount]);

  // Keep selectedBranch object in sync with selectedBranchId
  useEffect(() => {
    if (selectedBranchId === ALL_BRANCHES_ID) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state with selector
      setSelectedBranch(null);
    } else {
      const b = branches.find((b) => b._id === selectedBranchId) ?? null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state with selector
      setSelectedBranch(b);
    }
  }, [selectedBranchId, branches]);

  // --------------------------------------------------
  // CLIENT-SIDE FILTER (category + search)
  // --------------------------------------------------

  const filtered = products.filter((p) => {
    const matchCat =
      selectedCategory === "All" || p.categoryId?.name === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // --------------------------------------------------
  // ADD TO CART
  // --------------------------------------------------

  const handleAdd = (product: Product) => {
    const inCart = items.find((i) => i.id === product._id)?.quantity ?? 0;
    if (inCart >= product.stock) return;

    addItem({
      id: product._id,
      name: product.name,
      category: product.categoryId?.name ?? "Product",
      price: product.price,
      image: product.image,
    });
    playTap();
  };

  // --------------------------------------------------
  // LOADING / ERROR
  // --------------------------------------------------

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading products...
        </Text>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <Text style={[styles.errorText, { color: colors.headline }]}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => setRetryCount((c) => c + 1)}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </ThemedView>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <ThemedView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── HEADER ─────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>Browse</Text>
            <Text style={[styles.title, { color: colors.headline }]}>Our Products</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(customer)/cart")}
            style={[
              styles.cartButton,
              isDark
                ? { backgroundColor: colors.surface, borderColor: colors.border }
                : { backgroundColor: colors.surface },
              // eslint-disable-next-line react-native/no-inline-styles
              isDark ? null : styles.softShadow,
            ]}
          >
            <ShoppingCart size={21} color={colors.primary} />
            {totalCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {totalCount > 99 ? "99+" : totalCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── SEARCH ─────────────────────────────── */}
        <View
          style={[
            styles.searchContainer,
            isDark
              ? { backgroundColor: colors.surface, borderColor: colors.border }
              : { backgroundColor: colors.surface },
            // eslint-disable-next-line react-native/no-inline-styles
            isDark ? null : styles.softShadow,
          ]}
        >
          <Search size={20} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.headline }]}
          />
        </View>

        {/* ── BRANCH FILTER ──────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>Branch</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {/* "All Branches" card */}
          <Pressable
            onPress={() => setSelectedBranchId(ALL_BRANCHES_ID)}
            style={[
              styles.branchCard,
              {
                backgroundColor:
                  selectedBranchId === ALL_BRANCHES_ID ? primaryTint : colors.surface,
                borderColor:
                  selectedBranchId === ALL_BRANCHES_ID ? colors.primary : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.branchIconTile,
                {
                  backgroundColor:
                    selectedBranchId === ALL_BRANCHES_ID ? colors.primary : primaryTint,
                },
              ]}
            >
              <Store
                size={16}
                color={selectedBranchId === ALL_BRANCHES_ID ? "#FFFFFF" : colors.primary}
              />
            </View>
            <View style={styles.branchTextWrap}>
              <Text
                style={[styles.branchCardName, { color: colors.headline }]}
                numberOfLines={1}
              >
                All Branches
              </Text>
              <Text style={[styles.branchCardSub, { color: colors.muted }]}>
                Full catalogue
              </Text>
            </View>
            {selectedBranchId === ALL_BRANCHES_ID && (
              <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
          </Pressable>

          {branches.map((branch) => {
            const active = selectedBranchId === branch._id;
            return (
              <Pressable
                key={branch._id}
                onPress={() => setSelectedBranchId(branch._id)}
                style={[
                  styles.branchCard,
                  {
                    backgroundColor: active ? primaryTint : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.branchIconTile,
                    { backgroundColor: active ? colors.primary : primaryTint },
                  ]}
                >
                  <Store size={16} color={active ? "#FFFFFF" : colors.primary} />
                </View>
                <View style={styles.branchTextWrap}>
                  <Text
                    style={[styles.branchCardName, { color: colors.headline }]}
                    numberOfLines={1}
                  >
                    {branch.name}
                  </Text>
                  <Text style={[styles.branchCardSub, { color: colors.muted }]}>
                    {branch.branchCode}
                  </Text>
                </View>
                {active && (
                  <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── CATEGORIES ─────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Categories
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {categories.map((cat) => {
            const active = selectedCategory === cat.name;
            return (
              <Pressable
                key={cat.name}
                onPress={() => setSelectedCategory(cat.name)}
                style={styles.categoryTile}
              >
                <View
                  style={[
                    styles.categoryCircle,
                    {
                      backgroundColor: active ? primaryTint : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {cat.image ? (
                    <Image
                      source={{ uri: cat.image }}
                      style={styles.categoryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <LayoutGrid
                      size={22}
                      color={active ? colors.primary : colors.muted}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.categoryTileLabel,
                    { color: active ? colors.primary : colors.headline },
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── PRODUCTS ───────────────────────────── */}
        <View style={styles.productHeader}>
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            {selectedBranch ? `${selectedBranch.name} Products` : "All Products"}
          </Text>
          <Text style={[styles.resultText, { color: colors.muted }]}>
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </Text>
        </View>

        <View style={styles.productGrid}>
          {filtered.map((product) => (
            <Pressable
              key={product._id}
              onPress={() => {
                playTap();
                // Cast: route is valid once Expo regenerates typed routes on next dev start
                router.push(`/(customer)/product/${product._id}` as never);
              }}
              style={[
                styles.productCard,
                { backgroundColor: colors.surface },
                // Borderless + soft shadow in light mode; subtle border in dark
                isDark ? { borderColor: colors.border } : styles.softShadow,
              ]}
            >
              {/* Image */}
              <View
                style={[
                  styles.productImageContainer,
                  { backgroundColor: colors.background },
                ]}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <PackageSearch size={40} color={colors.muted} />
                )}

                {/* Out of stock overlay */}
                {product.stock <= 0 && (
                  <View style={styles.outOfStockOverlay}>
                    <Text style={styles.outOfStockText}>Out of stock</Text>
                  </View>
                )}

                {/* Rating badge — top-left over the image */}
                {(product.ratingCount ?? 0) > 0 && (
                  <View style={styles.ratingBadge}>
                    <Star size={11} color="#FFC531" fill="#FFC531" />
                    <Text style={styles.ratingBadgeText}>
                      {(product.ratingAvg ?? 0).toFixed(1)}
                    </Text>
                    <Text style={styles.ratingBadgeCount}>
                      ({product.ratingCount})
                    </Text>
                  </View>
                )}

                {/* Add to cart — floating over the image */}
                {product.stock > 0 && (
                  <Pressable
                    onPress={() => handleAdd(product)}
                    style={[
                      styles.addButton,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Plus size={19} color="#FFFFFF" />
                  </Pressable>
                )}

                {/* Favorite heart — top-right */}
                <FavoriteHeartButton product={product} placement="top-right" />
              </View>

              {/* Info */}
              <View style={styles.productInfo}>
                <Text
                  style={[styles.productCategory, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {product.categoryId?.name?.toUpperCase() ?? "PRODUCT"}
                </Text>

                <Text
                  style={[styles.productName, { color: colors.headline }]}
                  numberOfLines={1}
                >
                  {product.name}
                </Text>

                <View style={styles.stockRow}>
                  <View
                    style={[
                      styles.stockDot,
                      {
                        backgroundColor:
                          product.stock <= 0
                            ? colors.red
                            : product.stock <= 5
                              ? "#FF6720"
                              : "#2E8B57",
                      },
                    ]}
                  />
                  <Text style={[styles.stockText, { color: colors.muted }]}>
                    {product.stock > 0
                      ? product.stock <= 5
                        ? `Only ${product.stock} left`
                        : `${product.stock} in stock`
                      : "Out of stock"}
                  </Text>
                </View>

                <Text style={[styles.price, { color: colors.primary }]}>
                  ₱{product.price.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: isDark
                    ? "rgba(7,128,128,0.14)"
                    : "rgba(0,122,83,0.08)",
                },
              ]}
            >
              <PackageSearch size={34} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No products found
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {selectedBranch
                ? `${selectedBranch.name} has no products matching your filter yet.`
                : "Try searching for something else."}
            </Text>
            {selectedBranchId !== ALL_BRANCHES_ID && (
              <Pressable
                onPress={() => setSelectedBranchId(ALL_BRANCHES_ID)}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>View All Branches</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  loadingText: { marginTop: 12, fontSize: 14 },

  errorText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },

  retryButton: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  content: { padding: 20, paddingBottom: 35 },

  // Soft elevation used on cards / search / cart button (light mode)
  softShadow: {
    shadowColor: "#0A3D3D",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  smallTitle: { fontSize: 14, marginBottom: 3 },

  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },

  cartButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
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

  cartBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },

  searchContainer: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  searchInput: { flex: 1, fontSize: 14, marginLeft: 10 },

  sectionTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },

  filterList: {
    gap: 9,
    paddingTop: 13,
    paddingBottom: 18,
  },

  // Branch cards (horizontal rail)
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 9,
    paddingHorizontal: 11,
    maxWidth: 235,
  },

  branchIconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  branchTextWrap: {
    flexShrink: 1,
    maxWidth: 140,
  },

  branchCardName: { fontSize: 13, fontWeight: "700" },

  branchCardSub: { fontSize: 10.5, fontWeight: "500", marginTop: 1 },

  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

  // Category tiles (circular, image-first)
  categoryTile: {
    width: 78,
    alignItems: "center",
  },

  categoryCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  categoryImage: {
    width: "100%",
    height: "100%",
  },

  categoryTileLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 7,
    textAlign: "center",
  },

  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  resultText: { fontSize: 12, fontWeight: "500" },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  // Borderless card (light) / bordered card (dark)
  productCard: {
    width: "48%",
    borderRadius: 20,
    padding: 8,
    overflow: "hidden",
  },

  productImageContainer: {
    height: 160,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },

  // Floating add-to-cart button over the image
  addButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Rating pill over the image (top-left)
  ratingBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(20,20,20,0.62)",
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  ratingBadgeCount: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "500",
  },

  outOfStockOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 15,
  },

  outOfStockText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  productInfo: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 6,
  },

  productCategory: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  productName: { fontSize: 14, fontWeight: "700", lineHeight: 18 },

  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },

  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  stockText: { fontSize: 11 },

  price: { fontSize: 17, fontWeight: "800", marginTop: 8, letterSpacing: -0.3 },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: { fontSize: 18, fontWeight: "800" },

  emptyText: { fontSize: 13, marginTop: 5, textAlign: "center", maxWidth: 260 },
});

export default Products;
