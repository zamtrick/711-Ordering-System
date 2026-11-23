import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Wrench } from "lucide-react-native";
import ThemedView from "@/components/ThemedView";
import type { ThemeColors } from "@/constants/theme";

// --------------------------------------------------
// MAINTENANCE SCREEN
// --------------------------------------------------
// Full-screen overlay shown when the server is in maintenance mode.
// The "Try again" button lets users re-check without force-quitting the app.

type Props = {
  message: string;
  onRetry: () => void;
  retrying: boolean;
  colors: ThemeColors;
};

export default function MaintenanceScreen({ message, onRetry, retrying, colors }: Props) {
  return (
    <ThemedView style={styles.screen}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: "#FFF7E6" }]}>
          <Wrench size={40} color="#FF6720" />
        </View>

        <Text style={[styles.title, { color: colors.headline }]}>
          Down for Maintenance
        </Text>

        <Text style={[styles.message, { color: colors.muted }]}>
          {message}
        </Text>

        <Pressable
          onPress={onRetry}
          disabled={retrying}
          style={[
            styles.retryBtn,
            { backgroundColor: "#007A53", opacity: retrying ? 0.7 : 1 },
          ]}
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : null}
          <Text style={styles.retryText}>
            {retrying ? "Checking…" : "Try Again"}
          </Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
