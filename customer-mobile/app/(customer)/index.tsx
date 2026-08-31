import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
} from "react-native";
import { Search, ShoppingCart, ChevronRight } from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";

const Home = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

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
            style={[
              styles.cartButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ShoppingCart size={22} color="#007A53" />
          </Pressable>
        </View>

        {/* Search */}
        <Pressable
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
        </Pressable>

        {/* Promo */}
        <View style={[styles.promo, { backgroundColor: "#007A53" }]}>
          <View style={styles.promoContent}>
            <Text style={styles.promoSmall}>SPECIAL OFFER</Text>

            <Text style={styles.promoTitle}>Fresh deals{"\n"}just for you</Text>

            <Pressable style={styles.shopButton}>
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

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            Categories
          </Text>

          <Text style={[styles.seeAll, { color: "#007A53" }]}>See all</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {[
            { name: "Food", icon: "🍔" },
            { name: "Drinks", icon: "🥤" },
            { name: "Snacks", icon: "🍿" },
            { name: "Grocery", icon: "🛒" },
            { name: "Personal Care", icon: "🧴" },
          ].map((category) => (
            <Pressable
              key={category.name}
              style={[
                styles.category,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>

              <Text style={[styles.categoryName, { color: colors.headline }]}>
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

          <Text style={[styles.seeAll, { color: "#007A53" }]}>See all</Text>
        </View>

        <View style={styles.productRow}>
          <View
            style={[
              styles.productCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.productImage, { backgroundColor: "#FFF3E8" }]}>
              <Text style={styles.productEmoji}>🥤</Text>
            </View>

            <Text style={[styles.productName, { color: colors.headline }]}>
              Refreshing Drink
            </Text>

            <Text style={[styles.productPrice, { color: "#007A53" }]}>
              ₱49.00
            </Text>
          </View>

          <View
            style={[
              styles.productCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.productImage, { backgroundColor: "#FFF0F0" }]}>
              <Text style={styles.productEmoji}>🍔</Text>
            </View>

            <Text style={[styles.productName, { color: colors.headline }]}>
              Classic Burger
            </Text>

            <Text style={[styles.productPrice, { color: "#007A53" }]}>
              ₱89.00
            </Text>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 30,
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
  },

  categoryIcon: {
    fontSize: 28,
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
  },

  productEmoji: {
    fontSize: 50,
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
});

export default Home;
