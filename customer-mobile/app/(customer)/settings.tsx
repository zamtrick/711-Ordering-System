import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from "react-native";
import {
  Sun,
  Moon,
  Smartphone,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  ChevronLeft,
  Palette,
} from "lucide-react-native";
import { router } from "expo-router";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import { useSettings, type ThemePreference } from "@/context/SettingsContext";

// --------------------------------------------------
// THEME OPTIONS
// --------------------------------------------------

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: (color: string) => React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: (color) => <Sun size={20} color={color} />,
  },
  {
    value: "dark",
    label: "Dark",
    icon: (color) => <Moon size={20} color={color} />,
  },
  {
    value: "system",
    label: "System",
    icon: (color) => <Smartphone size={20} color={color} />,
  },
];

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const SettingsScreen = () => {
  const {
    themePreference,
    setThemePreference,
    notificationsEnabled,
    setNotificationsEnabled,
    soundEnabled,
    setSoundEnabled,
  } = useSettings();

  // Resolve theme for this screen's own UI
  const { theme, scheme: resolvedScheme } = useTheme();
  const { colors } = theme;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ChevronLeft size={22} color={colors.headline} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>
              Preferences
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>
              Settings
            </Text>
          </View>
        </View>

        {/* ── APPEARANCE ───────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Palette size={16} color="#007A53" />
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            Appearance
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.muted }]}>
            Theme
          </Text>

          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themePreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemePreference(opt.value)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: active
                        ? "#007A53"
                        : colors.background,
                      borderColor: active ? "#007A53" : colors.border,
                    },
                  ]}
                >
                  {opt.icon(active ? "#FFFFFF" : colors.muted)}
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: active ? "#FFFFFF" : colors.headline },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Active theme preview pill */}
          <View
            style={[
              styles.previewPill,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.previewDot,
                {
                  backgroundColor:
                    resolvedScheme === "dark" ? "#A0A0A0" : "#007A53",
                },
              ]}
            />
            <Text style={[styles.previewText, { color: colors.muted }]}>
              Currently using{" "}
              <Text style={{ fontWeight: "700", color: colors.headline }}>
                {resolvedScheme === "dark" ? "Dark" : "Light"} mode
              </Text>
              {themePreference === "system" ? " (from system)" : ""}
            </Text>
          </View>
        </View>

        {/* ── NOTIFICATIONS ────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Bell size={16} color="#007A53" />
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            Notifications
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ToggleRow
            icon={
              notificationsEnabled ? (
                <Bell size={20} color="#007A53" />
              ) : (
                <BellOff size={20} color={colors.muted} />
              )
            }
            title="Push Notifications"
            subtitle="Order updates, promotions, and alerts"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            colors={colors}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <ToggleRow
            icon={
              soundEnabled ? (
                <Volume2 size={20} color="#007A53" />
              ) : (
                <VolumeX size={20} color={colors.muted} />
              )
            }
            title="Sound & Haptics"
            subtitle="Play sounds and vibrations on actions"
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            colors={colors}
          />
        </View>

        {/* ── ABOUT ────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Smartphone size={16} color="#007A53" />
          <Text style={[styles.sectionTitle, { color: colors.headline }]}>
            About
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AboutRow label="App Version" value="1.0.0" colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <AboutRow label="Build" value="Expo SDK 57" colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <AboutRow label="Platform" value="React Native" colors={colors} />
        </View>

        {/* Brand accent */}
        <View style={styles.brandAccent}>
          <View style={[styles.accentBar, { backgroundColor: "#007A53" }]} />
          <View style={[styles.accentBar, { backgroundColor: "#FF6720" }]} />
          <View style={[styles.accentBar, { backgroundColor: "#DA291C" }]} />
        </View>
      </ScrollView>
    </ThemedView>
  );
};

// --------------------------------------------------
// TOGGLE ROW
// --------------------------------------------------

const ToggleRow = ({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
}) => (
  <View style={styles.toggleRow}>
    <View
      style={[styles.toggleIcon, { backgroundColor: colors.background }]}
    >
      {icon}
    </View>
    <View style={styles.toggleContent}>
      <Text style={[styles.toggleTitle, { color: colors.headline }]}>
        {title}
      </Text>
      <Text style={[styles.toggleSubtitle, { color: colors.muted }]}>
        {subtitle}
      </Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
      thumbColor={value ? "#007A53" : "#9CA3AF"}
    />
  </View>
);

// --------------------------------------------------
// ABOUT ROW
// --------------------------------------------------

const AboutRow = ({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) => (
  <View style={styles.aboutRow}>
    <Text style={[styles.aboutLabel, { color: colors.muted }]}>{label}</Text>
    <Text style={[styles.aboutValue, { color: colors.headline }]}>{value}</Text>
  </View>
);

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
  },

  smallTitle: {
    fontSize: 13,
    marginBottom: 2,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 11,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },

  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },

  // Theme picker
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },

  themeOption: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  themeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },

  previewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },

  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  previewText: {
    fontSize: 12,
  },

  // Toggle rows
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },

  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  toggleContent: {
    flex: 1,
  },

  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  toggleSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  divider: {
    height: 1,
    marginVertical: 2,
  },

  // About rows
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },

  aboutLabel: {
    fontSize: 13,
  },

  aboutValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Brand accent
  brandAccent: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 8,
  },

  accentBar: {
    width: 35,
    height: 4,
    borderRadius: 10,
  },
});

export default SettingsScreen;
