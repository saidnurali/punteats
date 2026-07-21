import React, { useState, useRef, useEffect } from "react";
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
import { Stack, router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

const OTP_LENGTH = 6;

export default function OTPScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    // Only accept digits
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits filled
    if (digit && index === OTP_LENGTH - 1) {
      const fullOtp = [...newOtp].join("");
      if (fullOtp.length === OTP_LENGTH) {
        verifyOtp(fullOtp);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace") {
      const newOtp = [...otp];
      if (otp[index]) {
        // Clear current
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        // Move back
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const verifyOtp = async (token: string) => {
    if (!phone) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone,
        token,
        type: "sms",
      });
      if (error) {
        Alert.alert("Invalid Code", error.message || "The code you entered is incorrect. Please try again.");
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else {
        // Success — navigate to home or main app
        Alert.alert("Success", "Phone verified successfully!");
        router.replace("/(home)/login"); // Or future home screen
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    const token = otp.join("");
    if (token.length !== OTP_LENGTH) {
      Alert.alert("Incomplete Code", `Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    verifyOtp(token);
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setOtp(Array(OTP_LENGTH).fill(""));
        setResendTimer(30);
        setCanResend(false);
        inputRefs.current[0]?.focus();
      }
    } catch {
      Alert.alert("Error", "Could not resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filledCount = otp.filter(Boolean).length;
  const isComplete = filledCount === OTP_LENGTH;

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})(\d+)(\d{3})/, "$1****$3")
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={[styles.backButton, { marginTop: isSmallScreen ? 12 : 20 }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={[styles.logoSection, { marginTop: isSmallScreen ? 20 : 40 }]}>
            <Image
              source={require("../../../assets/images/puntgo_logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.title} allowFontScaling={true}>
              Verify Your Number
            </Text>
            <Text style={styles.subtitle} allowFontScaling={true}>
              Enter the 6-digit code sent to
            </Text>
            <Text style={styles.phoneDisplay} allowFontScaling={true}>
              {maskedPhone}
            </Text>
          </View>

          {/* OTP Input Boxes */}
          <View style={styles.otpSection}>
            <View style={styles.otpRow}>
              {Array(OTP_LENGTH)
                .fill(0)
                .map((_, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpBox,
                      otp[index] ? styles.otpBoxFilled : null,
                    ]}
                    value={otp[index]}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    caretHidden={true}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
            </View>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!isComplete || loading) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={!isComplete || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText} allowFontScaling={true}>
                Verify
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <View style={[styles.resendSection, { marginBottom: isSmallScreen ? 20 : 36 }]}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResend} disabled={!canResend || loading}>
              <Text style={[styles.resendLink, !canResend && styles.resendLinkDisabled]}>
                {canResend ? "Resend" : `Resend in ${resendTimer}s`}
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
  backButton: {
    alignSelf: "flex-start",
    padding: 8,
    marginLeft: -8,
  },
  backArrow: {
    fontSize: 24,
    color: "#1A1A1A",
    fontWeight: "400",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 72,
    height: 72,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B6B6B",
    textAlign: "center",
    fontWeight: "400",
  },
  phoneDisplay: {
    fontSize: 16,
    color: "#1B7D3C",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  otpSection: {
    width: "100%",
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F8F8",
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
  },
  otpBoxFilled: {
    borderColor: "#1B7D3C",
    backgroundColor: "#F0FAF4",
  },
  verifyButton: {
    width: "100%",
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginBottom: 24,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  verifyButtonDisabled: {
    backgroundColor: "#8DC5A1",
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  resendSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  resendText: {
    fontSize: 14,
    color: "#6B6B6B",
    fontWeight: "400",
  },
  resendLink: {
    fontSize: 14,
    color: "#1B7D3C",
    fontWeight: "600",
  },
  resendLinkDisabled: {
    color: "#AAAAAA",
  },
});
