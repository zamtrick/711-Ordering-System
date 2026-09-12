import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal as RNModal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Star, X } from "lucide-react-native";
import useTheme from "@/hooks/useTheme";

// --------------------------------------------------
// ReviewModal
// --------------------------------------------------
// Star-picker + optional comment. Calls onSubmit(rating, comment) and
// closes itself; the parent owns the API call result.
// --------------------------------------------------

type Props = {
  visible: boolean;
  productName: string;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  initialRating?: number;
  initialComment?: string;
};

export default function ReviewModal({
  visible,
  productName,
  onClose,
  onSubmit,
  initialRating = 0,
  initialComment = "",
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;

  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState(false);
  const [resetKey, setResetKey] = useState("");

  // Reset whenever the modal re-opens for a different product
  const openKey = `${productName}-${String(visible)}`;
  if (openKey !== resetKey) {
    setResetKey(openKey);
    setRating(initialRating);
    setComment(initialComment);
  }

  const handleSubmit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.headline }]} numberOfLines={1}>
              Rate {productName}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} disabled={submitting}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: colors.muted }]}>
            How was this product?
          </Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setRating(value)}
                hitSlop={6}
                disabled={submitting}
              >
                <Star
                  size={38}
                  color={value <= rating ? "#FF6720" : colors.border}
                  fill={value <= rating ? "#FF6720" : "transparent"}
                />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.ratingLabel, { color: colors.muted }]}>
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating] ?? ""}
          </Text>

          <TextInput
            style={[
              styles.commentInput,
              {
                color: colors.headline,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            placeholder="Tell us more (optional)"
            placeholderTextColor={colors.muted}
            multiline
            value={comment}
            onChangeText={setComment}
            maxLength={1000}
            editable={!submitting}
          />

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={[styles.cancelText, { color: colors.headline }]}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: rating < 1 ? 0.5 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={rating < 1 || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  sheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  title: {
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
  },

  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },

  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },

  ratingLabel: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    minHeight: 16,
  },

  commentInput: {
    marginTop: 14,
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
    fontSize: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  button: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtn: {
    borderWidth: 1,
  },

  cancelText: {
    fontSize: 14,
    fontWeight: "700",
  },

  submitBtn: {},

  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
