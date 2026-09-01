import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createParcelOrder } from '@/lib/parcelService';
import { calculateParcelFee, PackageSize, PackageType } from '@/lib/parcelPricing';

const GREEN = '#1B7D3C';

interface ReviewRow {
  icon: any;
  iconColor: string;
  label: string;
  value: string;
}

const ReviewRow = ({ icon, iconColor, label, value }: ReviewRow) => (
  <View style={styles.reviewRow}>
    <View style={[styles.reviewIconWrap, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.reviewRowText}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  </View>
);

export default function ReviewParcelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickupAddress: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    packageType: PackageType;
    packageSize: PackageSize;
    deliveryNote?: string;
  }>();

  const {
    pickupAddress,
    recipientName,
    recipientPhone,
    deliveryAddress,
    packageType,
    packageSize,
    deliveryNote,
  } = params;

  const pricing = calculateParcelFee(packageSize as PackageSize);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false); // prevents double-tap

  const handleConfirm = async () => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const sessionStr = await AsyncStorage.getItem('puntgo_user_session');
      if (!sessionStr) throw new Error('You must be logged in to send a parcel.');
      const session = JSON.parse(sessionStr);
      if (!session?.id) throw new Error('Session invalid. Please log in again.');

      const parcel = await createParcelOrder({
        customer_id: session.id,
        pickup_address: pickupAddress,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        delivery_address: deliveryAddress,
        package_type: packageType as PackageType,
        package_size: packageSize as PackageSize,
        delivery_note: deliveryNote || undefined,
      });

      // Navigate to success screen
      router.replace({
        pathname: '/parcel/created',
        params: {
          parcelId: parcel.id,
          trackingNumber: parcel.tracking_number,
          pickupAddress: parcel.pickup_address,
          deliveryAddress: parcel.delivery_address,
          recipientName: parcel.recipient_name,
          totalAmount: String(parcel.total_amount),
        },
      });
    } catch (err: any) {
      console.error('Parcel creation error:', err);
      Alert.alert(
        'Order Failed',
        err?.message || 'Unable to create your parcel right now. Please try again.',
        [{ text: 'Try Again', onPress: () => { submitLockRef.current = false; } }]
      );
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Confirm</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <ReviewRow icon="location" iconColor={GREEN} label="Pickup" value={pickupAddress} />
          <View style={styles.divider} />
          <ReviewRow icon="person-outline" iconColor="#2563EB" label="Recipient" value={`${recipientName}\n${recipientPhone}`} />
          <View style={styles.divider} />
          <ReviewRow icon="navigate-outline" iconColor="#EF4444" label="Delivery To" value={deliveryAddress} />
          <View style={styles.divider} />
          <ReviewRow
            icon="cube-outline"
            iconColor="#F5A623"
            label="Package Details"
            value={`${packageType} • ${packageSize}`}
          />
        </View>

        {/* Pricing breakdown */}
        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee</Text>
            <Text style={styles.priceValue}>{pricing.deliveryFeeFormatted}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Fee</Text>
            <Text style={styles.priceValue}>{pricing.serviceFeeFormatted}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{pricing.totalFormatted}</Text>
          </View>
        </View>

        {/* Note */}
        {deliveryNote ? (
          <View style={styles.noteCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#6B6B6B" />
            <Text style={styles.noteText}>{deliveryNote}</Text>
          </View>
        ) : null}

        {/* Payment method */}
        <View style={styles.paymentRow}>
          <Ionicons name="cash-outline" size={20} color={GREEN} />
          <Text style={styles.paymentText}>Cash on Delivery</Text>
        </View>

      </ScrollView>

      {/* Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.back()}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm Parcel</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  scrollContent: { padding: 20, paddingBottom: 120 },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  reviewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewRowText: { flex: 1 },
  reviewLabel: { fontSize: 12, color: '#6B6B6B', fontWeight: '500', marginBottom: 3 },
  reviewValue: { fontSize: 15, color: '#1A1A1A', fontWeight: '600', lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 48 },

  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  priceLabel: { fontSize: 14, color: '#6B6B6B' },
  priceValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  priceDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  totalLabel: { fontSize: 16, color: '#1A1A1A', fontWeight: '700' },
  totalValue: { fontSize: 18, color: GREEN, fontWeight: '800' },

  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  noteText: { flex: 1, fontSize: 13, color: '#6B6B6B', lineHeight: 19 },

  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  paymentText: { fontSize: 14, color: GREEN, fontWeight: '600' },

  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  editBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  editBtnText: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 25,
    backgroundColor: GREEN,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
