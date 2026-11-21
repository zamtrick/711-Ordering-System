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
import { Check, X } from "lucide-react-native";
import EditField from "@/components/EditField";
import type { ThemeColors } from "@/constants/theme";
import { modalStyles } from "./modalShared";

// --------------------------------------------------
// EDIT PROFILE MODAL
// --------------------------------------------------

export type EditForm = {
  firstname: string;
  lastname: string;
  phone: string;
  address: string;
  age: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  form: EditForm;
  setForm: Dispatch<SetStateAction<EditForm>>;
  saving: boolean;
  onSave: () => void;
  colors: ThemeColors;
};

export default function EditProfileModal({
  visible,
  onClose,
  form,
  setForm,
  saving,
  onSave,
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
              Edit Profile
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
              label="First Name"
              value={form.firstname}
              onChangeText={(v) => setForm((f) => ({ ...f, firstname: v }))}
              placeholder="Enter first name"
              colors={colors}
            />
            <EditField
              label="Last Name"
              value={form.lastname}
              onChangeText={(v) => setForm((f) => ({ ...f, lastname: v }))}
              placeholder="Enter last name"
              colors={colors}
            />
            <EditField
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="e.g. +63 917 123 4567"
              keyboardType="phone-pad"
              colors={colors}
            />
            <EditField
              label="Age"
              value={form.age}
              onChangeText={(v) => setForm((f) => ({ ...f, age: v }))}
              placeholder="Enter your age"
              keyboardType="numeric"
              colors={colors}
            />
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[modalStyles.saveButton, { opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Check size={18} color="#fff" />
              )}
              <Text style={modalStyles.saveButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
