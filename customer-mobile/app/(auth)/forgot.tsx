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
import { router } from "expo-router";
import { Mail, ArrowRight, ChevronLeft } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import logo from "@/assets/logos/711logo.png";
import api from "@/api/axios";

// Forgot password — step 1: collect the email, issue a reset code,
// then hand off to the shared OTP screen (purpose=reset).
const Forgot = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert("Missing Information", "Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/password/forgot", { email: cleanEmail });
      // Generic server message either way — always advance to code entry.
      router.push({
        pathname: "/(auth)/verify",
        params: { email: cleanEmail, purpose: "reset" },
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        "Something went wrong. Please try again.";
      Alert.alert("Request Failed", message);
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
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ChevronLeft size={22} color={colors.headline} />
          </Pressable>

          <Image source={logo} style={styles.logo} resizeMode="contain" />

          <Text style={[styles.title, { color: colors.headline }]}>
            Forgot Password
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Enter your account email and we will send you a reset code.
          </Text>

          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.surface,
                borderColor: emailFocused ? "#007A53" : colors.border,
              },
            ]}
          >
            <Mail size={18} color={colors.muted} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
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
              <>
                <Text style={styles.submitText}>Send Reset Code</Text>
                <ArrowRight size={18} color="#fff" />
              </>
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
  backBtn: {
    position: "absolute",
    top: 24,
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 18,
  },
  input: { flex: 1, fontSize: 15 },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default Forgot;
