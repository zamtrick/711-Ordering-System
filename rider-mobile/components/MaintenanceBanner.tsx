import { StyleSheet, Text, View } from "react-native";
import { Wrench } from "lucide-react-native";

// --------------------------------------------------
// MAINTENANCE BANNER
// --------------------------------------------------
// Shown at the top of the rider app when the platform is in maintenance.
// Riders are not blocked — they can still complete in-flight deliveries —
// but this banner keeps them informed.

type Props = {
  message: string;
};

export default function MaintenanceBanner({ message }: Props) {
  return (
    <View style={styles.banner}>
      <Wrench size={15} color="#fff" />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF6720",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
});
