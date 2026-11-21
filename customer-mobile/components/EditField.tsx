import { StyleSheet, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "@/constants/theme";

// --------------------------------------------------
// EDIT FIELD
// --------------------------------------------------
// Reusable labelled text input used inside all profile-related modals.

export type EditFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  secureTextEntry?: boolean;
  colors: ThemeColors;
};

const EditField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false,
  colors,
}: EditFieldProps) => (
  <View style={styles.wrapper}>
    <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      style={[
        styles.input,
        {
          color: colors.headline,
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    />
  </View>
);

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },

  label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },

  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
});

export default EditField;
