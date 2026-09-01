import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeIn, useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';

const GREEN = '#1B7D3C';

interface InfoRowProps {
  icon: any;
  iconColor: string;
  label: string;
  value: string;
}

const InfoRow = ({ icon, iconColor, label, value }: InfoRowProps) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIcon, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={16} color={iconColor} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

export default function ParcelCreatedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    parcelId: string;
    trackingNumber: string;
    pickupAddress: string;
    deliveryAddress: string;
    recipientName: string;
    totalAmount: string;
  }>();

  const {
    parcelId,
    trackingNumber,
    pickupAddress,
    deliveryAddress,
    recipientName,
    totalAmount,
  } = params;

  const scale = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Success Icon */}
        <Animated.View style={[styles.successWrap, animStyle]}>
          <View style={styles.checkCircleOuter}>
            <View style={styles.checkCircleInner}>
              <Ionicons name="checkmark" size={44} color="#FFFFFF" />
            </View>
          </View>
        </Animated.View>

        <Animated.Text entering={FadeInDown.duration(400).delay(200)} style={styles.successTitle}>
          Parcel Request Created!
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(400).delay(280)} style={styles.successSubtitle}>
          Your parcel request has been received successfully.
        </Animated.Text>

        {/* Tracking Number */}
        <Animated.View entering={FadeInDown.duration(400).delay(360)} style={styles.trackingCard}>
          <Text style={styles.trackingLabel}>Tracking Number</Text>
          <Text style={styles.trackingNumber}>{trackingNumber || 'PE-2026-000001'}</Text>
        </Animated.View>

        {/* Info rows */}
        <Animated.View entering={FadeInDown.duration(400).delay(440)} style={styles.infoCard}>
          <InfoRow icon="location" iconColor={GREEN} label="Pickup" value={pickupAddress} />
          <View style={styles.infoSep} />
          <InfoRow icon="navigate-outline" iconColor="#EF4444" label="Delivery To" value={deliveryAddress} />
          <View style={styles.infoSep} />
          <InfoRow icon="person-outline" iconColor="#2563EB" label="Recipient" value={recipientName} />
          <View style={styles.infoSep} />
          <InfoRow icon="cash-outline" iconColor="#F5A623" label="Delivery Fee" value={`$${Number(totalAmount).toFixed(2)}`} />
          <View style={styles.infoSep} />
          <View style={styles.statusRow}>
            <View style={[styles.infoIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time-outline" size={16} color="#D97706" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: '#D97706' }]}>Searching for driver</Text>
            </View>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.trackBtn}
          activeOpacity={0.85}
          onPress={() =>
            router.replace({
              pathname: '/parcel/track/[id]',
              params: { id: parcelId },
            })
          }
        >
          <Text style={styles.trackBtnText}>Track Parcel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          activeOpacity={0.8}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  scrollContent: { alignItems: 'center', padding: 24, paddingBottom: 120 },

  successWrap: { marginTop: 32, marginBottom: 20 },
  checkCircleOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 20,
  },

  trackingCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: GREEN,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  trackingLabel: { fontSize: 13, color: '#6B6B6B', fontWeight: '500', marginBottom: 6 },
  trackingNumber: { fontSize: 24, fontWeight: '800', color: GREEN, letterSpacing: 1 },

  infoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#6B6B6B', fontWeight: '500', marginBottom: 3 },
  infoValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '600', lineHeight: 20 },
  infoSep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 44, marginVertical: 2 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  trackBtn: {
    backgroundColor: GREEN,
    paddingVertical: 17,
    borderRadius: 25,
    alignItems: 'center',
  },
  trackBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  homeBtn: {
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  homeBtnText: { color: '#6B6B6B', fontSize: 15, fontWeight: '600' },
});
