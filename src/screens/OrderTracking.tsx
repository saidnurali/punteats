import React, { useEffect, useState, useRef } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getStoredOrders, LiveOrder } from "@/lib/ordersStore";
import { supabase } from "@/lib/supabase";

// Garowe Default Locations for Testing
const GAROWE_RESTAURANT = { latitude: 8.4060, longitude: 48.4810 }; // Near Barxada
const GAROWE_CUSTOMER = { latitude: 8.4005, longitude: 48.4850 };   // Destination
const GAROWE_SCOOTER = { latitude: 8.4030, longitude: 48.4830 };    // Live Scooter

const calculateHaversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of Earth in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id: queryId, orderId, initialStatus } = useLocalSearchParams<{ id?: string, orderId?: string, initialStatus?: string }>();
  const activeId = orderId || queryId;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number, heading: number} | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const mapRef = useRef<MapView>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    async function loadOrder() {
      if (!activeId) return;

      const isUUID = activeId.length === 36 && activeId.includes('-');
      const normalizedNumber = '#' + activeId.replace(/^#+/, '');

      let query = supabase.from('orders').select('*');
      if (isUUID) {
        query = query.eq('id', activeId);
      } else {
        query = query.or(`order_number.eq.${normalizedNumber},order_number.eq.${activeId}`);
      }

      const { data, error } = await query.single();
      if (data) {
        setOrder(data);
        if (data.driver_latitude && data.driver_longitude) {
          setDriverLocation({
            latitude: Number(data.driver_latitude),
            longitude: Number(data.driver_longitude),
            heading: Number(data.driver_heading || 0)
          });
        }
      }
      setLoading(false);
    }
    loadOrder();

    // Subscribe to realtime status changes
    const channel = supabase.channel(`order_${activeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, 
        (payload) => {
          const newOrder = payload.new as any;
          const normalizedNumber = '#' + activeId.replace(/^#+/, '');
          if (newOrder.id === activeId || newOrder.order_number === activeId || newOrder.order_number === normalizedNumber) {
            setOrder((prev: any) => ({ ...prev, ...newOrder }));
            if (newOrder.driver_latitude && newOrder.driver_longitude) {
              setDriverLocation({
                latitude: Number(newOrder.driver_latitude),
                longitude: Number(newOrder.driver_longitude),
                heading: Number(newOrder.driver_heading || 0)
              });
            }
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  const handleCallDriver = () => {
    const phone = order?.driver_phone || "+252907112233";
    const driverName = order?.driver_name || "Mahad Jama (PuntGo Dispatch)";
    Alert.alert(
      "Calling Driver 📞",
      `Connecting to ${driverName} at ${phone}...`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => {
            if (Platform.OS !== "web") {
              Linking.openURL(`tel:${phone}`).catch(() => {});
            }
          },
        },
      ]
    );
  };

  const getStepIndex = (status?: string): number => {
    if (!status) return 0;
    switch (status.toLowerCase()) {
      case "pending": return 0;
      case "preparing": return 1;
      case "out for delivery": return 2;
      case "delivered": return 3;
      case "cancelled": return -1;
      case "rejected": return -1;
      default: return 0;
    }
  };

  const currentStep = getStepIndex(order?.status);
  const orderTimeStr = order ? new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "10:30 AM";

  const destLat = Number(order?.delivery_lat || order?.delivery_latitude || GAROWE_CUSTOMER.latitude);
  const destLng = Number(order?.delivery_lng || order?.delivery_longitude || GAROWE_CUSTOMER.longitude);
  const destination = { latitude: destLat, longitude: destLng };

  const restLat = Number(order?.restaurant_lat || order?.restaurant_latitude || GAROWE_RESTAURANT.latitude);
  const restLng = Number(order?.restaurant_lng || order?.restaurant_longitude || GAROWE_RESTAURANT.longitude);

  const liveDriver = driverLocation || { ...GAROWE_SCOOTER, heading: 45 };

  useEffect(() => {
    if (order) {
      const km = calculateHaversineKm(liveDriver.latitude, liveDriver.longitude, destLat, destLng);
      setDistanceKm(km);

      const coordinatesToFit = [
        { latitude: liveDriver.latitude, longitude: liveDriver.longitude },
        { latitude: destLat, longitude: destLng },
        { latitude: restLat, longitude: restLng }
      ];

      mapRef.current?.fitToCoordinates(
        coordinatesToFit,
        {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true
        }
      );
    }
  }, [driverLocation, order]);

  // 🚨 IF ORDER IS CANCELLED / REJECTED:
  if (order?.status?.toLowerCase() === 'cancelled' || order?.status?.toLowerCase() === 'rejected') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/orders')}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Red Cancelled Banner */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons color="#EF4444" name="close-circle" size={40}/>
            </View>

            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Order Cancelled</Text>

            {/* Rejection Reason Container */}
            <View style={{ width: '100%', backgroundColor: '#FEF2F2', borderLeftWidth: 4, borderLeftColor: '#DC2626', borderRadius: 8, padding: 12, marginVertical: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#991B1B', textTransform: 'uppercase', marginBottom: 4 }}>Reason:</Text>
              <Text style={{ fontSize: 14, color: '#DC2626', lineHeight: 20 }}>
                {order?.rejection_reason || 'Order was cancelled by restaurant.'}
              </Text>
            </View>

            <TouchableOpacity style={{ width: '100%', backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 }} onPress={() => router.replace('/(tabs)')}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const fallbackId = activeId || "PG123456";
  let displayOrderId = order?.order_number || fallbackId;
  // Ensure it starts with exactly one #
  if (!displayOrderId.startsWith('#')) {
    displayOrderId = '#' + displayOrderId;
  }
  displayOrderId = displayOrderId.replace(/^#+/, '#'); // Fixes ##PG123456 issue

  // 🚨 IF ORDER IS DELIVERED:
  if (order?.status?.toLowerCase() === 'delivered') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/orders')}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Completed</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Celebration Green Banner */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="checkmark-circle" size={44} color="#10B981" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#065F46', marginBottom: 6 }}>🎉 Order Delivered Successfully!</Text>
            <Text style={{ fontSize: 14, color: '#4B5563', textAlign: 'center', marginBottom: 16 }}>Enjoy your meal! Thank you for ordering with PuntGo.</Text>

            <TouchableOpacity style={{ width: '100%', backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }} onPress={() => router.replace('/(tabs)')}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Rate Experience & Back Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 🚨 ACTIVE TRACKING STATE (Pending, Preparing, Out for Delivery)
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/orders");
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Order Tracking</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* 2. CARD TOP: Restaurant, Order Number, Estimated Arrival */}
            <View style={styles.topCard}>
              <View style={styles.topCardLeft}>
                <View style={styles.restaurantIconCircle}>
                  <Ionicons name="fast-food" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.restaurantDetails}>
                  <Text style={styles.orderIdBold}>
                    Order {displayOrderId}
                  </Text>
                  <Text style={styles.restaurantName}>
                    {order?.restaurant_name || "Pizza House"}
                  </Text>
                </View>
              </View>

              <View style={styles.topCardRight}>
                <Text style={styles.estLabel}>Estimated arrival</Text>
                <Text style={styles.estTime}>20-30 min</Text>
              </View>
            </View>

            {/* 3. DYNAMIC STEPPERS TIMELINE */}
            <View style={styles.timelineContainer}>
              {/* Step 1: Order Placed */}
              <View style={styles.stepRow}>
                <View style={styles.stepIndicatorCol}>
                  <View style={[styles.stepCircle, currentStep >= 0 ? styles.stepCircleActive : styles.stepCircleInactive]}>
                    {currentStep >= 0 && <View style={styles.stepDotActive} />}
                  </View>
                  <View style={[styles.stepLine, currentStep >= 1 ? styles.stepLineActive : styles.stepLineInactive]} />
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, currentStep >= 0 ? styles.stepTitleActive : styles.stepTitleInactive]}>
                    Order Placed
                  </Text>
                  <Text style={[styles.stepTime, currentStep >= 0 ? styles.stepTimeActive : styles.stepTimeInactive]}>
                    {currentStep >= 0 ? "Order Placed & Awaiting Confirmation" : "-"}
                  </Text>
                </View>
              </View>

              {/* Step 2: Preparing Food */}
              <View style={styles.stepRow}>
                <View style={styles.stepIndicatorCol}>
                  <View style={[styles.stepCircle, currentStep >= 1 ? styles.stepCircleActive : styles.stepCircleInactive]}>
                    {currentStep >= 1 && <View style={styles.stepDotActive} />}
                  </View>
                  <View style={[styles.stepLine, currentStep >= 2 ? styles.stepLineActive : styles.stepLineInactive]} />
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, currentStep >= 1 ? styles.stepTitleActive : styles.stepTitleInactive]}>
                    Preparing Food
                  </Text>
                  <Text style={[styles.stepTime, currentStep >= 1 ? styles.stepTimeActive : styles.stepTimeInactive]}>
                    {currentStep >= 1 ? "Kitchen Preparing Food" : "-"}
                  </Text>
                </View>
              </View>

              {/* Step 3: Out for Delivery */}
              <View style={styles.stepRow}>
                <View style={styles.stepIndicatorCol}>
                  <View style={[styles.stepCircle, currentStep >= 2 ? styles.stepCircleActive : styles.stepCircleInactive]}>
                    {currentStep >= 2 && <View style={styles.stepDotActive} />}
                  </View>
                  <View style={[styles.stepLine, currentStep >= 3 ? styles.stepLineActive : styles.stepLineInactive]} />
                </View>
                <View style={styles.stepContent}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={[styles.stepTitle, currentStep >= 2 ? styles.stepTitleActive : styles.stepTitleInactive]}>
                      Out for Delivery
                    </Text>
                    {order?.driver_name && (
                      <View style={styles.driverBadge}>
                        <Text style={styles.driverBadgeText}>🛵 {order.driver_name}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.stepTime, currentStep >= 2 ? styles.stepTimeActive : styles.stepTimeInactive]}>
                    {currentStep >= 2 ? "On The Way with Driver" : "-"}
                  </Text>
                </View>
              </View>

              {/* Step 4: Delivered */}
              <View style={[styles.stepRow, { minHeight: 28 }]}>
                <View style={styles.stepIndicatorCol}>
                  <View style={[styles.stepCircle, currentStep >= 3 ? styles.stepCircleActive : styles.stepCircleInactive]}>
                    {currentStep >= 3 && <View style={styles.stepDotActive} />}
                  </View>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, currentStep >= 3 ? styles.stepTitleActive : styles.stepTitleInactive]}>
                    Delivered
                  </Text>
                  <Text style={[styles.stepTime, currentStep >= 3 ? styles.stepTimeActive : styles.stepTimeInactive]}>
                    {currentStep >= 3 ? "Delivered Successfully" : "-"}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4. LIVE MAP CONTAINER */}
            <View style={[styles.mapContainer, { height: 320 }]}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                showsCompass
                showsUserLocation
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: destLat,
                  longitude: destLng,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                }}
              >
                {/* 1. RESTAURANT / PICKUP MARKER */}
                <Marker
                  coordinate={{ latitude: restLat, longitude: restLng }}
                  title={order?.restaurant_name || "Restaurant"}
                >
                  <View style={styles.restaurantPin}>
                    <Ionicons color="#FFFFFF" name="restaurant" size={18} />
                  </View>
                </Marker>

                {/* 2. CUSTOMER / DESTINATION MARKER */}
                <Marker coordinate={destination} title="Delivery Destination">
                  <View style={styles.customerPin}>
                    <Ionicons name="home" size={16} color="#FFFFFF" />
                  </View>
                </Marker>

                {/* 3. LIVE DRIVER SCOOTER MARKER */}
                <Marker
                  coordinate={{ latitude: liveDriver.latitude, longitude: liveDriver.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  rotation={liveDriver.heading}
                  title={order?.driver_name || "Driver"}
                >
                  <View style={styles.scooterPin}>
                    <Ionicons color="#1B7D3C" name="bicycle" size={24} />
                  </View>
                </Marker>

                {/* REALTIME POLYLINE ROUTE FROM DRIVER TO DESTINATION */}
                <Polyline
                  coordinates={[
                    { latitude: liveDriver.latitude, longitude: liveDriver.longitude },
                    { latitude: destLat, longitude: destLng }
                  ]}
                  strokeColor="#1B7D3C"
                  strokeWidth={4}
                />
              </MapView>

              {/* FLOATING LIVE KM CARD */}
              <View style={styles.floatingCard}>
                <View>
                  <Text style={styles.cardTitle}>{distanceKm} km away</Text>
                  <Text style={styles.cardSub}>
                    Estimated Arrival: ~{Math.max(1, Math.ceil(distanceKm * 2.5))} mins
                  </Text>
                </View>
                <Text style={styles.fareText}>${order?.total_amount || order?.total || order?.total_price || '0.00'}</Text>
              </View>
            </View>

            {/* 5. BOTTOM ACTION BAR: Contact Driver & Call */}
            <View style={styles.bottomActionBar}>
              <TouchableOpacity style={styles.contactDriverPill} activeOpacity={0.85} onPress={handleCallDriver}>
                <Ionicons name="call" size={20} color="#1A1A1A" style={{ marginRight: 10 }} />
                <Text style={styles.contactDriverText}>Contact Driver</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.callCircleBtn} activeOpacity={0.85} onPress={handleCallDriver}>
                <Ionicons name="call" size={22} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    width: 44,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  headerRightPlaceholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  topCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  restaurantIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  restaurantDetails: {
    justifyContent: "center",
  },
  orderIdBold: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 3,
  },
  restaurantName: {
    fontSize: 14,
    color: "#6B6B6B",
  },
  topCardRight: {
    alignItems: "flex-end",
  },
  estLabel: {
    fontSize: 12.5,
    color: "#9CA3AF",
    marginBottom: 3,
  },
  estTime: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B7D3C",
  },
  timelineContainer: {
    paddingTop: 24,
    paddingBottom: 10,
  },
  stepRow: {
    flexDirection: "row",
    minHeight: 48,
  },
  stepIndicatorCol: {
    width: 28,
    alignItems: "center",
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    borderWidth: 2.5,
    borderColor: "#1B7D3C",
    backgroundColor: "#FFFFFF",
  },
  stepCircleInactive: {
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  stepDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1B7D3C",
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  stepLineActive: {
    backgroundColor: "#1B7D3C",
  },
  stepLineInactive: {
    backgroundColor: "#E2E8F0",
  },
  stepContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingLeft: 14,
    paddingTop: 1,
  },
  stepTitle: {
    fontSize: 15.5,
  },
  stepTitleActive: {
    fontWeight: "700",
    color: "#1A1A1A",
  },
  stepTitleInactive: {
    fontWeight: "500",
    color: "#6B6B6B",
  },
  stepTime: {
    fontSize: 13.5,
  },
  stepTimeActive: {
    color: "#4B5563",
    fontWeight: "600",
  },
  stepTimeInactive: {
    color: "#9CA3AF",
  },
  driverBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  driverBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1B7D3C",
  },
  mapContainer: {
    height: 220,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mapStreetGrid: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    position: "relative",
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: "#FFFFFF",
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: "#FFFFFF",
  },
  routeLineDiag: {
    position: "absolute",
    top: 50,
    left: 80,
    width: 180,
    height: 3.5,
    backgroundColor: "#1B7D3C",
    transform: [{ rotate: "-35deg" }],
  },
  pinRestaurant: {
    position: "absolute",
    top: 36,
    right: 56,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  pinCustomer: {
    position: "absolute",
    bottom: 40,
    left: 64,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#DBEAFE",
  },
  pinCustomerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  driverAvatarPin: {
    position: "absolute",
    top: 90,
    left: 140,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1B7D3C",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  bottomActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactDriverPill: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactDriverText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  callCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deliveredBanner: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  confettiCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  deliveredTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B7D3C",
    marginBottom: 6,
    textAlign: "center",
  },
  deliveredSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  deliveredBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  rateBtn: {
    flex: 1,
    backgroundColor: "#FEF3C7",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginRight: 10,
  },
  rateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#D97706",
  },
  homeBtn: {
    flex: 1,
    backgroundColor: "#1B7D3C",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  homeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelledScreenContainer: {
    padding: 20,
    gap: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelledIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  cancelledTitleLarge: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 16,
  },
  reasonBoxContainer: {
    width: "100%",
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  reasonLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
  },
  reasonBodyText: {
    fontSize: 14,
    color: "#7F1D1D",
    lineHeight: 20,
  },
  summaryCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  summaryTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  summaryItemsText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 20,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  summaryTotalAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  reorderLargeBtn: {
    width: "100%",
    backgroundColor: "#1B7D3C",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reorderLargeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  homeGreyBtn: {
    width: "100%",
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  homeGreyBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4B5563",
  },
  restaurantPin: {
    backgroundColor: '#F5A623', 
    padding: 8, 
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  customerPin: {
    backgroundColor: '#10B981', 
    padding: 8, 
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  scooterPin: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  floatingCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  fareText: { fontSize: 18, fontWeight: 'bold', color: '#10B981' },
});
