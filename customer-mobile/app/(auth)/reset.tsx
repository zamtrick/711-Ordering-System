import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Lock, Eye, EyeOff, Check } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import logo from "@/assets/logos/711logo.png";
import api from "@/api/axios";

// Forgot password — step 2: the OTP screen hands over the confirmed
// email + code; this screen collects the new password and submits
// everything together (the code authorizes the change, then dies).
const Reset = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const { email, code } = useLocalSearchParams<{
    email?: string;
    code?: string;
  }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !code) {
      Alert.alert("Session Expired", "Please request a new reset code.", [
        { text: "OK", onPress: () => router.replace("/(auth)/forgot") },
      ]);
      return;
    }
    if (password.length < 8) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 8 characters.",
      );
      return;
    }
    if (password !== confirm) {
      Alert.alert("Mismatch", "The passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/password/reset", {
        email,
        code,
        newPassword: password,
      });
      Alert.alert("Password Reset", "Your password has been updated.", [
        { text: "Log In", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        "Reset failed. Your code may have expired.";
      Alert.alert("Reset Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ThemedView style={styles.screen}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.container}
          enableOnAndroid
          enableAutomaticScroll
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <Image source={logo} style={styles.logo} resizeMode="contain" />

          <Text style={[styles.title, { color: colors.headline }]}>
            New Password
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Choose a new password for{"\n"}
            <Text style={{ fontWeight: "700", color: colors.headline }}>
              {email ?? "your account"}
            </Text>
          </Text>

          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Lock size={18} color={colors.muted} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              style={[styles.input, { color: colors.headline }]}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)}>
              {showPassword ? (
                <EyeOff size={18} color={colors.muted} />
              ) : (
                <Eye size={18} color={colors.muted} />
              )}
            </Pressable>
          </View>

          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Check size={18} color={colors.muted} />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              style={[styles.input, { color: colors.headline }]}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>Update Password</Text>
            )}
          </Pressable>
        </KeyboardAwareScrollView>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 120,
    height: 60,
    marginBottom: 20,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 26,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 14,
  },
  input: { flex: 1, fontSize: 15 },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default Reset;
