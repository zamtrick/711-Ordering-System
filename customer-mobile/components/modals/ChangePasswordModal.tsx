import type { Dispatch, SetStateAction } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Lock, X } from "lucide-react-native";
import EditField from "@/components/EditField";
import type { ThemeColors } from "@/constants/theme";
import { modalStyles } from "./modalShared";

// --------------------------------------------------
// CHANGE PASSWORD MODAL
// --------------------------------------------------

export type PwForm = {
  current: string;
  next: string;
  confirm: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  form: PwForm;
  setForm: Dispatch<SetStateAction<PwForm>>;
  saving: boolean;
  onChange: () => void;
  colors: ThemeColors;
};

export default function ChangePasswordModal({
  visible,
  onClose,
  form,
  setForm,
  saving,
  onChange,
  colors,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[modalStyles.sheet, { backgroundColor: colors.surface }]}>
          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: colors.headline }]}>
              Change Password
            </Text>
            <Pressable
              onPress={onClose}
              style={[modalStyles.closeBtn, { backgroundColor: colors.background }]}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <EditField
              label="Current Password"
              value={form.current}
              onChangeText={(v) => setForm((f) => ({ ...f, current: v }))}
              placeholder="Enter current password"
              secureTextEntry
              colors={colors}
            />
            <EditField
              label="New Password"
              value={form.next}
              onChangeText={(v) => setForm((f) => ({ ...f, next: v }))}
              placeholder="At least 8 characters"
              secureTextEntry
              colors={colors}
            />
            <EditField
              label="Confirm New Password"
              value={form.confirm}
              onChangeText={(v) => setForm((f) => ({ ...f, confirm: v }))}
              placeholder="Repeat new password"
              secureTextEntry
              colors={colors}
            />
            <Pressable
              onPress={onChange}
              disabled={saving}
              style={[modalStyles.saveButton, { opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Lock size={18} color="#fff" />
              )}
              <Text style={modalStyles.saveButtonText}>
                {saving ? "Saving..." : "Change Password"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
