import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getCustomerParcels, ParcelOrder, PARCEL_STATUS_LABELS, getStatusColor } from '@/lib/parcelService';
import { getCurrentUser } from "@/lib/getCurrentUser";

const GREEN = '#1B7D3C';

const ParcelCard = ({ parcel, onPress, index }: { parcel: ParcelOrder; onPress: () => void; index: number }) => {
  const statusColors = getStatusColor(parcel.status);
  const date = new Date(parcel.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(index * 60)}>
      <TouchableOpacity style={styles.parcelCard} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Ionicons name="cube" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.trackingNum}>{parcel.tracking_number}</Text>
            <Text style={styles.cardDate}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {PARCEL_STATUS_LABELS[parcel.status] || parcel.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBody}>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color="#6B6B6B" />
            <Text style={styles.addressText} numberOfLines={1}>{parcel.pickup_address}</Text>
          </View>
          <View style={styles.arrowDown}>
            <Ionicons name="arrow-down" size={12} color="#D1D5DB" />
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="navigate-outline" size={14} color="#6B6B6B" />
            <Text style={styles.addressText} numberOfLines={1}>{parcel.delivery_address}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerRecipient}>To: {parcel.recipient_name}</Text>
          <Text style={styles.footerAmount}>${Number(parcel.total_amount).toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const EmptyState = () => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <Ionicons name="cube-outline" size={52} color="#D1D5DB" />
    </View>
    <Text style={styles.emptyTitle}>No Parcels Yet</Text>
    <Text style={styles.emptySubtitle}>You haven't sent any parcels yet. Create your first delivery!</Text>
  </View>
);

export default function ParcelHistoryScreen() {
  const router = useRouter();
  const [parcels, setParcels] = useState<ParcelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParcels = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);

      const profile = await getCurrentUser();
      if (!profile) throw new Error('Not logged in.');

      const data = await getCustomerParcels(profile.id);
      setParcels(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load parcel history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadParcels(); }, [loadParcels]));

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
        <Text style={styles.headerTitle}>Parcel History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.loadingText}>Loading your parcels...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="wifi-outline" size={48} color="#9CA3AF" />
          <Text style={styles.errorTitle}>Connection Problem</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadParcels()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadParcels(true)}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
          renderItem={({ item, index }) => (
            <ParcelCard
              parcel={item}
              index={index}
              onPress={() =>
                router.push({
                  pathname: '/parcel/track/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
        />
      )}

      {/* New parcel FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/parcel/create')}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>
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

  listContent: { padding: 16, paddingBottom: 100 },

  parcelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderText: { flex: 1 },
  trackingNum: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  cardDate: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  cardBody: { gap: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { flex: 1, fontSize: 13, color: '#1A1A1A' },
  arrowDown: { paddingLeft: 2 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerRecipient: { fontSize: 13, color: '#6B6B6B' },
  footerAmount: { fontSize: 15, fontWeight: '700', color: GREEN },

  // States
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B6B6B' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  errorText: { fontSize: 14, color: '#6B6B6B', textAlign: 'center' },
  retryBtn: { backgroundColor: GREEN, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 25, marginTop: 4 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 21 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
