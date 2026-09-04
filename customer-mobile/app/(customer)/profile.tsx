import { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
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
  X,
  Check,
} from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import { router } from "expo-router";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type ProfileData = {
  user: {
    firstname: string;
    lastname: string;
    email: string;
  };
  phone: string;
  address: string;
  age: string;
};

type EditForm = {
  firstname: string;
  lastname: string;
  phone: string;
  address: string;
  age: string;
};

// --------------------------------------------------
// PROFILE SCREEN
// --------------------------------------------------

const Profile = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  // --------------------------------------------------
  // PROFILE STATE
  // --------------------------------------------------

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // EDIT MODAL STATE
  // --------------------------------------------------

  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstname: "",
    lastname: "",
    phone: "",
    address: "",
    age: "",
  });
  const [saving, setSaving] = useState(false);

  // --------------------------------------------------
  // LOGOUT STATE
  // --------------------------------------------------

  const [loggingOut, setLoggingOut] = useState(false);

  // --------------------------------------------------
  // GET CUSTOMER PROFILE
  // --------------------------------------------------

  const fetchProfile = async () => {
    try {
      const response = await api.get("/customer/profile/me");

      if (response.data?.data) {
        setProfile(response.data.data);
      }
    } catch (error: any) {
      console.log("Get profile error:", error);

      if (error?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // --------------------------------------------------
  // OPEN EDIT MODAL — pre-fill form with current data
  // --------------------------------------------------

  const openEdit = () => {
    setEditForm({
      firstname: profile?.user?.firstname ?? "",
      lastname: profile?.user?.lastname ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
      age: profile?.age ?? "",
    });
    setEditVisible(true);
  };

  // --------------------------------------------------
  // SAVE PROFILE
  // --------------------------------------------------

  const handleSave = async () => {
    const { firstname, lastname, phone, address, age } = editForm;

    if (!firstname.trim() || !lastname.trim()) {
      Alert.alert("Validation", "First name and last name are required.");
      return;
    }

    try {
      setSaving(true);

      const response = await api.patch("/customer/profile/me", {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        phone: phone.trim(),
        address: address.trim(),
        age: age.trim(),
      });

      if (response.data?.data) {
        setProfile(response.data.data);
      }

      setEditVisible(false);
    } catch (error: any) {
      console.log("Update profile error:", error);

      const message =
        error?.response?.data?.message ?? "Failed to update profile.";
      Alert.alert("Error", message);

      if (error?.response?.status === 401) {
        router.replace("/(auth)/login");
      }
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogOut = async () => {
    try {
      setLoggingOut(true);
      await api.post("/auth/logout");
      router.replace("/(auth)/login");
    } catch (error: any) {
      console.log("Logout error:", error);
      router.replace("/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading profile...
        </Text>
      </ThemedView>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

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
            onPress={openEdit}
            style={[
              styles.editButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pencil size={19} color="#007A53" />
          </Pressable>
        </View>

        {/* ==================================================
            PROFILE CARD
        ================================================== */}

        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: "#E8F5EF" }]}>
            <User size={34} color="#007A53" />
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.headline }]}>
              {profile?.user?.firstname ?? "—"}{" "}
              {profile?.user?.lastname ?? ""}
            </Text>

            <Text style={[styles.email, { color: colors.muted }]}>
              {profile?.user?.email ?? "—"}
            </Text>

            <View style={styles.memberBadge}>
              <Text style={styles.memberText}>Customer</Text>
            </View>
          </View>
        </View>

        {/* ==================================================
            PERSONAL INFORMATION
        ================================================== */}

        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Personal Information
        </Text>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow
            icon={<User size={19} color="#007A53" />}
            label="First Name"
            value={profile?.user?.firstname ?? "—"}
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <InfoRow
            icon={<User size={19} color="#007A53" />}
            label="Last Name"
            value={profile?.user?.lastname ?? "—"}
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <InfoRow
            icon={<Mail size={19} color="#007A53" />}
            label="Email"
            value={profile?.user?.email ?? "—"}
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <InfoRow
            icon={<Phone size={19} color="#007A53" />}
            label="Phone"
            value={profile?.phone || "Not set"}
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <InfoRow
            icon={<MapPin size={19} color="#007A53" />}
            label="Address"
            value={profile?.address || "Not set"}
            colors={colors}
          />
        </View>

        {/* ==================================================
            MY ACTIVITY
        ================================================== */}

        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          My Activity
        </Text>

        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MenuItem
            icon={<Package size={20} color="#007A53" />}
            title="My Orders"
            subtitle="View your order history"
            onPress={() => router.push("/(customer)/orders")}
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

        {/* ==================================================
            SETTINGS
        ================================================== */}

        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Settings
        </Text>

        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
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

        {/* ==================================================
            LOGOUT
        ================================================== */}

        <Pressable
          onPress={handleLogOut}
          disabled={loggingOut}
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.surface,
              borderColor: "#DA291C",
              opacity: loggingOut ? 0.6 : 1,
            },
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#DA291C" />
          ) : (
            <LogOut size={19} color="#DA291C" />
          )}
          <Text style={styles.logoutText}>
            {loggingOut ? "Logging out..." : "Logout"}
          </Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.muted }]}>
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* ==================================================
          EDIT MODAL
      ================================================== */}

      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.headline }]}>
                Edit Profile
              </Text>

              <Pressable
                onPress={() => setEditVisible(false)}
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: colors.background },
                ]}
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* First Name */}
              <EditField
                label="First Name"
                value={editForm.firstname}
                onChangeText={(v) =>
                  setEditForm((f) => ({ ...f, firstname: v }))
                }
                placeholder="Enter first name"
                colors={colors}
              />

              {/* Last Name */}
              <EditField
                label="Last Name"
                value={editForm.lastname}
                onChangeText={(v) =>
                  setEditForm((f) => ({ ...f, lastname: v }))
                }
                placeholder="Enter last name"
                colors={colors}
              />

              {/* Phone */}
              <EditField
                label="Phone"
                value={editForm.phone}
                onChangeText={(v) =>
                  setEditForm((f) => ({ ...f, phone: v }))
                }
                placeholder="e.g. +63 917 123 4567"
                keyboardType="phone-pad"
                colors={colors}
              />

              {/* Address */}
              <EditField
                label="Address"
                value={editForm.address}
                onChangeText={(v) =>
                  setEditForm((f) => ({ ...f, address: v }))
                }
                placeholder="Enter your address"
                colors={colors}
              />

              {/* Age */}
              <EditField
                label="Age"
                value={editForm.age}
                onChangeText={(v) =>
                  setEditForm((f) => ({ ...f, age: v }))
                }
                placeholder="Enter your age"
                keyboardType="numeric"
                colors={colors}
              />

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.saveButton,
                  { opacity: saving ? 0.7 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Check size={18} color="#fff" />
                )}
                <Text style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
};

// ==================================================
// EDIT FIELD
// ==================================================

const EditField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  colors: any;
}) => (
  <View style={styles.editFieldWrapper}>
    <Text style={[styles.editFieldLabel, { color: colors.muted }]}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      style={[
        styles.editFieldInput,
        {
          color: colors.headline,
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    />
  </View>
);

// ==================================================
// INFO ROW
// ==================================================

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
}) => (
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

// ==================================================
// MENU ITEM
// ==================================================

const MenuItem = ({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress?: () => void;
  colors: any;
}) => (
  <Pressable style={styles.menuItem} onPress={onPress}>
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

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

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

  // --------------------------------------------------
  // MODAL
  // --------------------------------------------------

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // --------------------------------------------------
  // EDIT FIELD
  // --------------------------------------------------

  editFieldWrapper: {
    marginBottom: 16,
  },

  editFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },

  editFieldInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },

  saveButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default Profile;
