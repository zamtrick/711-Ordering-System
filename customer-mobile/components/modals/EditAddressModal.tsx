import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import EditField from "@/components/EditField";
import DeliveryMapPicker, {
  type DeliveryCoords,
} from "@/components/DeliveryMapPicker";
import type { ThemeColors } from "@/constants/theme";
import { modalStyles } from "./modalShared";

// --------------------------------------------------
// EDIT ADDRESS MODAL
// --------------------------------------------------

type Props = {
  visible: boolean;
  onClose: () => void;
  label: string;
  setLabel: (v: string) => void;
  address: string;
  onMapChange: (address: string, coords: DeliveryCoords | null) => void;
  saving: boolean;
  onUpdate: () => void;
  colors: ThemeColors;
};

export default function EditAddressModal({
  visible,
  onClose,
  label,
  setLabel,
  address,
  onMapChange,
  saving,
  onUpdate,
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
              Edit Address
            </Text>
            <Pressable
              onPress={onClose}
              style={[modalStyles.closeBtn, { backgroundColor: colors.background }]}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <EditField
            label="Label (e.g. Home, Work)"
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Home"
            colors={colors}
          />
          {/* Map picker — same as checkout and the add modal. The pin
              starts wherever GPS lands; adjusting it updates the address
              text and saves the exact coordinates with the address. */}
          <DeliveryMapPicker
            value={address}
            onChange={onMapChange}
            colors={colors}
          />
          <Pressable
            onPress={onUpdate}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
