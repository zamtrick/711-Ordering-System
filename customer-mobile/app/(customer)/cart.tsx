import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  PackageSearch,
} from "lucide-react-native";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import { useCart } from "@/context/CartContext";

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const Cart = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const { items, removeItem, increaseQuantity, decreaseQuantity, subtotal, totalCount } =
    useCart();

  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  // Fetch delivery fee for the summary preview (the real snapshot happens on
  // the checkout screen at order-creation time, so this is display-only).
  useEffect(() => {
    import("@/api/axios").then(({ default: api }) => {
      api
        .get("/settings/delivery-fee")
        .then((res) => {
          const fee = res.data?.data?.fee;
          if (typeof fee === "number") setDeliveryFee(fee);
        })
        .catch(() => {});
    });
  }, []);

  const fee = subtotal > 0 ? deliveryFee : 0;
  const total = subtotal + fee;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <ThemedView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>
              Your items
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              My Cart
            </Text>
          </View>

          <View
            style={[
              styles.cartIcon,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ShoppingCart size={21} color="#007A53" />

            {totalCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalCount > 99 ? "99+" : totalCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        {items.length > 0 ? (
          <>
            {/* Cart Items */}
            <View style={styles.itemsContainer}>
              {items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {/* Product image or placeholder */}
                  <View
                    style={[
                      styles.productImageContainer,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <PackageSearch size={32} color={colors.muted} />
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.itemTop}>
                      <View style={styles.nameContainer}>
                        <Text style={[styles.category, { color: colors.muted }]}>
                          {item.category}
                        </Text>
                        <Text
                          style={[styles.itemName, { color: colors.headline }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => removeItem(item.id)}
                        style={styles.deleteButton}
                      >
                        <Trash2 size={18} color="#DA291C" />
                      </Pressable>
                    </View>

                    <View style={styles.itemBottom}>
                      <Text style={[styles.price, { color: "#007A53" }]}>
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </Text>

                      <View
                        style={[
                          styles.quantityContainer,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => decreaseQuantity(item.id)}
                          style={styles.quantityButton}
                        >
                          <Minus size={15} color="#007A53" />
                        </Pressable>

                        <Text style={[styles.quantity, { color: colors.headline }]}>
                          {item.quantity}
                        </Text>

                        <Pressable
                          onPress={() => increaseQuantity(item.id)}
                          style={[
                            styles.quantityButton,
                            { backgroundColor: "#007A53" },
                          ]}
                        >
                          <Plus size={15} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Summary */}
            <View style={styles.summary}>
              <Text style={[styles.summaryTitle, { color: colors.headline }]}>
                Order Summary
              </Text>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>
                  Subtotal
                </Text>
                <Text style={[styles.summaryValue, { color: colors.headline }]}>
                  ₱{subtotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>
                  Delivery Fee
                </Text>
                <Text style={[styles.summaryValue, { color: colors.headline }]}>
                  ₱{fee.toFixed(2)}
                </Text>
              </View>

              <View style={[styles.separator, { backgroundColor: colors.border }]} />

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.headline }]}>
                  Total
                </Text>
                <Text style={[styles.totalValue, { color: "#007A53" }]}>
                  ₱{total.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Checkout */}
            <Pressable
              onPress={() => router.push("/(customer)/checkout")}
              style={[
                styles.checkoutButton,
                { backgroundColor: "#007A53" },
              ]}
            >
              <ArrowRight size={20} color="#FFFFFF" />
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            </Pressable>
          </>
        ) : (
          /* Empty */
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <ShoppingCart size={42} color="#007A53" />
          </View>

            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              Your cart is empty
            </Text>

            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {"Looks like you haven't added anything yet."}
            </Text>

            <Pressable
              onPress={() => router.push("/(customer)/products")}
              style={[styles.browseButton, { backgroundColor: "#007A53" }]}
            >
              <Text style={styles.browseText}>Browse Products</Text>
            </Pressable>
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
  content: {
    padding: 20,
    paddingBottom: 35,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  smallTitle: {
    fontSize: 14,
    marginBottom: 3,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
  },

  cartIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    right: -3,
    top: -4,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#DA291C",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  itemsContainer: {
    gap: 12,
  },

  itemCard: {
    minHeight: 125,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
  },

  productImageContainer: {
    width: 105,
    height: 105,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  itemInfo: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: "space-between",
    paddingVertical: 2,
  },

  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  nameContainer: {
    flex: 1,
    paddingRight: 8,
  },

  category: {
    fontSize: 11,
    marginBottom: 3,
  },

  itemName: {
    fontSize: 15,
    fontWeight: "700",
  },

  deleteButton: {
    padding: 3,
  },

  itemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  price: {
    fontSize: 16,
    fontWeight: "800",
  },

  quantityContainer: {
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
  },

  quantityButton: {
    width: 27,
    height: 27,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  quantity: {
    minWidth: 27,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },

  summary: {
    marginTop: 25,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 15,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  summaryLabel: {
    fontSize: 14,
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
  },

  separator: {
    height: 1,
    marginVertical: 6,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },

  totalLabel: {
    fontSize: 17,
    fontWeight: "800",
  },

  totalValue: {
    fontSize: 20,
    fontWeight: "900",
  },

  checkoutButton: {
    height: 56,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },

  checkoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
  },

  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "800",
  },

  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 270,
    lineHeight: 20,
  },

  browseButton: {
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },

  browseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default Cart;
