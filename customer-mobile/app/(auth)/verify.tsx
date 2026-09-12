import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import logo from "@/assets/logos/711logo.png";
import api from "@/api/axios";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

// --------------------------------------------------
// OTP SCREEN
// --------------------------------------------------
// Shared by registration ("verify") and password reset ("reset").
// Params: email, purpose ("verify" | "reset"), returnTo (verify only).
// Verify success -> returnTo ?? /(customer).
// Reset success -> /(auth)/reset with the confirmed code.

const Verify = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const params = useLocalSearchParams<{
    email?: string;
    purpose?: string;
    returnTo?: string;
  }>();
  const purpose = params.purpose === "reset" ? "reset" : "verify";

  const [email, setEmail] = useState(params.email ?? "");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Email can be omitted when the user has a session (post-register) —
  // fall back to the logged-in profile.
  useEffect(() => {
    if (params.email) return;
    let mounted = true;
    api
      .get("/auth/me")
      .then((res) => {
        if (mounted && res.data?.data?.email) setEmail(res.data.data.email);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [params.email]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const code = digits.join("");

  const handleChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit the moment the code is complete.
    if (next.join("").length === CODE_LENGTH && !verifying) {
      void handleVerify(next.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    try {
      setResending(true);
      const path =
        purpose === "reset" ? "/auth/password/forgot" : "/auth/verify/request";
      await api.post(path, { email });
      setDigits(Array(CODE_LENGTH).fill(""));
      setCooldown(RESEND_SECONDS);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        "Could not resend the code. Please try again.";
      Alert.alert("Resend Failed", message);
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (submitted?: string) => {
    const value = (submitted ?? code).trim();
    if (!email) {
      Alert.alert("Missing Email", "Please log in again to verify.");
      return;
    }
    if (value.length !== CODE_LENGTH) {
      Alert.alert("Incomplete Code", "Please enter all 6 digits.");
      return;
    }
    try {
      setVerifying(true);
      if (purpose === "reset") {
        // Code is confirmed on the next screen together with the password.
        router.push({
          pathname: "/(auth)/reset",
          params: { email, code: value },
        });
        return;
      }
      await api.post("/auth/verify/confirm", { email, code: value });
      router.replace((params.returnTo || "/(customer)") as any);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        "Verification failed. Please try again.";
      Alert.alert("Verification Failed", message);
    } finally {
      setVerifying(false);
    }
  };

  // Auto-submit is triggered from handleChange when the code completes.

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

          <View
            style={[
              styles.iconWrap,
              { backgroundColor: "#E8F5EF" },
            ]}
          >
            <MailCheck size={30} color="#007A53" />
          </View>

          <Text style={[styles.title, { color: colors.headline }]}>
            {purpose === "reset" ? "Reset Code" : "Check Your Email"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ fontWeight: "700", color: colors.headline }}>
              {email || "your email"}
            </Text>
          </Text>

          <View style={styles.codeRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={d}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, i)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!verifying}
                style={[
                  styles.codeBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: d ? "#007A53" : colors.border,
                    color: colors.headline,
                  },
                ]}
              />
            ))}
          </View>

          {verifying && (
            <ActivityIndicator
              size="small"
              color="#007A53"
              style={styles.spinner}
            />
          )}

          <View style={styles.resendRow}>
            <Text style={[styles.resendLabel, { color: colors.muted }]}>
              Didn{"'"}t get the code?
            </Text>
            {cooldown > 0 ? (
              <Text style={[styles.cooldown, { color: colors.muted }]}>
                Resend in {cooldown}s
              </Text>
            ) : resending ? (
              <ActivityIndicator size="small" color="#007A53" />
            ) : (
              <Pressable onPress={handleResend}>
                <Text style={styles.resendLink}>Resend</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => void handleVerify()}
            disabled={verifying || code.length !== CODE_LENGTH}
            style={[
              styles.submitBtn,
              { opacity: verifying || code.length !== CODE_LENGTH ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.submitText}>
              {verifying ? "Verifying…" : "Verify"}
            </Text>
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
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: { width: 120, height: 60, marginBottom: 20 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 26 },
  codeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  codeBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  spinner: { marginBottom: 8 },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  resendLabel: { fontSize: 13 },
  cooldown: { fontSize: 13 },
  resendLink: { fontSize: 13, fontWeight: "700", color: "#007A53" },
  submitBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: "#007A53",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default Verify;
