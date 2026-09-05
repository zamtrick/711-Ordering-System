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
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { LightTheme, DarkTheme } from "@/constants/Theme";
import ThemedView from "@/components/ThemedView";
import logo from "@/assets/logos/711logo.png";
import api from "@/api/axios";

const Register = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [lastNameFocused, setLastNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim();

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
      Alert.alert("Missing Information", "Please complete all fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 8 characters.",
      );
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/register", {
        firstname: cleanFirstName,
        lastname: cleanLastName,
        email: cleanEmail,
        password,
      });

      console.log("Register response:", response.data);

      Alert.alert("Registration Successful", "Your account has been created.", [
        {
          text: "Login",
          onPress: () => router.replace("/(auth)/login"),
        },
      ]);
    } catch (error: any) {
      console.log("Register error:", error);

      const message =
        error?.response?.data?.message ||
        "Unable to create your account. Please try again.";

      Alert.alert("Registration Failed", message);
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
                style={[
                  styles.orangeLine,
                  {
                    backgroundColor: "#FF6720",
                  },
                ]}
              />

              <View
                style={[
                  styles.redLine,
                  {
                    backgroundColor: "#DA291C",
                  },
                ]}
              />
            </View>

            {/* Logo */}
            <View style={styles.logo}>
              <Image style={styles.logoImage} source={logo} />
            </View>

            <Text style={styles.headerTitle}>Create Account</Text>

            <Text style={styles.headerSubtitle}>Join us as a rider</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text
              style={[
                styles.formTitle,
                {
                  color: colors.headline,
                },
              ]}
            >
              Sign up
            </Text>

            <Text
              style={[
                styles.formSubtitle,
                {
                  color: colors.muted,
                },
              ]}
            >
              Create your account to continue
            </Text>

            {/* First Name */}
            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.headline,
                  },
                ]}
              >
                First Name
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: firstNameFocused ? "#FF6720" : colors.border,
                  },
                ]}
              >
                <User
                  size={20}
                  color={firstNameFocused ? "#FF6720" : colors.muted}
                />

                <TextInput
                  placeholder="Enter your first name"
                  placeholderTextColor={colors.muted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFirstNameFocused(true)}
                  onBlur={() => setFirstNameFocused(false)}
                  style={[
                    styles.input,
                    {
                      color: colors.headline,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.headline,
                  },
                ]}
              >
                Last Name
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderColor: lastNameFocused ? "#FF6720" : colors.border,
                  },
                ]}
              >
                <User
                  size={20}
                  color={lastNameFocused ? "#FF6720" : colors.muted}
                />

                <TextInput
                  placeholder="Enter your last name"
                  placeholderTextColor={colors.muted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setLastNameFocused(true)}
                  onBlur={() => setLastNameFocused(false)}
                  style={[
                    styles.input,
                    {
                      color: colors.headline,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.headline,
                  },
                ]}
              >
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
                  style={[
                    styles.input,
                    {
                      color: colors.headline,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.headline,
                  },
                ]}
              >
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
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={[
                    styles.input,
                    {
                      color: colors.headline,
                    },
                  ]}
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

            {/* Register Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={[
                styles.registerButton,
                {
                  backgroundColor: loading ? "#6FAE98" : "#007A53",
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.registerButtonText}>Create Account</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* Login */}
            <View style={styles.loginContainer}>
              <Text
                style={{
                  color: colors.muted,
                }}
              >
                Already have an account?
              </Text>

              <Link
                href="/(auth)/login"
                style={[
                  styles.loginText,
                  {
                    color: "#007A53",
                  },
                ]}
              >
                Login
              </Link>
            </View>

            {/* Bottom Accent */}
            <View style={styles.bottomAccent}>
              <View
                style={[
                  styles.accent,
                  {
                    backgroundColor: "#007A53",
                  },
                ]}
              />

              <View
                style={[
                  styles.accent,
                  {
                    backgroundColor: "#FF6720",
                  },
                ]}
              />

              <View
                style={[
                  styles.accent,
                  {
                    backgroundColor: "#DA291C",
                  },
                ]}
              />
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

  container: {
    flexGrow: 1,
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
    overflow: "hidden",
  },

  logoImage: {
    width: 70,
    height: 70,
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
    paddingHorizontal: 24,
    paddingTop: 23,
    paddingBottom: 30,
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
