import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthButton } from "../../components/AuthButton";
import { signInWithApple, signInWithGoogle } from "../../lib/auth-providers";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email is invalid";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSignup() {
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert("Signup failed", error.message);
      return;
    }

    if (!data.session) {
      Alert.alert(
        "Check your email",
        "We've sent a confirmation link to your email address. Please verify before logging in."
      );
      return;
    }

    // Session exists → upsert profile as safety net (DB trigger is primary)
    const userId = data.session.user.id;
    await supabase.from('profiles').upsert(
      {
        id: userId,
        email: data.session.user.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    // _layout.tsx onAuthStateChange will redirect to onboarding automatically
  }

  const handleAppleSignup = async () => {
    setAppleLoading(true);
    const { error } = await signInWithApple();
    setAppleLoading(false);
    
    if (error && error.message !== "Sign-in canceled") {
      Alert.alert("Apple Sign-In Failed", error.message);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    
    if (error && error.message !== "Authentication flow was canceled or failed.") {
      Alert.alert("Google Sign-In Failed", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <View style={styles.headerContainer}>
            <Text style={styles.title}>Create your Basis account</Text>
            <Text style={styles.subtitle}>
              Track your routine, understand your progress, and build a supplement plan that works for you.
            </Text>
          </View>

          <View style={styles.authContainer}>
            {Platform.OS === "ios" && (
              <AuthButton
                provider="apple"
                onPress={handleAppleSignup}
                loading={appleLoading}
              />
            )}
            
            <AuthButton
              provider="google"
              onPress={handleGoogleSignup}
              loading={googleLoading}
            />

            {!showEmailForm && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <AuthButton
                  provider="email"
                  onPress={() => setShowEmailForm(true)}
                />
              </>
            )}
          </View>

          {showEmailForm && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  placeholder="name@example.com"
                  placeholderTextColor="#8E8E93"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrors((e) => ({ ...e, email: "" }));
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, errors.email && styles.inputError]}
                />
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="#8E8E93"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors((e) => ({ ...e, password: "" }));
                  }}
                  secureTextEntry
                  style={[styles.input, errors.password && styles.inputError]}
                />
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  placeholder="Confirm your password"
                  placeholderTextColor="#8E8E93"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors((e) => ({ ...e, confirmPassword: "" }));
                  }}
                  secureTextEntry
                  style={[
                    styles.input,
                    errors.confirmPassword && styles.inputError,
                  ]}
                />
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}
              </View>

              <Pressable
                onPress={handleSignup}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && { opacity: 0.9 },
                  loading && { opacity: 0.7 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create account</Text>
                )}
              </Pressable>
            </View>
          )}

          <View style={styles.footer}>
            <Pressable
              onPress={() => router.push("/auth/login")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>
                Already have an account?{" "}
                <Text style={styles.secondaryTextBold}>Log in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EBEAE4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  backIcon: { fontSize: 20, color: "#1C1C1E" },
  headerContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1C1C1E",
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: { 
    fontSize: 17, 
    color: "#636366", 
    lineHeight: 24,
  },
  authContainer: {
    marginBottom: 24,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "500",
  },
  form: { gap: 20, marginBottom: 24 },
  inputGroup: { gap: 8 },
  label: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    padding: 16,
    borderRadius: 16,
    fontSize: 17,
    color: "#1C1C1E",
  },
  inputError: { borderColor: "#FF3B30" },
  errorText: { color: "#FF3B30", fontSize: 13, fontWeight: "500" },
  primaryButton: {
    backgroundColor: "#1C1C1E",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  footer: { marginTop: "auto", paddingTop: 20 },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#636366", fontSize: 15 },
  secondaryTextBold: { color: "#1C1C1E", fontWeight: "700" },
});