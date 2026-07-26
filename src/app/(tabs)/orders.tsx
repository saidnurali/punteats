import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getStoredOrders, LiveOrder } from "@/lib/ordersStore";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { OrderCardSkeleton } from "@/components/SkeletonLoader";

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCacheOnce = async () => {
    try {
      const cachedOrders = await AsyncStorage.getItem('@cached_my_orders');
      if (cachedOrders && cachedOrders !== '[]') {
        setOrders(JSON.parse(cachedOrders));
        setLoading(false);
      }
    } catch {}
  };

  const fetchOrders = async () => {
    try {
      const storedSession = await AsyncStorage.getItem('puntgo_user_session');
      let userId = undefined;
      let userPhone = undefined;
      if (storedSession) {
        const p = JSON.parse(storedSession);
        userId = p.id;
        userPhone = p.phone_number;
      }

      let query = supabase.from('orders').select('*').limit(30);
      
      if (userId) {
        query = query.eq('user_id', userId);
      } else if (userPhone) {
        query = query.eq('customer_phone', userPhone);
      } else {
        // Fallback for completely anonymous users to prevent DB timeouts
        // By filtering to a specific known phone, we prevent full table scans
        query = query.eq('customer_phone', "+252 90 7112233"); 
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      let finalData = data;

      if (error) {
        if (typeof error.message === 'string' && error.message.trim().startsWith('[')) {
          try {
            finalData = JSON.parse(error.message);
          } catch {
            console.warn("fetchOrders Supabase Error:", error);
          }
        } else {
          console.warn("fetchOrders Supabase Error:", error);
        }
      }

      if (finalData) {
        const mapped = finalData.map((o: any) => {
          let parsedItems = o.items;
          if (typeof parsedItems === "string") {
            try { parsedItems = JSON.parse(parsedItems); } catch {}
          }
          
          let itemsStr = "Order items";
          if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            itemsStr = parsedItems.map((i: any) => {
              if (typeof i === 'string') return i;
              return `${i.quantity || 1}x ${i.name || "Item"}`;
            }).join(", ");
          } else if (typeof parsedItems === "string" && parsedItems.trim()) {
            itemsStr = parsedItems;
          } else if (typeof parsedItems === "object" && parsedItems !== null) {
            itemsStr = parsedItems.summary || "Order items";
          }

          const totalNum = typeof o.total_price === "number" ? o.total_price : parseFloat(o.total_price) || 0;
          return {
            id: o.order_number || o.id,
            dbId: o.id,
            customerName: o.customer_name || "Customer",
            restaurant: o.restaurant_name || "Garowe Restaurant",
            items: itemsStr || "Order items",
            address: o.delivery_address || "Garowe, Puntland",
            total: `$${totalNum.toFixed(2)}`,
            status: o.status || "Pending",
            time: o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
            phone: o.customer_phone || "+252 90 7000000",
            paymentMethod: o.payment_method || "Cash on Delivery",
            createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
            deliveryFee: "$1.50",
            subtotal: `$${Math.max(0, totalNum - 1.5).toFixed(2)}`,
            driver: o.driver || undefined,
            rejectionReason: o.rejection_reason || undefined,
          };
        });
        setOrders(mapped);
        AsyncStorage.setItem('@cached_my_orders', JSON.stringify(mapped)).catch(()=>null);
      }
      setLoading(false);
    } catch (err) {
      console.warn("fetchOrders unexpected error:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    let activeChannel: any;

    const initialize = async () => {
      await loadCacheOnce();
      await fetchOrders();

      try {
        const storedSession = await AsyncStorage.getItem('puntgo_user_session');
        let userPhone = "+252 90 7112233"; // Fallback to prevent global listening
        if (storedSession) {
          const p = JSON.parse(storedSession);
          userPhone = p.phone_number || userPhone;
        }

        const channelTopic = `my_orders_sync_${Math.random().toString(36).substring(2, 9)}`;
        activeChannel = supabase.channel(channelTopic)
          .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `customer_phone=eq.${userPhone}` }, () => {
            fetchOrders();
          })
          .subscribe();
      } catch (err) {
        console.warn("Realtime setup error:", err);
      }
    };

    initialize();

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, []);

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchOrders}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-outline" size={22} color="#1B7D3C" />
        </TouchableOpacity>
      </View>

      {loading && orders.length === 0 ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={60} color="#1B7D3C" />
          </View>
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>
            When you place orders for food delivery or taxi in Garowe, you can track them right here in real-time!
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            activeOpacity={0.88}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.exploreBtnText}>Explore Food Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {orders.map((order) => {
            const statusStr = (order.status as string)?.toLowerCase() || "";
            const isDelivered = statusStr === "delivered" || statusStr === "completed";
            const isCancelled = statusStr === "cancelled" || statusStr === "rejected";
            const isPreparing = statusStr === "preparing" || statusStr === "out for delivery" || statusStr === "on the way";
            
            let badgeBg = "#FEF3C7"; // Pending
            let badgeColor = "#D97706";
            
            if (isDelivered) { badgeBg = "#DCFCE7"; badgeColor = "#1B7D3C"; }
            else if (isCancelled) { badgeBg = "#FEE2E2"; badgeColor = "#DC2626"; }
            else if (isPreparing) { badgeBg = "#DBEAFE"; badgeColor = "#2563EB"; } // Blue for active states

            return (
              <Animated.View key={order.id} entering={FadeInDown.duration(400)}>
                <TouchableOpacity
                  style={styles.orderCard}
                onPress={() => router.push({
                  pathname: '/order-details/[id]',
                  params: { 
                    id: order.id,
                    status: order.status,
                    totalAmount: order.total,
                    restaurantName: order.restaurant
                  }
                })}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.restaurantRow}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="fast-food" size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={styles.orderNumber}>Order {order.id}</Text>
                      <Text style={styles.restaurantName}>{order.restaurant}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.statusText, { color: badgeColor }]}>{order.status}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <Text style={styles.itemsText} numberOfLines={2}>
                  {order.items}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.totalPrice}>{order.total}</Text>
                  <View style={styles.trackAction}>
                    <Text style={[styles.trackText, isCancelled && { color: "#DC2626" }]}>
                      {isCancelled ? "View Details" : "Track Order"}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={isCancelled ? "#DC2626" : "#1B7D3C"} />
                  </View>
                </View>
              </TouchableOpacity>
              </Animated.View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14.5,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 26,
  },
  exploreBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 32,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  restaurantName: {
    fontSize: 13,
    color: "#6B6B6B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },
  itemsText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalPrice: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  trackAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trackText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1B7D3C",
    marginRight: 2,
  },
});
