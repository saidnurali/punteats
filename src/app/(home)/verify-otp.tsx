import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";

export default function VerifyOtpScreen() {
  // Note: no `sentOtp` param — the correct code never reaches the client.
  // The code is generated, hashed, and verified entirely server-side by
  // the send-otp / verify-otp Edge Functions.
  const { phone, full_name } = useLocalSearchParams<{ phone: string; full_name?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: code.trim(), full_name },
      });

      if (error) throw error;
      if (!data?.success) {
        Alert.alert("Verification Failed", data?.error || "The code you entered is incorrect.");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;

      DeviceEventEmitter.emit('AUTH_STATE_CHANGED', true);
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Verification Failed", err.message || "An error occurred setting up your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to your WhatsApp at {phone}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor="#AAAAAA"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, (code.length < 6 || loading) && styles.verifyBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleVerify}
            disabled={code.length < 6 || loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.verifyBtnText}>Verify Code</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  keyboardView: { flex: 1 },
  header: { padding: 20 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  content: { paddingHorizontal: 24, flex: 1, marginTop: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#1A1A1A", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#6B6B6B", marginBottom: 32, lineHeight: 22 },
  inputContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 40 },
  codeInput: {
    fontSize: 40,
    fontWeight: "700",
    color: "#1B7D3C",
    letterSpacing: 8,
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1B7D3C",
    width: 260,
    paddingBottom: 8,
  },
  verifyBtn: {
    backgroundColor: "#1B7D3C",
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: "center",
  },
  verifyBtnDisabled: { backgroundColor: "#A7F3D0" },
  verifyBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
