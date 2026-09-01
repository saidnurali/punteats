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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from 'expo-location';
import { getStoredOrders, LiveOrder } from "@/lib/ordersStore";
import { supabase } from "@/lib/supabase";
import DriverChatModal from "@/components/DriverChatModal";
import { GpsBanner } from "@/lib/GlobalErrorProvider";

// Garowe Default Locations for Testing
const GAROWE_COORDINATES = {
  latitude: 8.4064,
  longitude: 48.4826,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};
const GAROWE_RESTAURANT = { latitude: GAROWE_COORDINATES.latitude, longitude: GAROWE_COORDINATES.longitude }; // Near Barxada
const GAROWE_CUSTOMER = { latitude: GAROWE_COORDINATES.latitude - 0.005, longitude: GAROWE_COORDINATES.longitude + 0.002 };   // Destination
const GAROWE_SCOOTER = { latitude: GAROWE_COORDINATES.latitude - 0.003, longitude: GAROWE_COORDINATES.longitude + 0.001 };    // Live Scooter

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
  const { id: queryId, orderId, initialStatus, orderData } = useLocalSearchParams<{ id?: string, orderId?: string, initialStatus?: string, orderData?: string }>();
  const activeId = orderId || queryId;

  const initialOrder = orderData ? JSON.parse(orderData) : null;
  const [order, setOrder] = useState<any>(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [driverDetails, setDriverDetails] = useState<{name: string; phone: string} | null>(null);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number, heading: number} | null>(null);
  const lastKnownDriverLocation = useRef<{latitude: number, longitude: number, heading: number} | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const mapRef = useRef<MapView>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Graceful Location Request
  useEffect(() => {
    (async () => {
      try {
        // 1. Check existing permission status first (don't blindly request)
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        
        if (existingStatus === 'granted') {
          setLocationPermissionGranted(true);
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } else {
          // If not granted, we degrade gracefully and don't show the user's blue dot.
          // We let the map just show the driver's pin to avoid aggressive permission popups.
          setLocationPermissionGranted(false);
        }
      } catch (err) {
        console.warn("Location check failed:", err);
        setLocationPermissionGranted(false);
      }
    })();
  }, []);

  const handleOpenChat = () => {
    setIsChatOpen(true);
    isChatOpenRef.current = true;
    setUnreadCount(0);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
    isChatOpenRef.current = false;
  };

  // Listen for unread chat messages
  useEffect(() => {
    if (!activeId) return;
    const orderIdStr = String(activeId).replace(/^#+/, '');
    
    const channel = supabase
      .channel(`badge_chat_${orderIdStr}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${orderIdStr}`
      }, (payload) => {
        if (payload.new.sender_role !== 'customer') {
          if (!isChatOpenRef.current) {
            setUnreadCount(prev => prev + 1);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId]);

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

  // ── Fetch driver details when driver_id becomes known ────────────────────
  useEffect(() => {
    const driverId = order?.driver_id;
    if (!driverId) {
      setDriverDetails(null);
      return;
    }
    // Fetch from `drivers` table using the FK stored in orders.driver_id
    supabase
      .from('drivers')
      .select('full_name, phone')
      .eq('id', driverId)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setDriverDetails({ name: data.full_name, phone: data.phone });
        } else {
          // Graceful fallback: use the driver_name already denormalized on the order row
          const fallbackName = order?.driver_name;
          const fallbackPhone = order?.driver_phone;
          if (fallbackName) setDriverDetails({ name: fallbackName, phone: fallbackPhone || '' });
        }
      });
  }, [order?.driver_id]);

  // ── Load order + subscribe to Realtime (order row + drivers table) ────────
  useEffect(() => {
    async function loadOrder() {
      if (!activeId) return;

      const isUUID = activeId.length === 36 && activeId.includes('-');
      const normalizedNumber = '#' + activeId.replace(/^#+/, '');

      let query = supabase
        .from('orders')
        .select('id, order_number, status, driver, driver_id, driver_name, driver_phone, driver_latitude, driver_longitude, driver_heading, customer_name, customer_phone, items, total_price, delivery_address, restaurant_name, rejection_reason, created_at, user_id');
        
      if (isUUID) {
        query = query.eq('id', activeId);
      } else {
        query = query.or(`order_number.eq.${normalizedNumber},order_number.eq.${activeId}`);
      }

      const { data } = await query.single();
      if (data) {
        setOrder(data);
        if (data.driver_latitude && data.driver_longitude) {
          const loc = {
            latitude: Number(data.driver_latitude),
            longitude: Number(data.driver_longitude),
            heading: Number(data.driver_heading || 0)
          };
          setDriverLocation(loc);
          lastKnownDriverLocation.current = loc;
        }
      }
      setLoading(false);
    }
    loadOrder();

    if (!activeId) return;

    const isUUID = activeId.length === 36 && activeId.includes('-');
    const normalizedNumber = '#' + activeId.replace(/^#+/, '');
    const orderFilter = isUUID ? `id=eq.${activeId}` : `order_number=eq.${normalizedNumber}`;
    
    // Channel 1: Subscribe to order row changes (status, driver_id, and embedded coords)
    const orderChannel = supabase.channel(`order_track_${activeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: orderFilter }, 
        (payload) => {
          const newOrder = payload.new as any;
          setOrder((prev: any) => ({ ...prev, ...newOrder }));

          // If driver coords are embedded on the order row, update live
          if (newOrder.driver_latitude && newOrder.driver_longitude) {
            const loc = {
              latitude: Number(newOrder.driver_latitude),
              longitude: Number(newOrder.driver_longitude),
              heading: Number(newOrder.driver_heading || 0)
            };
            setDriverLocation(loc);
            lastKnownDriverLocation.current = loc;
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [activeId]);

  // Channel 2: Watch the `drivers` table for live GPS coord updates
  // (The Driver App writes to drivers.current_lat/lng via LocationService.ts)
  useEffect(() => {
    const driverId = order?.driver_id;
    if (!driverId) return;

    const driverChannel = supabase.channel(`driver_loc_${driverId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => {
          const d = payload.new as any;
          if (d.current_lat && d.current_lng) {
            const loc = {
              latitude: Number(d.current_lat),
              longitude: Number(d.current_lng),
              heading: Number(d.heading || 0)
            };
            setDriverLocation(loc);
            lastKnownDriverLocation.current = loc;
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(driverChannel);
    };
  }, [order?.driver_id]);

  const handleCallDriver = () => {
    const phone = driverDetails?.phone || order?.driver_phone || "";
    const driverName = driverDetails?.name || order?.driver_name || "Driver";
    if (!phone) {
      Alert.alert("No Driver Yet", "A driver has not been assigned to your order yet. Please wait or contact support.");
      return;
    }
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


  const handleCallSupport = () => {
    Alert.alert(
      "PuntEats Support 📞",
      "Connecting to customer care...",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => {
            if (Platform.OS !== "web") {
              Linking.openURL('tel:+252907123456').catch(() => {});
            }
          },
        },
      ]
    );
  };

  const handleCancelOrder = () => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled', cancellation_reason: 'Cancelled by customer' })
                .eq('id', activeId);
              if (error) throw error;
              setOrder((prev: any) => ({ ...prev, status: 'cancelled', cancellation_reason: 'Cancelled by customer' }));
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to cancel order.");
            }
          }
        }
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

  let validUserLat = userLocation?.latitude;
  let validUserLng = userLocation?.longitude;

  const parseCoord = (val1: any, val2: any, fallback: number) => {
    const n = Number(val1 || val2);
    return (!isNaN(n) && n !== 0) ? n : fallback;
  };

  const GAROWE_LAT = 8.4021;
  const GAROWE_LNG = 48.4845;

  const destLat = parseCoord(order?.delivery_lat, order?.delivery_latitude, validUserLat || GAROWE_LAT);
  const destLng = parseCoord(order?.delivery_lng, order?.delivery_longitude, validUserLng || GAROWE_LNG);
  const destination = { latitude: destLat, longitude: destLng };

  const restLat = parseCoord(order?.restaurant_lat, order?.restaurant_latitude, GAROWE_LAT);
  const restLng = parseCoord(order?.restaurant_lng, order?.restaurant_longitude, GAROWE_LNG);

  // Use live location if available, otherwise show last known (graceful fallback)
  const liveDriver = driverLocation || lastKnownDriverLocation.current || null;

  // Safely parse JSON items (MUST BE ABOVE EARLY RETURNS TO OBEY RULES OF HOOKS)
  const parsedItems = React.useMemo(() => {
    const itemsData = order?.rawItems || order?.items;
    if (!itemsData) return [];
    
    if (typeof itemsData === 'string') {
      try {
        // Try to parse if it's a raw JSON string from Supabase Realtime
        return JSON.parse(itemsData);
      } catch (e) {
        // If it fails (Unexpected character 'x'), it means it's a flattened summary string like "1x pizza"
        // In this case, we just return it as a generic single item so the receipt doesn't crash.
        return [{ 
          name: itemsData, 
          quantity: 1, 
          price: typeof order?.total_price === 'number' ? order.total_price : parseFloat((order?.total || "0").replace('$', '')) || 0 
        }];
      }
    }
    return Array.isArray(itemsData) ? itemsData : [];
  }, [order]);

  useEffect(() => {
    if (order && liveDriver) {
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
    } else if (order) {
      // Just fit to customer and restaurant if no driver
      const coordinatesToFit = [
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

  // Define displayOrderId consistently
  const displayId = activeId || "PG123456";
  let displayOrderId = order?.order_number || displayId;
  if (!displayOrderId.startsWith('#')) {
    displayOrderId = '#' + displayOrderId;
  }
  displayOrderId = displayOrderId.replace(/^#+/, '#'); 

  // 🚨 IF DATA IS MISSING AND STILL LOADING:
  if (loading && !order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            router.replace('/(tabs)');
          }}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading Order...</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#6B7280', fontSize: 16 }}>Fetching order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 🚨 IF ORDER IS CANCELLED / REJECTED:
  let subtotal = order?.total_price || 0;
  if (order?.status?.toLowerCase() === 'cancelled' || order?.status?.toLowerCase() === 'rejected') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            router.replace('/(tabs)');
          }}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Cancelled</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons color="#DC2626" name="close-circle" size={48}/>
            </View>

            <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>Order Cancelled</Text>
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
              Your order {displayOrderId} from {order?.restaurant_name || order?.restaurant || 'the restaurant'} has been cancelled.
            </Text>

            <View style={{ width: '100%', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="information-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase' }}>Cancellation Reason</Text>
              </View>
              <Text style={{ fontSize: 15, color: '#DC2626', lineHeight: 22 }}>
                {order?.rejection_reason || 'Order was cancelled by the restaurant or admin.'}
              </Text>
            </View>

            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: '#111827', paddingVertical: 16, borderRadius: 12, alignItems: 'center' }} 
              onPress={() => router.replace('/(tabs)/orders')}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>Back to Orders</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{ width: '100%', paddingVertical: 16, alignItems: 'center', marginTop: 8 }} 
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={{ color: '#4B5563', fontWeight: 'bold', fontSize: 15 }}>Browse Restaurants</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }



  // 🚨 IF ORDER IS DELIVERED:
  if (order?.status?.toLowerCase() === 'delivered' || order?.status?.toLowerCase() === 'completed') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => {
            router.replace('/(tabs)');
          }}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order E-Receipt</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Header Banner */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-done" size={44} color="#10B981" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#064E3B', marginBottom: 8 }}>Order Delivered!</Text>
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
              Your food from {order?.restaurant_name || order?.restaurant || 'the restaurant'} was delivered successfully.
            </Text>
          </View>

          {/* Receipt Card */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', borderStyle: 'dashed' }}>
              <View>
                <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>Order Number</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{displayOrderId}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>Date</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#4B5563' }}>{orderTimeStr}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>Items Delivered</Text>
            
            <View style={{ marginBottom: 20 }}>
              {parsedItems.length > 0 ? (
                parsedItems.map((item: any, idx: number) => (
                  <View key={`receipt-${item.id || item.name}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Image 
                      source={{ uri: item.image || item.image_url || 'https://via.placeholder.com/150' }} 
                      style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#F3F4F6' }} 
                      resizeMode="cover" 
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', textTransform: 'capitalize' }} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                        Qty: {item.quantity || 1}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>
                      ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 15, color: '#6B7280', fontStyle: 'italic' }}>
                  No item details available.
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#4B5563' }}>Total Paid</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#10B981' }}>
                {typeof order?.total_price === 'number' ? `$${order.total_price.toFixed(2)}` : (order?.total || `$${order?.total_price || '0.00'}`)}
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={{ width: '100%', backgroundColor: '#1B7D3C', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#1B7D3C', shadowOffset: {width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }} 
            onPress={() => router.replace('/(tabs)/orders')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Close Receipt</Text>
          </TouchableOpacity>
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
            router.replace("/(tabs)/orders");
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={{ width: 44 }} />
      </View>

      {locationPermissionGranted === false && (
        <GpsBanner onPress={() => Linking.openSettings()} />
      )}

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
            {order?.status?.toLowerCase() === 'cancelled' && (
              <View style={styles.cancelledBanner}>
                <Text style={styles.cancelledBannerText}>
                  ❌ Order Cancelled: {order?.cancellation_reason || 'Restaurant or Driver unable to fulfill'}
                </Text>
              </View>
            )}

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
                    {order?.restaurant_name === 'PuntEats Restaurant' || order?.restaurant_name === 'PuntEats Partner' 
                      ? 'Restaurant' 
                      : (order?.restaurant_name || "Pizza House")}
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
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={[styles.stepTitle, currentStep >= 2 ? styles.stepTitleActive : styles.stepTitleInactive]}>
                      Out for Delivery
                    </Text>
                    {driverDetails?.name ? (
                      <View style={styles.driverBadge}>
                        <Text style={styles.driverBadgeText}>🛵 {driverDetails.name}</Text>
                      </View>
                    ) : order?.driver_id ? (
                      <View style={[styles.driverBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.driverBadgeText, { color: '#92400E' }]}>🔄 Loading driver...</Text>
                      </View>
                    ) : null}
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
                {liveDriver && (
                  <Marker
                    coordinate={{ latitude: liveDriver.latitude, longitude: liveDriver.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    rotation={liveDriver.heading}
                    title={driverDetails?.name || order?.driver_name || "Driver"}
                  >
                    <View style={styles.scooterPin}>
                      <Ionicons color="#1B7D3C" name="bicycle" size={24} />
                    </View>
                  </Marker>
                )}

                {/* REALTIME POLYLINE ROUTE FROM DRIVER TO DESTINATION */}
                {liveDriver && (
                  <Polyline
                    coordinates={[
                      { latitude: liveDriver.latitude, longitude: liveDriver.longitude },
                      { latitude: destLat, longitude: destLng }
                    ]}
                    strokeColor="#1B7D3C"
                    strokeWidth={4}
                  />
                )}
              </MapView>

              {/* FLOATING LIVE KM CARD */}
              {/* Show "Searching for driver" pill when no driver yet */}
              {!order?.driver_id && (
                <View style={{ position: 'absolute', top: 12, left: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }], marginRight: 10 }}>
                    <Ionicons name="locate" size={20} color="#F5A623" />
                  </Animated.View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>Searching for nearest driver...</Text>
                    <Text style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>You'll be notified when a driver accepts</Text>
                  </View>
                </View>
              )}
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
              <TouchableOpacity style={styles.chatDriverPill} activeOpacity={0.85} onPress={handleOpenChat}>
                <Ionicons name="chatbubble" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                <Text style={styles.chatDriverText}>Chat with Driver</Text>
                {unreadCount > 0 && (
                  <View style={styles.redBadge}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.callCircleBtn} activeOpacity={0.85} onPress={handleCallDriver}>
                <Ionicons name="call" size={22} color="#1A1A1A" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.callCircleBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]} activeOpacity={0.85} onPress={handleCallSupport}>
                <Ionicons name="help-buoy" size={22} color="#DC2626" />
              </TouchableOpacity>
            </View>

            {order?.status?.toLowerCase() === 'pending' && (
              <TouchableOpacity style={styles.cancelOrderBtn} activeOpacity={0.8} onPress={handleCancelOrder}>
                <Text style={styles.cancelOrderText}>Cancel Order</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
      </ScrollView>

      {/* DRIVER CHAT MODAL */}
      <DriverChatModal
        visible={isChatOpen}
        onClose={handleCloseChat}
        orderId={(activeId as string)?.replace(/^#+/, '')}
        customerName={order?.customer_name || 'Customer'}
        driverName={driverDetails?.name || order?.driver_name || 'Driver'}
      />
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  cancelledBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  cancelledBannerText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  headerRightPlaceholder: {
    width: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  cancelOrderBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelOrderText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 16,
  },
  bottomActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatDriverPill: {
    flex: 1,
    backgroundColor: "#1B7D3C",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  chatDriverText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  redBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
