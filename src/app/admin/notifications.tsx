import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Admin Notifications — REMOVED from customer app.
 *
 * The broadcast push notification feature has been moved to the
 * PuntEats Admin Dashboard where it is protected by real admin
 * authentication. This route now shows a "Not Authorized" screen
 * to prevent any customer from accidentally or intentionally
 * reaching the broadcast UI.
 *
 * Security rationale:
 * - Customer apps must never contain admin controls.
 * - The Edge Function `send-broadcast-push` now requires a valid
 *   admin JWT (verified server-side).
 * - Client-side `isAdmin` flags are never trusted.
 */
export default function AdminNotifications() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Not Authorized',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: '#F8F9FA' },
          headerShadowVisible: false,
        }}
      />
      <View style={styles.content}>
        <Ionicons name="lock-closed" size={64} color="#DC2626" />
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.subtitle}>
          This feature is only available in the PuntEats Admin Dashboard.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.backButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#1B7D3C',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
