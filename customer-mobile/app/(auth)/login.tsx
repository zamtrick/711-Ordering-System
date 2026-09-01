import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  TouchableWithoutFeedback, //use for remove keyboard
  Keyboard,
  Image,
} from "react-native";
import { Link } from "expo-router";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import logo from "@/assets/logos/711logo.png";

const Login = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ThemedView>
        <View style={styles.container}>
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

            <View style={styles.logo}>
              <Image style={{ width: 70, height: 70 }} source={logo} />
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
                  keyboardType="email-address"
                  autoCapitalize="none"
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
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={[styles.input, { color: colors.headline }]}
                />

                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={20} color={colors.muted} />
                  ) : (
                    <Eye size={20} color={colors.muted} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Forgot Password */}
            <Link
              href="/(auth)/login"
              style={[styles.forgot, { color: "#007A53" }]}
            >
              Forgot password?
            </Link>

            {/* Login Button */}
            <Pressable
              style={[
                styles.loginButton,
                {
                  backgroundColor: "#007A53",
                },
              ]}
            >
              <Text style={styles.loginButtonText}>Login</Text>

              <ArrowRight size={20} color="#FFFFFF" />
            </Pressable>

            {/* Register */}
            <View style={styles.registerContainer}>
              <Text style={{ color: colors.muted }}>
                Don't have an account?
              </Text>

              <Link
                href="/(auth)/register"
                style={[styles.registerText, { color: "#007A53" }]}
              >
                Register
              </Link>
            </View>
            <View style={styles.registerContainer}>
              <Text style={{ color: colors.muted }}>
                Don't have an account?
              </Text>

              <Link
                href="/(customer)"
                style={[styles.registerText, { color: "#007A53" }]}
              >
                Dashboard
              </Link>
            </View>

            {/* Brand Accent */}
            <View style={styles.bottomAccent}>
              <View style={[styles.accent, { backgroundColor: "#007A53" }]} />

              <View style={[styles.accent, { backgroundColor: "#FF6720" }]} />

              <View style={[styles.accent, { backgroundColor: "#DA291C" }]} />
            </View>
          </View>
        </View>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },

  logoText: {
    color: "#007A53",
    fontSize: 32,
    fontWeight: "900",
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 27,
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

  forgot: {
    alignSelf: "flex-end",
    fontSize: 14,
    fontWeight: "600",
    marginTop: -4,
    marginBottom: 22,
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
