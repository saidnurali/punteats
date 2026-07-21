import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { AntDesign, FontAwesome, Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;

  const handleContinue = async () => {
    if (phoneNumber.trim().length === 0 || loading) return;
    const fullPhone = "+252" + phoneNumber.trim();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });
      if (error) {
        Alert.alert("Authentication Error", error.message || "Could not send verification code. Please try again.");
      } else {
        router.push(`/(home)/otp?phone=${encodeURIComponent(fullPhone)}`);
      }
    } catch {
      Alert.alert("Error", "Something went wrong sending the verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      console.log("EXPO_REDIRECT_URI:", redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert("Google Sign-In Error", error.message);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === "success" && result.url) {
          const params = AuthSession.parseParams(
            result.url.split("#")[1] || result.url.split("?")[1] || ""
          );

          if (params.access_token && params.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });

            if (!sessionError) {
              Alert.alert("Success", "Signed in with Google successfully!");
            }
          }
        }
      }
    } catch (err: any) {
      Alert.alert("Auth Error", err.message || "An unexpected error occurred.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push("/(home)/signup");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <View style={[styles.logoSection, { marginTop: isSmallScreen ? 32 : 56 }]}>
            <Image
              source={require("../../../assets/images/puntgo_logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── Header Text ── */}
          <View style={styles.headerSection}>
            <Text style={styles.title} allowFontScaling={true}>
              Welcome Back
            </Text>
            <Text style={styles.subtitle} allowFontScaling={true}>
              Sign in to continue
            </Text>
          </View>

          {/* ── Phone Input ── */}
          <View style={styles.inputSection}>
            <View style={styles.phoneInputContainer}>
              {/* Country Code */}
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+252</Text>
              </View>

              {/* Vertical Separator */}
              <View style={styles.separator} />

              {/* Phone Number Field */}
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter your phone number"
                placeholderTextColor="#AAAAAA"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={9}
                allowFontScaling={true}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>
          </View>

          {/* ── Continue Button ── */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              (phoneNumber.length === 0 || loading) && styles.continueButtonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleContinue}
            disabled={phoneNumber.length === 0 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText} allowFontScaling={true}>
                Continue
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social Auth Buttons ── */}
          <View style={styles.socialRow}>
            {/* Google */}
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.75}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#EA4335" size="small" />
              ) : (
                <AntDesign name="google" size={32} color="#EA4335" />
              )}
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.75}>
              <FontAwesome name="facebook" size={32} color="#1877F2" />
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.75}>
              <Ionicons name="logo-apple" size={32} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <View style={[styles.footer, { marginBottom: isSmallScreen ? 20 : 36 }]}>
            <Text style={styles.footerText} allowFontScaling={true}>
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity onPress={handleSignUp} activeOpacity={0.7}>
              <Text style={styles.signUpLink} allowFontScaling={true}>
                Sign up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    alignItems: "center",
  },

  // ── Logo ──
  logoSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 88,
    height: 88,
  },

  // ── Header ──
  headerSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B6B6B",
    textAlign: "center",
    fontWeight: "400",
  },

  // ── Phone Input ──
  inputSection: {
    width: "100%",
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    height: 54,
    paddingHorizontal: 16,
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  countryCode: {
    paddingRight: 12,
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: "#E0E0E0",
    marginRight: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    fontWeight: "400",
    paddingVertical: 0, // Remove extra Android padding
  },

  // ── Continue Button ──
  continueButton: {
    width: "100%",
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginBottom: 28,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: "#8DC5A1",
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EBEBEB",
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    color: "#AAAAAA",
    fontWeight: "400",
  },

  // ── Social Buttons ── (Perfect Circles like design reference)
  socialRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    gap: 24,
    marginBottom: 40,
    marginTop: 4,
  },
  socialButton: {
    width: 80,
    height: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: "#DCDCF0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  footerText: {
    fontSize: 14,
    color: "#6B6B6B",
    fontWeight: "400",
  },
  signUpLink: {
    fontSize: 14,
    color: "#1B7D3C",
    fontWeight: "600",
  },
});
