import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  useColorScheme,
} from "react-native";
import { Link } from "expo-router";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react-native";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";

const Register = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

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
              <Text style={styles.logoText}>7</Text>
            </View>

            <Text style={styles.headerTitle}>Create Account</Text>

            <Text style={styles.headerSubtitle}>Join us and get started</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={[styles.formTitle, { color: colors.headline }]}>
              Sign up
            </Text>

            <Text style={[styles.formSubtitle, { color: colors.muted }]}>
              Create your account to continue
            </Text>

            {/* Name */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.headline }]}>
                Full Name
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: nameFocused ? "#FF6720" : colors.border,
                  },
                ]}
              >
                <User
                  size={20}
                  color={nameFocused ? "#FF6720" : colors.muted}
                />

                <TextInput
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={[styles.input, { color: colors.headline }]}
                />
              </View>
            </View>

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
                  placeholder="Create a password"
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

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.headline }]}>
                Confirm Password
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: confirmFocused ? "#FF6720" : colors.border,
                  },
                ]}
              >
                <Lock
                  size={20}
                  color={confirmFocused ? "#FF6720" : colors.muted}
                />

                <TextInput
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  style={[styles.input, { color: colors.headline }]}
                />

                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={colors.muted} />
                  ) : (
                    <Eye size={20} color={colors.muted} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Register */}
            <Pressable
              style={[
                styles.registerButton,
                {
                  backgroundColor: "#007A53",
                },
              ]}
            >
              <Text style={styles.registerButtonText}>Create Account</Text>

              <ArrowRight size={20} color="#FFFFFF" />
            </Pressable>

            {/* Login */}
            <View style={styles.loginContainer}>
              <Text style={{ color: colors.muted }}>
                Already have an account?
              </Text>

              <Link
                href="/(auth)/login"
                style={[styles.loginText, { color: "#007A53" }]}
              >
                Login
              </Link>
            </View>

            {/* Accent */}
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
    paddingTop: 58,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    alignItems: "center",
  },

  decorations: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
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
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  logoText: {
    color: "#007A53",
    fontSize: 31,
    fontWeight: "900",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    marginTop: 5,
  },

  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 23,
  },

  formTitle: {
    fontSize: 24,
    fontWeight: "800",
  },

  formSubtitle: {
    fontSize: 14,
    marginTop: 5,
    marginBottom: 20,
  },

  field: {
    marginBottom: 13,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 7,
  },

  inputContainer: {
    height: 52,
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

  registerButton: {
    height: 55,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 7,
  },

  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 21,
  },

  loginText: {
    fontWeight: "700",
  },

  bottomAccent: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 22,
  },

  accent: {
    width: 35,
    height: 4,
    borderRadius: 10,
  },
});

export default Register;
