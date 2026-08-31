import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import {
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Plus,
  Star,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";

const Products = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Food",
    "Drinks",
    "Snacks",
    "Grocery",
    "Personal Care",
  ];

  const products = [
    {
      id: 1,
      name: "Classic Burger",
      category: "Food",
      price: "₱89.00",
      rating: "4.8",
      emoji: "🍔",
      bg: "#FFF0F0",
    },
    {
      id: 2,
      name: "Iced Coffee",
      category: "Drinks",
      price: "₱59.00",
      rating: "4.9",
      emoji: "☕",
      bg: "#FFF3E8",
    },
    {
      id: 3,
      name: "Potato Chips",
      category: "Snacks",
      price: "₱45.00",
      rating: "4.7",
      emoji: "🍟",
      bg: "#FFF8E5",
    },
    {
      id: 4,
      name: "Fresh Sandwich",
      category: "Food",
      price: "₱75.00",
      rating: "4.8",
      emoji: "🥪",
      bg: "#EDF8F1",
    },
    {
      id: 5,
      name: "Soft Drink",
      category: "Drinks",
      price: "₱35.00",
      rating: "4.6",
      emoji: "🥤",
      bg: "#FFF0F0",
    },
    {
      id: 6,
      name: "Chocolate Bar",
      category: "Snacks",
      price: "₱39.00",
      rating: "4.7",
      emoji: "🍫",
      bg: "#FFF3E8",
    },
  ];

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "All" || product.category === selectedCategory;

    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

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
              Browse
            </Text>

            <Text style={[styles.title, { color: colors.headline }]}>
              Our Products
            </Text>
          </View>

          <Pressable
            style={[
              styles.cartButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ShoppingCart size={21} color="#007A53" />

            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>2</Text>
            </View>
          </Pressable>
        </View>

        {/* Search */}
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

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.headline }]}
          />

          <Pressable>
            <SlidersHorizontal size={20} color="#007A53" />
          </Pressable>
        </View>

        {/* Categories */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Categories
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => {
            const active = selectedCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
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
                    {
                      color: active ? "#FFFFFF" : colors.headline,
                    },
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Product Header */}
        <View style={styles.productHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.headline }]}>
              All Products
            </Text>

            <Text style={[styles.resultText, { color: colors.muted }]}>
              {filteredProducts.length} products
            </Text>
          </View>
        </View>

        {/* Products */}
        <View style={styles.productGrid}>
          {filteredProducts.map((product) => (
            <Pressable
              key={product.id}
              style={[
                styles.productCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[styles.productImage, { backgroundColor: product.bg }]}
              >
                <Text style={styles.productEmoji}>{product.emoji}</Text>

                <Pressable
                  style={[styles.addButton, { backgroundColor: "#007A53" }]}
                >
                  <Plus size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.productInfo}>
                <Text style={[styles.productCategory, { color: colors.muted }]}>
                  {product.category}
                </Text>

                <Text
                  style={[styles.productName, { color: colors.headline }]}
                  numberOfLines={1}
                >
                  {product.name}
                </Text>

                <View style={styles.rating}>
                  <Star size={14} color="#FF6720" fill="#FF6720" />

                  <Text style={[styles.ratingText, { color: colors.muted }]}>
                    {product.rating}
                  </Text>
                </View>

                <Text style={[styles.price, { color: "#007A53" }]}>
                  {product.price}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {filteredProducts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>

            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              No products found
            </Text>

            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Try searching for something else.
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
    paddingBottom: 35,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  smallTitle: {
    fontSize: 14,
    marginBottom: 3,
  },

  title: {
    fontSize: 25,
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

  searchContainer: {
    height: 53,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  categoryList: {
    gap: 9,
    paddingTop: 13,
    paddingBottom: 27,
  },

  categoryButton: {
    height: 38,
    paddingHorizontal: 17,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },

  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  resultText: {
    fontSize: 12,
    marginTop: 3,
  },

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

  productImage: {
    height: 145,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  productEmoji: {
    fontSize: 58,
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

  productInfo: {
    paddingHorizontal: 3,
    paddingTop: 10,
    paddingBottom: 5,
  },

  productCategory: {
    fontSize: 11,
    marginBottom: 3,
  },

  productName: {
    fontSize: 14,
    fontWeight: "700",
  },

  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },

  ratingText: {
    fontSize: 11,
  },

  price: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 7,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
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

export default Products;
