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
import { Link, router } from "expo-router";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import logo from "@/assets/logos/711logo.png";
import api from "@/api/axios";

const Login = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Remove unnecessary spaces
    const cleanEmail = email.trim();

    // Basic validation
    if (!cleanEmail || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter your email and password.",
      );
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: cleanEmail,
        password,
      });

      console.log("Login response:", response.data);
      router.replace("/(customer)");
    } catch (error: any) {
      console.log("Login error:", error);

      // Unverified accounts get a session-less 403 — send them to OTP.
      if (error?.response?.status === 403 && error?.response?.data?.email) {
        router.replace({
          pathname: "/(auth)/verify",
          params: {
            email: error.response.data.email,
            purpose: "verify",
          },
        });
        return;
      }

      const message =
        error?.response?.data?.message ||
        "Unable to login. Please check your email and password.";

      Alert.alert("Login Failed", message);
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
          extraScrollHeight={30}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: "#007A53",
              },
            ]}
          >
            <View style={styles.decorations}>
              <View
                style={[styles.orangeLine, { backgroundColor: "#FF6720" }]}
              />

              <View style={[styles.redLine, { backgroundColor: "#DA291C" }]} />
            </View>

            {/* Logo */}
            <View style={styles.logo}>
              <Image style={styles.logoImage} source={logo} />
            </View>

            <Text style={styles.headerTitle}>Welcome Back</Text>

            <Text style={styles.headerSubtitle}>Login to continue</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={[styles.formTitle, { color: colors.headline }]}>
              Sign in
            </Text>

            <Text style={[styles.formSubtitle, { color: colors.muted }]}>
              Enter your account details below
            </Text>

            {/* Email */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.headline }]}>
                Email
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: emailFocused ? "#FF6720" : colors.border,
                  },
                ]}
              >
                <Mail
                  size={20}
                  color={emailFocused ? "#FF6720" : colors.muted}
                />

                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={[styles.input, { color: colors.headline }]}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.headline }]}>
                Password
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: passwordFocused ? "#FF6720" : colors.border,
                  },
                ]}
              >
                <Lock
                  size={20}
                  color={passwordFocused ? "#FF6720" : colors.muted}
                />

                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={[styles.input, { color: colors.headline }]}
                />

                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.muted} />
                  ) : (
                    <Eye size={20} color={colors.muted} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Forgot Password */}
            <View style={styles.forgotRow}>
              <Pressable onPress={() => router.push("/(auth)/forgot")}>
                <Text style={[styles.forgot, { color: "#007A53" }]}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>

            {/* Login Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={[
                styles.loginButton,
                {
                  backgroundColor: loading ? "#6FAE98" : "#007A53",
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Login</Text>

                  <ArrowRight size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* Register */}
            <View style={styles.registerContainer}>
              <Text style={{ color: colors.muted }}>
                Don{"'"}t have an account?
              </Text>

              <Link
                href="/(auth)/register"
                style={[styles.registerText, { color: "#007A53" }]}
              >
                <Text style={[styles.registerText, { color: "#007A53" }]}>
                  Register
                </Text>
              </Link>
            </View>

            {/* Brand Accent */}
            <View style={styles.bottomAccent}>
              <View style={[styles.accent, { backgroundColor: "#007A53" }]} />

              <View style={[styles.accent, { backgroundColor: "#FF6720" }]} />

              <View style={[styles.accent, { backgroundColor: "#DA291C" }]} />
            </View>
          </View>
        </KeyboardAwareScrollView>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
  },

  header: {
    paddingTop: 65,
    paddingBottom: 38,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    alignItems: "center",
  },

  decorations: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },

  orangeLine: {
    width: 42,
    height: 5,
    borderRadius: 10,
  },

  redLine: {
    width: 25,
    height: 5,
    borderRadius: 10,
  },

  logo: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    overflow: "hidden",
  },

  logoImage: {
    width: 70,
    height: 70,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    marginTop: 6,
  },

  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 27,
    paddingBottom: 30,
  },

  formTitle: {
    fontSize: 24,
    fontWeight: "800",
  },

  formSubtitle: {
    fontSize: 14,
    marginTop: 5,
    marginBottom: 24,
  },

  field: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },

  inputContainer: {
    height: 54,
    borderWidth: 1.2,
    borderRadius: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
  },

  forgotRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: -4,
    marginBottom: 22,
  },

  forgot: {
    fontSize: 14,
    fontWeight: "600",
  },

  loginButton: {
    height: 55,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 25,
  },

  registerText: {
    fontWeight: "700",
  },

  bottomAccent: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 28,
  },

  accent: {
    width: 35,
    height: 4,
    borderRadius: 10,
  },
});

export default Login;
