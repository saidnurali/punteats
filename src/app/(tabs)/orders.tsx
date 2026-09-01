import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { getStoredOrders, LiveOrder, setMemoryOrders } from "@/lib/ordersStore";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLanguage } from "@/lib/LanguageContext";
import { OrderCardSkeleton } from "@/components/SkeletonLoader";
import { useCart, CartItem } from "@/lib/CartContext";
import { OrderRatingModal } from "@/components/OrderRatingModal";

const OrderCard = React.memo(({ order, onPress, onReorder }: { order: any, onPress: () => void, onReorder: () => void }) => {
  const statusStr = (order.status as string)?.toLowerCase() || "";
  const isDelivered = statusStr === "delivered" || statusStr === "completed";
  const isCancelled = statusStr === "cancelled" || statusStr === "rejected";
  const isPreparing = statusStr === "preparing" || statusStr === "out for delivery" || statusStr === "on the way";
  
  let badgeBg = "#FEF3C7"; // Pending
  let badgeColor = "#D97706";
  
  if (isDelivered) { badgeBg = "#DCFCE7"; badgeColor = "#1B7D3C"; }
  else if (isCancelled) { badgeBg = "#FEE2E2"; badgeColor = "#DC2626"; }
  else if (isPreparing) { badgeBg = "#DBEAFE"; badgeColor = "#2563EB"; }

  const { t } = useLanguage();
  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress} activeOpacity={0.7}>
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
            {isDelivered ? "View Receipt" : isCancelled ? t("view_details") : t("track_order")}
          </Text>
          <Ionicons name={isDelivered ? "receipt-outline" : "chevron-forward"} size={16} color={isCancelled ? "#DC2626" : "#1B7D3C"} />
        </View>
      </View>

      {/* RE-ORDER BUTTON — only shown for delivered orders */}
      {isDelivered && (
        <TouchableOpacity
          style={styles.reorderBtn}
          onPress={(e) => { e.stopPropagation?.(); onReorder(); }}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.reorderBtnText}>🔄 Re-Order</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

export default function OrdersScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { bulkAddToCart, clearCart } = useCart();
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingOrder, setRatingOrder] = useState<any | null>(null);

  const handleOrderPress = async (order: any) => {
    const statusStr = (order.status as string)?.toLowerCase() || "";
    if (statusStr === "delivered" || statusStr === "completed") {
      // Check if already rated
      try {
        const { data, error } = await supabase
          .from("order_reviews")
          .select("id")
          .eq("order_id", order.dbId)
          .maybeSingle();

        if (data) {
          router.push(`/receipt/${order.dbId}`);
        } else {
          setRatingOrder(order);
        }
      } catch (err) {
        router.push(`/receipt/${order.dbId}`);
      }
    } else {
      router.push({
        pathname: "/order-details/[id]",
        params: { id: order.id, orderData: JSON.stringify(order) },
      });
    }
  };

  const handleReorder = useCallback((order: any) => {
    // Parse items array from this order
    let parsedItems = order._rawItems;
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      Alert.alert('Re-Order', 'Could not find items for this order. Please order from the menu.');
      return;
    }
    // Build CartItem array from stored order items
    const cartItems: CartItem[] = parsedItems.map((item: any) => ({
      id: item.id || String(Math.random()),
      name: item.name || 'Item',
      price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
      quantity: item.quantity || 1,
      image: item.image || item.image_url || '',
      restaurant_id: item.restaurant_id || null,
      restaurant_name: item.restaurant_name || order.restaurant || 'Restaurant',
      category: item.category || '',
      rating: item.rating || 0,
      cartItemId: item.id || String(Math.random()),
    }));
    clearCart();
    bulkAddToCart(cartItems);
    Alert.alert(
      '🔄 Re-Order Ready!',
      `${cartItems.length} item(s) from ${order.restaurant} added to your cart.`,
      [
        { text: 'Keep Browsing', style: 'cancel' },
        { text: 'Go to Cart →', onPress: () => router.push('/(tabs)/cart') }
      ]
    );
  }, [bulkAddToCart, clearCart, router]);

  const mapOrder = (o: any) => {
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
    let displayRestaurant = o.restaurant_name;
    if (!displayRestaurant && Array.isArray(parsedItems)) {
      const names = [...new Set(parsedItems.map((i: any) => i.restaurant_name).filter(Boolean))];
      if (names.length > 0) displayRestaurant = names.join(', ');
    }
    
    return {
      id: o.order_number || o.id,
      dbId: o.id,
      _rawItems: parsedItems, // keep raw for re-order
      user_id: o.user_id,
      customer_id: o.customer_id,
      restaurant_id: o.restaurant_id,
      customerName: o.customer_name || "Customer",
      restaurant: displayRestaurant === 'PuntEats Restaurant' || displayRestaurant === 'PuntEats Partner' ? "Restaurant" : (displayRestaurant || "Restaurant"),
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
      driver_id: o.driver_id || undefined,
      rejectionReason: o.rejection_reason || undefined,
    };
  };

  const fetchOrders = async () => {
    setLoading(true);
    let userId;
    let userPhone;
    try {
      const storedSession = await AsyncStorage.getItem('puntgo_user_session');
      if (storedSession) {
        const p = JSON.parse(storedSession);
        userId = p.id;
        userPhone = p.phone_number;
      }
    } catch {}
    
    if (!userId && !userPhone) {
      setOrders([]);
      setLoading(false);
      return;
    }
    
    let query = supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, restaurant_name, items, total_price, delivery_address, status, payment_method, driver, driver_id, rejection_reason, created_at, user_id')
      .limit(30);

    // Security: Only fetch orders that belong to the authenticated user ID
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // Must not query all orders if no user!
      setOrders([]);
      setLoading(false);
      return;
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setOrders(data.map(mapOrder));
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const refreshBackground = async () => {
        let userId: string | undefined;
        let userPhone: string | undefined;
        try {
          const storedSession = await AsyncStorage.getItem('puntgo_user_session');
          if (storedSession) {
            const p = JSON.parse(storedSession);
            userId = p.id;
            userPhone = p.phone_number;
          }
        } catch {}

        // Load instantly from global ordersStore cache
        const cached = await getStoredOrders();
        if (cached.length > 0 && isMounted) {
          setOrders(cached);
          setLoading(false);
        }

        // Silent HTTP fetch
        try {
          let query = supabase
            .from('orders')
            .select('id, order_number, customer_name, customer_phone, restaurant_name, items, total_price, delivery_address, status, payment_method, driver, driver_id, rejection_reason, created_at, user_id')
            .limit(30);

          if (userId) {
            query = query.eq('user_id', userId);
          } else {
            if (isMounted) {
              setOrders([]);
              setLoading(false);
            }
            return;
          }

          const { data, error } = await query.order('created_at', { ascending: false });
          let finalData = data;
          if (error && typeof error.message === 'string' && error.message.trim().startsWith('[')) {
            try { finalData = JSON.parse(error.message); } catch {}
          }
          if (finalData && isMounted) {
            const mapped = finalData.map(mapOrder);
            // Deduplicate orders by id to prevent React key warnings
            const uniqueOrders = Array.from(new Map(mapped.map((item: any) => [item.id, item])).values()) as LiveOrder[];
            
            setOrders(uniqueOrders);
            setMemoryOrders(uniqueOrders); // Update shared cache in ordersStore
          }
        } catch (err) {
          console.warn("Orders fetch error:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      refreshBackground();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  useEffect(() => {
    let activeChannel: any;

    const setupRealtime = async () => {
      let userId: string | undefined;
      let userPhone: string | undefined;
      try {
        const storedSession = await AsyncStorage.getItem('puntgo_user_session');
        if (storedSession) {
          const p = JSON.parse(storedSession);
          userId = p.id;
          userPhone = p.phone_number;
        }
      } catch {}

      if (!userId && !userPhone) return;

      try {
        const filter = userId
          ? `user_id=eq.${userId}`
          : `customer_phone=eq.${userPhone}`;

        const channelName = `my_orders_${userId ?? userPhone}_${Date.now()}`;
        activeChannel = supabase.channel(channelName)
          .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, (payload) => {
            const newRecord = payload.new as any;
            setOrders(prevOrders => {
              let updated = [...prevOrders];
              if (payload.eventType === 'UPDATE') {
                updated = updated.map(o => o.dbId === newRecord.id ? mapOrder(newRecord) : o);
              } else if (payload.eventType === 'INSERT') {
                // If it already exists, don't duplicate it
                if (!updated.find(o => o.dbId === newRecord.id)) {
                  updated = [mapOrder(newRecord), ...updated];
                }
              } else if (payload.eventType === 'DELETE') {
                updated = updated.filter(o => o.dbId !== payload.old.id);
              }
              setMemoryOrders(updated);
              return updated;
            });
          })
          .subscribe();
      } catch (err) {
        console.warn("Realtime setup error:", err);
      }
    };

    setupRealtime();

    return () => {
      if (activeChannel) supabase.removeChannel(activeChannel);
    };
  }, []);

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("my_orders")}</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchOrders}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-outline" size={22} color="#1B7D3C" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', marginHorizontal: 20, marginTop: 16, marginBottom: 4, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#DCFCE7' }}
        onPress={() => router.push('/parcel/history')}
        activeOpacity={0.8}
      >
        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#1B7D3C', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="cube" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1B7D3C' }}>Parcel Deliveries</Text>
          <Text style={{ fontSize: 12, color: '#1B7D3C', opacity: 0.8, marginTop: 2 }}>Track or view your parcel history</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#1B7D3C" />
      </TouchableOpacity>

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
          <Text style={styles.emptyTitle}>{t("no_orders_yet")}</Text>
          <Text style={styles.emptySubtitle}>
            {t("no_orders_sub")}
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            activeOpacity={0.88}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.exploreBtnText}>{t("start_ordering")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item, index) => `${item.id}-${item.dbId || index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          initialNumToRender={8}
          windowSize={5}
          renderItem={({ item }) => (
            <OrderCard 
              order={item} 
              onPress={() => handleOrderPress(item)}
              onReorder={() => handleReorder(item)}
            />
          )}
        />
      )}

      {ratingOrder && (
        <OrderRatingModal
          visible={!!ratingOrder}
          orderId={ratingOrder.dbId}
          userId={ratingOrder.user_id || ratingOrder.customer_id || ""} // Pass user id (if available locally, or wait, we need it. Let's use profile fetch or local session if needed, but the modal accepts it so we should parse it from session later if missing, but wait, we have user ID in session)
          restaurantId={ratingOrder.restaurant_id}
          restaurantName={ratingOrder.restaurant}
          driverId={ratingOrder.driver_id}
          driverName={ratingOrder.driver?.name}
          onClose={() => setRatingOrder(null)}
          onSubmitSuccess={() => {
            const id = ratingOrder.dbId;
            setRatingOrder(null);
            router.push(`/receipt/${id}`);
          }}
        />
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
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B7D3C",
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 14,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  reorderBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
