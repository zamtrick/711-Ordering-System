import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
} from "react-native";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Tag,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";

const Cart = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [cartItems, setCartItems] = useState([
    {
      id: 1,
      name: "Classic Burger",
      category: "Food",
      price: 89,
      quantity: 1,
      emoji: "🍔",
      bg: "#FFF0F0",
    },
    {
      id: 2,
      name: "Iced Coffee",
      category: "Drinks",
      price: 59,
      quantity: 2,
      emoji: "☕",
      bg: "#FFF3E8",
    },
    {
      id: 3,
      name: "Potato Chips",
      category: "Snacks",
      price: 45,
      quantity: 1,
      emoji: "🍟",
      bg: "#FFF8E5",
    },
  ]);

  const increaseQuantity = (id: number) => {
    setCartItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  };

  const decreaseQuantity = (id: number) => {
    setCartItems((items) =>
      items
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (id: number) => {
    setCartItems((items) => items.filter((item) => item.id !== id));
  };

  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const deliveryFee = subtotal > 0 ? 30 : 0;
  const total = subtotal + deliveryFee;

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
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ShoppingCart size={21} color="#007A53" />

            {cartItems.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartItems.reduce((total, item) => total + item.quantity, 0)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {cartItems.length > 0 ? (
          <>
            {/* Cart Items */}
            <View style={styles.itemsContainer}>
              {cartItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[styles.productImage, { backgroundColor: item.bg }]}
                  >
                    <Text style={styles.productEmoji}>{item.emoji}</Text>
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.itemTop}>
                      <View style={styles.nameContainer}>
                        <Text
                          style={[styles.category, { color: colors.muted }]}
                        >
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

                        <Text
                          style={[styles.quantity, { color: colors.headline }]}
                        >
                          {item.quantity}
                        </Text>

                        <Pressable
                          onPress={() => increaseQuantity(item.id)}
                          style={[
                            styles.quantityButton,
                            {
                              backgroundColor: "#007A53",
                            },
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

            {/* Promo */}
            <Pressable
              style={[
                styles.promoContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.promoIcon}>
                <Tag size={19} color="#FF6720" />
              </View>

              <View style={styles.promoTextContainer}>
                <Text style={[styles.promoTitle, { color: colors.headline }]}>
                  Have a promo code?
                </Text>

                <Text style={[styles.promoSubtitle, { color: colors.muted }]}>
                  Apply your discount
                </Text>
              </View>

              <ArrowRight size={18} color="#007A53" />
            </Pressable>

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
                  ₱{deliveryFee.toFixed(2)}
                </Text>
              </View>

              <View
                style={[styles.separator, { backgroundColor: colors.border }]}
              />

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
              style={[styles.checkoutButton, { backgroundColor: "#007A53" }]}
            >
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>

              <ArrowRight size={20} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          /* Empty Cart */
          <View style={styles.emptyContainer}>
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.surface }]}
            >
              <ShoppingCart size={42} color="#007A53" />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              Your cart is empty
            </Text>

            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Looks like you haven't added anything yet.
            </Text>

            <Pressable
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

  productImage: {
    width: 105,
    height: 105,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  productEmoji: {
    fontSize: 48,
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

  promoContainer: {
    height: 68,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF3E8",
    alignItems: "center",
    justifyContent: "center",
  },

  promoTextContainer: {
    flex: 1,
    marginLeft: 11,
  },

  promoTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  promoSubtitle: {
    fontSize: 11,
    marginTop: 2,
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
