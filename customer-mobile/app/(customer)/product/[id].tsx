import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import {
  ArrowLeft,
  Minus,
  PackageSearch,
  Plus,
  Share2,
  ShoppingCart,
  Star,
  Zap,
} from "lucide-react-native";
import api from "@/api/axios";
import ThemedView from "@/components/ThemedView";
import FavoriteHeartButton from "@/components/FavoriteHeartButton";
import useTheme from "@/hooks/useTheme";
import { useCart } from "@/context/CartContext";
import { playTap } from "@/utils/sound";

// --------------------------------------------------
// PRODUCT DETAIL (Shopee-style)
// --------------------------------------------------
// Big image, price + real rating, urgency line, description,
// reviews, related products, sticky qty + Add to Cart / Buy Now bar.
// --------------------------------------------------

type Product = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  isActive: boolean;
  categoryId?: { _id: string; name: string } | string | null;
  ratingAvg?: number;
  ratingCount?: number;
};

type Review = {
  _id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: string;
};

function formatStars(avg?: number) {
  if (!avg || avg <= 0) return null;
  return avg.toFixed(1);
}

function formatReviewDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qtyRaw, setQtyRaw] = useState(1);
  const [buying, setBuying] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/customer/products/${id}`);
      setProduct(res.data?.data ?? null);

      // Related products: same category, exclude self
      const categoryId =
        res.data?.data?.categoryId && typeof res.data.data.categoryId === "object"
          ? res.data.data.categoryId._id
          : null;
      const relRes = await api.get("/customer/products", {
        params: categoryId ? { categoryId } : {},
      });
      setRelated(
        (relRes.data?.data ?? []).filter((p: Product) => p._id !== id).slice(0, 6),
      );

      const revRes = await api.get(`/customer/reviews/product/${id}`);
      setReviews(revRes.data?.data ?? []);
    } catch {
      setError("Failed to load product.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Re-fetch when returning to this screen (stock may have changed)
  useFocusEffect(
    useCallback(() => {
      if (product) {
        fetchData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const stock = product?.stock ?? 0;
  const inStock = stock > 0;
  // Derived clamp — never persist a stale qty when stock shrinks mid-view
  const maxQty = Math.max(1, stock);
  const qty = Math.min(qtyRaw, maxQty);

  const ratingAvg = product?.ratingAvg ?? 0;
  const ratingCount = product?.ratingCount ?? 0;
  const lowStock = inStock && stock <= 5;

  const cartPayload = useMemo(
    () =>
      product
        ? {
            id: product._id,
            name: product.name,
            category:
              product.categoryId && typeof product.categoryId === "object"
                ? product.categoryId.name
                : "General",
            price: product.price,
            image: product.image,
          }
        : null,
    [product],
  );

  const handleAddToCart = () => {
    if (!product || !inStock || !cartPayload) return;
    playTap();
    for (let i = 0; i < qty; i++) addItem(cartPayload);
    // stays on page — Shopee-style toast could go here later
  };

  const handleShare = async () => {
    if (!product) return;
    playTap();
    // Deep link: opens this product in the app for anyone who has it installed
    const link = Linking.createURL(`/(customer)/product/${product._id}`);
    try {
      await Share.share({
        message: `🛒 Check out "${product.name}" — only ₱${product.price}!\n${link}`,
      });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  const handleBuyNow = async () => {
    if (!product || !inStock || !cartPayload) return;
    playTap();
    setBuying(true);
    try {
      for (let i = 0; i < qty; i++) addItem(cartPayload);
      router.push("/(customer)/checkout");
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (error || !product) {
    return (
      <ThemedView style={styles.center}>
        <PackageSearch size={44} color={colors.muted} />
        <Text style={[styles.errorText, { color: colors.muted }]}>
          {error || "Product not found."}
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.retryText}>Go Back</Text>
        </Pressable>
      </ThemedView>
    );
  }

  const categoryName =
    product.categoryId && typeof product.categoryId === "object" ? product.categoryId.name : null;

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Image ─────────────────────────────────────────────── */}
        <View style={styles.imageWrap}>
          {product.image ? (
            <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <PackageSearch size={64} color={colors.muted} />
            </View>
          )}
          {/* Back — floats over the image, top-left */}
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <View style={[styles.backChip, { backgroundColor: isDark ? "rgba(18,18,18,0.75)" : "rgba(255,255,254,0.9)", borderColor: colors.border }]}>
              <ArrowLeft size={20} color={colors.headline} />
            </View>
          </Pressable>

          {/* Favorite — top-right, mirrors the card hearts */}
          <FavoriteHeartButton product={product} size={20} placement="top-right" />

          {/* Share — stacked under the favorite heart */}
          <Pressable onPress={handleShare} style={styles.shareButton} hitSlop={8}>
            <View
              style={[
                styles.shareChip,
                {
                  backgroundColor: isDark ? "rgba(18,18,18,0.75)" : "rgba(255,255,254,0.9)",
                  borderColor: colors.border,
                },
              ]}
            >
              <Share2 size={17} color={colors.headline} />
            </View>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* ── Price + rating ──────────────────────────────────── */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.primary }]}>₱{product.price}</Text>
            {ratingCount > 0 ? (
              <View style={styles.ratingRow}>
                <Star size={14} color="#F5A623" fill="#F5A623" />
                <Text style={[styles.ratingText, { color: colors.headline }]}>
                  {formatStars(ratingAvg)}
                </Text>
                <Text style={[styles.ratingCount, { color: colors.muted }]}>
                  ({ratingCount})
                </Text>
              </View>
            ) : (
              <Text style={[styles.ratingCount, { color: colors.muted }]}>No ratings yet</Text>
            )}
          </View>

          {/* ── Name + category ─────────────────────────────────── */}
          <Text style={[styles.name, { color: colors.headline }]}>{product.name}</Text>
          {categoryName && (
            <Text style={[styles.category, { color: colors.muted }]}>Category: {categoryName}</Text>
          )}

          {/* ── Stock / urgency ─────────────────────────────────── */}
          {!inStock ? (
            <View style={[styles.stockBadge, { backgroundColor: isDark ? "#3D1515" : "#FFF0F0" }]}>
              <Text style={[styles.stockText, { color: colors.error }]}>Out of stock</Text>
            </View>
          ) : lowStock ? (
            <View style={[styles.stockBadge, { backgroundColor: isDark ? "#3A2A0A" : "#FEF3C7" }]}>
              <Text style={[styles.stockText, { color: isDark ? "#FCD34D" : "#B45309" }]}>
                ⚡ Only {product.stock} left — order soon!
              </Text>
            </View>
          ) : (
            <Text style={[styles.stockOk, { color: colors.muted }]}>{product.stock} in stock</Text>
          )}

          {/* ── Description ─────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>Description</Text>
          <Text style={[styles.description, { color: colors.paragraph }]}>
            {product.description?.trim() || "No description provided for this product."}
          </Text>

          {/* ── Reviews ─────────────────────────────────────────── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.headline }]}>
              Reviews {ratingCount > 0 ? `(${ratingCount})` : ""}
            </Text>
          </View>
          {reviews.length === 0 ? (
            <Text style={[styles.noReviews, { color: colors.muted }]}>
              No reviews yet — be the first after your next order!
            </Text>
          ) : (
            reviews.map((r) => (
              <View key={r._id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        color={i < r.rating ? "#F5A623" : colors.border}
                        fill={i < r.rating ? "#F5A623" : colors.border}
                      />
                    ))}
                  </View>
                  <Text style={[styles.reviewDate, { color: colors.muted }]}>
                    {formatReviewDate(r.createdAt)}
                  </Text>
                </View>
                {r.comment ? (
                  <Text style={[styles.reviewComment, { color: colors.paragraph }]}>{r.comment}</Text>
                ) : null}
                <Text style={[styles.reviewer, { color: colors.muted }]}>— {r.reviewer}</Text>
              </View>
            ))
          )}

          {/* ── Related ─────────────────────────────────────────── */}
          {related.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.headline }]}>You may also like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedRow}>
                {related.map((p) => (
                  <Pressable
                    key={p._id}
                    onPress={() => {
                      playTap();
                      // Cast: route is valid once Expo regenerates typed routes on next dev start
                      router.push(`/(customer)/product/${p._id}` as never);
                    }}
                    style={[styles.relatedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {p.image ? (
                      <Image source={{ uri: p.image }} style={styles.relatedImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.relatedImage, styles.imagePlaceholder]}>
                        <PackageSearch size={22} color={colors.muted} />
                      </View>
                    )}
                    <Text style={[styles.relatedName, { color: colors.headline }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.relatedPrice, { color: colors.primary }]}>₱{p.price}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky CTA bar ────────────────────────────────────── */}
      <View style={[styles.ctaBar, { backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
        {/* Quantity stepper */}
        <View style={[styles.qtyWrap, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => setQtyRaw((q) => Math.max(1, q - 1))}
            style={styles.qtyBtn}
            disabled={!inStock}
          >
            <Minus size={16} color={inStock ? colors.headline : colors.muted} />
          </Pressable>
          <Text style={[styles.qtyText, { color: colors.headline }]}>{qty}</Text>
          <Pressable
            onPress={() => setQtyRaw((q) => Math.min(maxQty, q + 1))}
            style={styles.qtyBtn}
            disabled={!inStock}
          >
            <Plus size={16} color={inStock ? colors.headline : colors.muted} />
          </Pressable>
        </View>

        {/* Add to cart */}
        <Pressable
          onPress={handleAddToCart}
          disabled={!inStock}
          style={[styles.ctaButton, styles.cartButton, { borderColor: colors.primary }, !inStock && styles.ctaDisabled]}
        >
          <ShoppingCart size={18} color={inStock ? colors.primary : colors.muted} />
          <Text style={[styles.cartButtonText, { color: inStock ? colors.primary : colors.muted }]}>
            Add to Cart
          </Text>
        </Pressable>

        {/* Buy now */}
        <Pressable
          onPress={handleBuyNow}
          disabled={!inStock || buying}
          style={[styles.ctaButton, styles.buyButton, { backgroundColor: colors.primary }, !inStock && styles.ctaDisabled]}
        >
          <Zap size={18} color="#FFFFFF" />
          <Text style={styles.buyButtonText}>{buying ? "Loading..." : "Buy Now"}</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  scroll: { paddingBottom: 24 },

  imageWrap: { position: "relative" as const },
  image: { width: "100%", height: 320 },
  imagePlaceholder: { alignItems: "center" as const, justifyContent: "center" as const },
  backButton: { position: "absolute" as const, left: 12, top: 12, zIndex: 2 },
  backChip: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center" as const, justifyContent: "center" as const },
  shareButton: { position: "absolute" as const, right: 8, top: 50, zIndex: 2 },
  shareChip: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: "center" as const, justifyContent: "center" as const },

  body: { padding: 16, gap: 10 },

  priceRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  price: { fontSize: 28, fontWeight: "800" as const },
  ratingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  ratingText: { fontSize: 14, fontWeight: "700" as const },
  ratingCount: { fontSize: 13 },

  name: { fontSize: 20, fontWeight: "700" as const, lineHeight: 26 },
  category: { fontSize: 13 },

  stockBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start" as const },
  stockText: { fontSize: 12, fontWeight: "700" as const },
  stockOk: { fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: "700" as const, marginTop: 8 },
  description: { fontSize: 14, lineHeight: 20 },
  noReviews: { fontSize: 13, fontStyle: "italic" as const },

  sectionHeaderRow: { marginTop: 4 },
  reviewCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  reviewTopRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  starsRow: { flexDirection: "row" as const, gap: 2 },
  reviewDate: { fontSize: 11 },
  reviewComment: { fontSize: 13, lineHeight: 18 },
  reviewer: { fontSize: 12, fontWeight: "600" as const },

  relatedRow: { marginTop: 4 },
  relatedCard: { width: 120, borderRadius: 12, borderWidth: 1, marginRight: 10, padding: 8, gap: 4 },
  relatedImage: { width: 104, height: 80, borderRadius: 8 },
  relatedName: { fontSize: 12, fontWeight: "600" as const },
  relatedPrice: { fontSize: 13, fontWeight: "700" as const },

  ctaBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  qtyWrap: { flexDirection: "row" as const, alignItems: "center" as const, borderWidth: 1, borderRadius: 12, overflow: "hidden" as const },
  qtyBtn: { width: 34, height: 40, alignItems: "center" as const, justifyContent: "center" as const },
  qtyText: { minWidth: 28, textAlign: "center" as const, fontSize: 15, fontWeight: "700" as const },

  ctaButton: { height: 44, borderRadius: 12, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6, paddingHorizontal: 12 },
  cartButton: { borderWidth: 1.5, flex: 1 },
  buyButton: { flex: 1 },
  buyButtonText: { color: "#FFFFFF", fontWeight: "800" as const, fontSize: 14 },
  cartButtonText: { fontWeight: "700" as const, fontSize: 14 },
  ctaDisabled: { opacity: 0.5 },

  errorText: { fontSize: 14, textAlign: "center" as const },
  retryButton: { paddingHorizontal: 16, height: 40, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const },
  retryText: { color: "#FFFFFF", fontWeight: "700" as const },
});
