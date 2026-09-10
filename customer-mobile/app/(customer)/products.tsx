import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
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
  ChevronDown,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
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
};

type Product = {
  _id: string;
  name: string;
  price: number;
  image?: string;
  categoryId?: Category;
  stock: number;
};

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const Products = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const { addItem, totalCount, items } = useCart();

  // Home screen deep-links here with a preselected category
  const params = useLocalSearchParams<{ category?: string }>();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(params.category ?? "All");
  const [categories, setCategories] = useState<string[]>(["All"]);
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

        const unique = Array.from(
          new Set(
            data
              .map((p) => p.categoryId?.name)
              .filter((n): n is string => Boolean(n)),
          ),
        );
        setCategories(["All", ...unique]);
        setSelectedCategory((prev) =>
          prev === "All" || unique.includes(prev) ? prev : "All",
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
      setSelectedBranch(null);
    } else {
      const b = branches.find((b) => b._id === selectedBranchId) ?? null;
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
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ShoppingCart size={21} color="#007A53" />
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
            { backgroundColor: colors.surface, borderColor: colors.border },
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
          {/* "All Branches" chip */}
          <Pressable
            onPress={() => setSelectedBranchId(ALL_BRANCHES_ID)}
            style={[
              styles.branchChip,
              {
                backgroundColor:
                  selectedBranchId === ALL_BRANCHES_ID ? "#007A53" : colors.surface,
                borderColor:
                  selectedBranchId === ALL_BRANCHES_ID ? "#007A53" : colors.border,
              },
            ]}
          >
            <Store
              size={13}
              color={selectedBranchId === ALL_BRANCHES_ID ? "#FFFFFF" : colors.muted}
            />
            <Text
              style={[
                styles.branchChipText,
                {
                  color:
                    selectedBranchId === ALL_BRANCHES_ID ? "#FFFFFF" : colors.headline,
                },
              ]}
            >
              All Branches
            </Text>
          </Pressable>

          {branches.map((branch) => {
            const active = selectedBranchId === branch._id;
            return (
              <Pressable
                key={branch._id}
                onPress={() => setSelectedBranchId(branch._id)}
                style={[
                  styles.branchChip,
                  {
                    backgroundColor: active ? "#007A53" : colors.surface,
                    borderColor: active ? "#007A53" : colors.border,
                  },
                ]}
              >
                <Store size={13} color={active ? "#FFFFFF" : colors.muted} />
                <Text
                  style={[
                    styles.branchChipText,
                    { color: active ? "#FFFFFF" : colors.headline },
                  ]}
                >
                  {branch.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Branch availability notice */}
        {selectedBranch && (
          <View
            style={[
              styles.branchNotice,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Store size={14} color="#007A53" />
            <Text style={[styles.branchNoticeText, { color: colors.muted }]}>
              Showing products available at{" "}
              <Text style={{ fontWeight: "700", color: colors.headline }}>
                {selectedBranch.name}
              </Text>
            </Text>
          </View>
        )}

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
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: active ? "#007A53" : colors.surface,
                    borderColor: active ? "#007A53" : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: active ? "#FFFFFF" : colors.headline },
                  ]}
                >
                  {cat}
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
            {filtered.length} products
          </Text>
        </View>

        <View style={styles.productGrid}>
          {filtered.map((product) => (
            <Pressable
              key={product._id}
              style={[
                styles.productCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
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

                {product.stock <= 0 && (
                  <View style={styles.outOfStockOverlay}>
                    <Text style={styles.outOfStockText}>Out of stock</Text>
                  </View>
                )}

                {product.stock > 0 && (
                  <Pressable
                    onPress={() => handleAdd(product)}
                    style={[styles.addButton, { backgroundColor: "#007A53" }]}
                  >
                    <Plus size={18} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>

              {/* Info */}
              <View style={styles.productInfo}>
                <Text style={[styles.productCategory, { color: colors.muted }]}>
                  {product.categoryId?.name ?? "Product"}
                </Text>

                <Text
                  style={[styles.productName, { color: colors.headline }]}
                  numberOfLines={1}
                >
                  {product.name}
                </Text>

                <View style={styles.stockRow}>
                  <Star size={12} color="#FF6720" fill="#FF6720" />
                  <Text style={[styles.stockText, { color: colors.muted }]}>
                    {product.stock > 0
                      ? `${product.stock} in stock`
                      : "Out of stock"}
                  </Text>
                </View>

                <Text style={[styles.price, { color: "#007A53" }]}>
                  ₱{product.price.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
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
    borderRadius: 12,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  content: { padding: 20, paddingBottom: 35 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  smallTitle: { fontSize: 14, marginBottom: 3 },

  title: { fontSize: 25, fontWeight: "800" },

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

  cartBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },

  searchContainer: {
    height: 53,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  searchInput: { flex: 1, fontSize: 14, marginLeft: 10 },

  sectionTitle: { fontSize: 18, fontWeight: "800" },

  filterList: {
    gap: 9,
    paddingTop: 13,
    paddingBottom: 18,
  },

  // Branch chips
  branchChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  branchChipText: { fontSize: 13, fontWeight: "600" },

  branchNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 18,
  },

  branchNoticeText: { fontSize: 12, flex: 1 },

  // Category chips
  categoryButton: {
    height: 38,
    paddingHorizontal: 17,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  categoryText: { fontSize: 13, fontWeight: "600" },

  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  resultText: { fontSize: 12 },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  productCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 9,
    overflow: "hidden",
  },

  productImageContainer: {
    height: 145,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 13,
  },

  addButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  outOfStockOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 13,
  },

  outOfStockText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  productInfo: {
    paddingHorizontal: 3,
    paddingTop: 10,
    paddingBottom: 5,
  },

  productCategory: { fontSize: 11, marginBottom: 3 },

  productName: { fontSize: 14, fontWeight: "700" },

  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },

  stockText: { fontSize: 11 },

  price: { fontSize: 16, fontWeight: "800", marginTop: 7 },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },

  emptyEmoji: { fontSize: 42, marginBottom: 12 },

  emptyTitle: { fontSize: 18, fontWeight: "800" },

  emptyText: { fontSize: 13, marginTop: 5, textAlign: "center", maxWidth: 260 },
});

export default Products;
