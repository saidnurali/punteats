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
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function VerifyOtpScreen() {
  const { phone, sentOtp, full_name } = useLocalSearchParams<{ phone: string; sentOtp: string; full_name?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length !== 4) {
      Alert.alert("Invalid Code", "Please enter a 4-digit code.");
      return;
    }

    if (code !== sentOtp && code !== "0000") {
      Alert.alert("Error", "The code you entered is incorrect.");
      return;
    }

    setLoading(true);
    try {
      // ── DEV BYPASS: 0000 skips Supabase auth entirely to avoid rate limits ──
      if (code === "0000") {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone_number', phone)
          .maybeSingle();

        if (profileError) throw profileError;

        const sessionData = {
          id: profile?.id || `dev-${phone}`,
          full_name: profile?.full_name || full_name || 'Customer',
          phone_number: phone,
        };

        await AsyncStorage.setItem('puntgo_user_session', JSON.stringify(sessionData));
        DeviceEventEmitter.emit('AUTH_STATE_CHANGED', true);
        router.replace('/(tabs)');
        return;
      }

      // ── NORMAL FLOW: create / sign-in shadow auth user ─────────────────────
      // Strip non-alphanumeric chars so "+252904678886" → "252904678886@punteats.com"
      const sanitizedPhone = phone.replace(/[^a-zA-Z0-9]/g, '');
      const fakeEmail = `${sanitizedPhone}@punteats.com`;
      const fakePassword = `PuntEats-Secure-${sanitizedPhone}!`;

      let { data: authData, error: authError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: fakePassword,
      });

      // If the auth user already exists (edge case), simply log them in
      if (authError && authError.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: fakePassword,
        });
        authData = signInData;
        authError = signInError;
      }

      if (authError || !authData?.user) {
        throw new Error(authError?.message || "Failed to create secure auth user.");
      }

      const validAuthUserId = authData.user.id;

      // Upsert the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert([
          { id: validAuthUserId, phone_number: phone, full_name: full_name || 'Customer' }
        ])
        .select()
        .single();

      if (profileError) throw profileError;

      const sessionData = { 
        id: profile.id, 
        full_name: profile.full_name, 
        phone_number: profile.phone_number 
      };

      await AsyncStorage.setItem('puntgo_user_session', JSON.stringify(sessionData));
      DeviceEventEmitter.emit('AUTH_STATE_CHANGED', true);
      router.replace('/(tabs)');
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
          <Text style={styles.subtitle}>Enter the 4-digit code sent to your WhatsApp at {phone}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="0000"
              placeholderTextColor="#AAAAAA"
              keyboardType="number-pad"
              maxLength={4}
              value={code}
              onChangeText={setCode}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, (code.length < 4 || loading) && styles.verifyBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleVerify}
            disabled={code.length < 4 || loading}
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
    width: 200,
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
