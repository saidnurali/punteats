import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import {
  getParcelOrder,
  cancelParcelOrder,
  canCancelParcel,
  PARCEL_STATUS_STEPS,
  PARCEL_STATUS_LABELS,
  getStatusColor,
  ParcelOrder,
  ParcelStatus,
} from '@/lib/parcelService';

const GREEN = '#1B7D3C';

// ─── Status Timeline ──────────────────────────────────────────────────────
const StatusTimeline = ({ currentStatus }: { currentStatus: ParcelStatus }) => {
  const currentIndex = PARCEL_STATUS_STEPS.indexOf(currentStatus);

  const TIME_ICONS: Record<string, any> = {
    'Pending': 'search-outline',
    'Driver Assigned': 'person-outline',
    'Driver Arrived': 'flag-outline',
    'Picked Up': 'cube-outline',
    'On the Way': 'bicycle-outline',
    'Delivered': 'checkmark-circle-outline',
  };

  return (
    <View style={styles.timeline}>
      {PARCEL_STATUS_STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;

        return (
          <View key={step} style={styles.timelineItem}>
            <View style={styles.timelineDotCol}>
              <View
                style={[
                  styles.timelineDot,
                  isDone && styles.timelineDotDone,
                  isCurrent && styles.timelineDotCurrent,
                  isFuture && styles.timelineDotFuture,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={TIME_ICONS[step] || 'ellipse'}
                    size={14}
                    color={isCurrent ? '#FFFFFF' : '#D1D5DB'}
                  />
                )}
              </View>
              {index < PARCEL_STATUS_STEPS.length - 1 && (
                <View style={[styles.timelineLine, isDone && styles.timelineLineDone]} />
              )}
            </View>
            <View style={styles.timelineTextCol}>
              <Text
                style={[
                  styles.timelineStepText,
                  isDone && styles.timelineTextDone,
                  isCurrent && styles.timelineTextCurrent,
                  isFuture && styles.timelineTextFuture,
                ]}
              >
                {PARCEL_STATUS_LABELS[step] || step}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── Driver Card ──────────────────────────────────────────────────────────
const DriverCard = ({ driver }: { driver: any }) => {
  if (!driver) return null;
  const phone = driver.phone_number || driver.phone;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.driverCard}>
      <View style={styles.driverAvatarWrap}>
        <View style={styles.driverAvatar}>
          <Ionicons name="person" size={28} color="#FFFFFF" />
        </View>
        <View style={styles.driverOnlineDot} />
      </View>
      <View style={styles.driverInfo}>
        <Text style={styles.driverLabel}>Your Driver</Text>
        <Text style={styles.driverName}>{driver.full_name || driver.name || 'Driver'}</Text>
        {driver.vehicle_info ? (
          <Text style={styles.driverVehicle}>{driver.vehicle_info}</Text>
        ) : null}
      </View>
      {phone ? (
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => Linking.openURL(`tel:${phone}`)}
          activeOpacity={0.85}
        >
          <Ionicons name="call" size={20} color="#FFFFFF" />
          <Text style={styles.callBtnText}>Call</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function ParcelTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [parcel, setParcel] = useState<ParcelOrder | null>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const channelRef = useRef<any>(null);

  // ── Load parcel ──────────────────────────────────────────────────────
  const loadParcel = useCallback(async () => {
    if (!id) { setError('Invalid parcel ID.'); setLoading(false); return; }
    try {
      const data = await getParcelOrder(id);
      setParcel(data);

      // Load driver if assigned
      if (data.driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .eq('id', data.driver_id)
          .maybeSingle();
        if (driverData) setDriver(driverData);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load parcel. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Realtime subscription ────────────────────────────────────────────
  const subscribeRealtime = useCallback(() => {
    if (!id) return;
    channelRef.current = supabase
      .channel(`parcel_track_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'parcel_orders', filter: `id=eq.${id}` },
        async (payload) => {
          const updated = payload.new as ParcelOrder;
          setParcel(prev => prev ? { ...prev, ...updated } : updated);

          // Load driver info if just assigned
          if (updated.driver_id && !driver) {
            const { data: driverData } = await supabase
              .from('profiles')
              .select('id, full_name, phone_number')
              .eq('id', updated.driver_id)
              .maybeSingle();
            if (driverData) setDriver(driverData);
          }
        }
      )
      .subscribe();
  }, [id, driver]);

  useEffect(() => {
    loadParcel();
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Cancel parcel ────────────────────────────────────────────────────
  const handleCancel = () => {
    if (!parcel || !canCancelParcel(parcel.status)) return;
    Alert.alert(
      'Cancel Parcel?',
      'Are you sure you want to cancel this delivery?',
      [
        { text: 'Keep Delivery', style: 'cancel' },
        {
          text: 'Cancel Parcel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelParcelOrder(parcel.id);
              setParcel(p => p ? { ...p, status: 'Cancelled' } : p);
            } catch {
              Alert.alert('Error', 'Unable to cancel. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Render states ────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Parcel</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.centerText}>Loading parcel details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !parcel) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Parcel</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerState}>
          <Ionicons name="warning-outline" size={48} color="#EF4444" />
          <Text style={styles.centerTitle}>Unable to Load</Text>
          <Text style={styles.centerText}>{error || 'Parcel not found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); setError(null); loadParcel(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColors = getStatusColor(parcel.status);
  const isDelivered = parcel.status === 'Delivered';
  const isCancelled = parcel.status === 'Cancelled';

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
        <Text style={styles.headerTitle}>Track Parcel</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Tracking number + status badge */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.topCard}>
          <Text style={styles.trackingLabel}>Tracking Number</Text>
          <Text style={styles.trackingNumber}>{parcel.tracking_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {PARCEL_STATUS_LABELS[parcel.status] || parcel.status}
            </Text>
          </View>
        </Animated.View>

        {/* Driver card (when assigned) */}
        {parcel.driver_id && <DriverCard driver={driver} />}

        {/* Status Timeline */}
        {!isCancelled && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>Delivery Progress</Text>
            <StatusTimeline currentStatus={parcel.status} />
          </Animated.View>
        )}

        {/* Cancelled state */}
        {isCancelled && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.cancelledCard}>
            <Ionicons name="close-circle" size={40} color="#EF4444" />
            <Text style={styles.cancelledTitle}>Parcel Cancelled</Text>
            <Text style={styles.cancelledText}>This parcel delivery has been cancelled.</Text>
          </Animated.View>
        )}

        {/* Delivered state */}
        {isDelivered && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.deliveredCard}>
            <Ionicons name="checkmark-circle" size={40} color={GREEN} />
            <Text style={styles.deliveredTitle}>Parcel Delivered!</Text>
            {parcel.delivered_at && (
              <Text style={styles.deliveredText}>
                Delivered at {new Date(parcel.delivered_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Summary */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Parcel Details</Text>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#6B6B6B" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Pickup</Text>
              <Text style={styles.detailValue}>{parcel.pickup_address}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={16} color="#6B6B6B" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Delivery To</Text>
              <Text style={styles.detailValue}>{parcel.delivery_address}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color="#6B6B6B" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Recipient</Text>
              <Text style={styles.detailValue}>{parcel.recipient_name} • {parcel.recipient_phone}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={16} color="#6B6B6B" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Package</Text>
              <Text style={styles.detailValue}>{parcel.package_type} • {parcel.package_size}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#6B6B6B" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={[styles.detailValue, { color: GREEN, fontWeight: '700' }]}>
                ${Number(parcel.total_amount).toFixed(2)}
              </Text>
            </View>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Cancel button */}
      {canCancelParcel(parcel.status) && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            {cancelling ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Parcel</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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

  scrollContent: { padding: 16, paddingBottom: 100 },

  // States
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  centerText: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 21 },
  retryBtn: { backgroundColor: GREEN, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 25, marginTop: 8 },
  retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Top card
  topCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  trackingLabel: { fontSize: 12, color: '#6B6B6B', fontWeight: '500', marginBottom: 6 },
  trackingNumber: { fontSize: 22, fontWeight: '800', color: GREEN, letterSpacing: 0.5, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 14, fontWeight: '700' },

  // Driver
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  driverAvatarWrap: { position: 'relative', marginRight: 14 },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverOnlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  driverInfo: { flex: 1 },
  driverLabel: { fontSize: 12, color: '#6B6B6B', fontWeight: '500' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 2 },
  driverVehicle: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  callBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  // Timeline
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  timeline: {},
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 56 },
  timelineDotCol: { width: 36, alignItems: 'center' },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  timelineDotDone: { backgroundColor: GREEN },
  timelineDotCurrent: { backgroundColor: GREEN },
  timelineDotFuture: { backgroundColor: '#E5E7EB' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 2 },
  timelineLineDone: { backgroundColor: GREEN },
  timelineTextCol: { flex: 1, paddingLeft: 12, paddingTop: 6 },
  timelineStepText: { fontSize: 14, fontWeight: '500' },
  timelineTextDone: { color: GREEN },
  timelineTextCurrent: { color: GREEN, fontWeight: '700' },
  timelineTextFuture: { color: '#9CA3AF' },

  // Special states
  cancelledCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelledTitle: { fontSize: 18, fontWeight: '700', color: '#DC2626' },
  cancelledText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },

  deliveredCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  deliveredTitle: { fontSize: 18, fontWeight: '700', color: GREEN },
  deliveredText: { fontSize: 13, color: '#6B6B6B' },

  // Summary
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 14,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#6B6B6B', fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '600', lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    paddingVertical: 16,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
