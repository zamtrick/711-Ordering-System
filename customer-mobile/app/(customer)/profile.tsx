import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
} from "react-native";
import {
  User,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Package,
  Heart,
  Settings,
  HelpCircle,
  LogOut,
  Pencil,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import api from "@/api/axios";

const Profile = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const handleLogOut = async () => {
    try {
      await api.post("/auth/logout");

      router.replace("/(auth)/login");
    } catch (error: any) {
      console.log("Logout error:", error);

      // Even if the server returns an error,
      // you can still send the user back to login.
      router.replace("/(auth)/login");
    }
  };

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
              Account
            </Text>

            <Text style={[styles.title, { color: colors.headline }]}>
              My Profile
            </Text>
          </View>

          <Pressable
            style={[
              styles.editButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Pencil size={19} color="#007A53" />
          </Pressable>
        </View>

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: "#E8F5EF" }]}>
            <User size={34} color="#007A53" />
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.headline }]}>
              John Doe
            </Text>

            <Text style={[styles.email, { color: colors.muted }]}>
              johndoe@email.com
            </Text>

            <View style={styles.memberBadge}>
              <Text style={styles.memberText}>Customer</Text>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Personal Information
        </Text>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <InfoRow
            icon={<Mail size={19} color="#007A53" />}
            label="Email"
            value="johndoe@email.com"
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <InfoRow
            icon={<Phone size={19} color="#007A53" />}
            label="Phone"
            value="+63 912 345 6789"
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <InfoRow
            icon={<MapPin size={19} color="#007A53" />}
            label="Address"
            value="Add your delivery address"
            colors={colors}
          />
        </View>

        {/* My Activity */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          My Activity
        </Text>

        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <MenuItem
            icon={<Package size={20} color="#007A53" />}
            title="My Orders"
            subtitle="View your order history"
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <MenuItem
            icon={<Heart size={20} color="#DA291C" />}
            title="Favorites"
            subtitle="Your saved products"
            colors={colors}
          />
        </View>

        {/* Settings */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Settings
        </Text>

        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <MenuItem
            icon={<Settings size={20} color="#007A53" />}
            title="Settings"
            subtitle="App preferences"
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <MenuItem
            icon={<HelpCircle size={20} color="#FF6720" />}
            title="Help & Support"
            subtitle="Get assistance"
            colors={colors}
          />
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogOut}
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.surface,
              borderColor: "#DA291C",
            },
          ]}
        >
          <LogOut size={19} color="#DA291C" />

          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.muted }]}>
          Version 1.0.0
        </Text>
      </ScrollView>
    </ThemedView>
  );
};

const InfoRow = ({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: any;
}) => {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.background }]}>
        {icon}
      </View>

      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>

        <Text
          style={[styles.infoValue, { color: colors.headline }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

const MenuItem = ({
  icon,
  title,
  subtitle,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  colors: any;
}) => {
  return (
    <Pressable style={styles.menuItem}>
      <View style={[styles.menuIcon, { backgroundColor: colors.background }]}>
        {icon}
      </View>

      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, { color: colors.headline }]}>
          {title}
        </Text>

        <Text style={[styles.menuSubtitle, { color: colors.muted }]}>
          {subtitle}
        </Text>
      </View>

      <ChevronRight size={19} color={colors.muted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  smallTitle: {
    fontSize: 14,
    marginBottom: 3,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
  },

  editButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },

  name: {
    fontSize: 19,
    fontWeight: "800",
  },

  email: {
    fontSize: 12,
    marginTop: 4,
  },

  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F5EF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 7,
  },

  memberText: {
    color: "#007A53",
    fontSize: 10,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },

  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 25,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoLabel: {
    fontSize: 11,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  divider: {
    height: 1,
  },

  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 25,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  menuContent: {
    flex: 1,
    marginLeft: 12,
  },

  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  menuSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  logoutButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },

  logoutText: {
    color: "#DA291C",
    fontSize: 14,
    fontWeight: "700",
  },

  version: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 18,
  },
});

export default Profile;
