import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getStoredOrders, setMemoryOrders } from "@/lib/ordersStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart } from "@/lib/CartContext";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/getCurrentUser";

const isValidUUID = (uuid: any) => {
  return typeof uuid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
};

export default function PaymentSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ total?: string; address?: string; special_instructions?: string }>();
  const { cartItems, totalPrice, clearCart } = useCart();

  const deliveryFee = 1.5;
  const computedTotal = totalPrice > 0 ? totalPrice + deliveryFee : parseFloat(params.total || "14.50");

  const [selectedMethod, setSelectedMethod] = useState<"Cash on Delivery" | "Mobile Money" | "Card Payment">("Cash on Delivery");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState("#PG123456");
  const [dbOrderId, setDbOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");

  // useRef prevents recreating Animated.Value on every render
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newId = `#PG${Math.floor(100000 + Math.random() * 900000)}`;
      setPlacedOrderId(newId);

      let custName = "Customer";
      let custPhone = "+252 90 7112233";

      const currentProfile = await getCurrentUser();
      if (currentProfile) {
        custName = currentProfile.full_name || "Customer";
        custPhone = currentProfile.phone_number || "+252 90 7112233";
      }

      // Enforce authenticated user context for RLS
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isValidUUID(user.id)) {
        throw new Error("You must be logged in to place an order.");
      }
      const userId = user.id;

      const uniqueRestaurants = [...new Set(cartItems.map(item => item.restaurant_name).filter(Boolean))];
      let dynamicRestaurantName = cartItems[0]?.restaurant_name || (cartItems[0] as any)?.restaurant;
      if (!dynamicRestaurantName && uniqueRestaurants.length > 0) dynamicRestaurantName = uniqueRestaurants.join(', ');
      if (!dynamicRestaurantName) dynamicRestaurantName = 'Restaurant';

      if (!dynamicRestaurantName || dynamicRestaurantName === 'PuntEats Restaurant') {
        dynamicRestaurantName = 'Restaurant';
      }

      const realRestaurantId = cartItems[0]?.restaurant_id || null;
      const itemsSummary = cartItems.map(item => `${item.quantity || 1}x ${item.name || "Item"}`).join(", ");

      const restaurantName = cartItems[0]?.restaurant_name || (cartItems[0] as any)?.restaurant?.name || dynamicRestaurantName || 'Restaurant';
      const restaurantId = realRestaurantId || cartItems[0]?.restaurant_id || (cartItems[0] as any)?.restaurant?.id;

      const calculatedTotal = Number(computedTotal || 0);

      const deliveryAddress = params.address || "Home • Garowe, Puntland, Somalia";
      if (deliveryAddress === "Home • Garowe, Puntland, Somalia" || deliveryAddress.length < 5) {
        throw new Error("Please go back and enter a valid, specific delivery address.");
      }

      if (!isValidUUID(restaurantId)) {
        throw new Error("Invalid or missing Restaurant ID. Please clear cart and try again.");
      }

      // SAFE INSERTION: Only include columns that actually exist in the database schema!
      const orderPayload: any = {
        user_id: userId,
        order_number: newId, 
        restaurant_id: restaurantId,
        restaurant_name: restaurantName,
        customer_name: custName,
        customer_phone: custPhone,
        items: itemsSummary,
        total_price: calculatedTotal,
        delivery_address: deliveryAddress,
        payment_method: selectedMethod || 'cash_on_delivery',
        status: 'Pending',
        created_at: new Date().toISOString()
      };

      console.log("Invoking server-side create-order function...");
      const { data: responseData, error: invokeError } = await supabase.functions.invoke('create-order', {
        body: { orderPayload, cartItems }
      });

      if (invokeError) {
        throw new Error(invokeError.message === "Edge Function returned a non-2xx status code" 
          ? "The server rejected the order (e.g., minimum order not met or invalid address). Please check your cart." 
          : invokeError.message);
      }

      if (responseData?.error) {
        throw new Error(responseData.error);
      }

      const newOrder = responseData?.data;

      if (newOrder && newOrder.id) {
        setDbOrderId(newOrder.id);
      }

      setPlacedOrderId(newId);
      setSuccessModalVisible(true);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } catch (err: any) {
      Alert.alert("Error", err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackMyOrder = () => {
    setSuccessModalVisible(false);
    clearCart(); // Clear cart ONLY when leaving the screen
    if (dbOrderId) {
      router.replace({ pathname: '/order-tracking/[id]', params: { id: dbOrderId } });
    } else {
      router.replace("/(tabs)/orders");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Payment</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeading}>Select Payment Method</Text>

        {/* 1. Cash on Delivery (DEFAULT ACTIVE) */}
        <TouchableOpacity
          style={[styles.paymentCard, selectedMethod === "Cash on Delivery" && styles.paymentCardActive]}
          activeOpacity={0.88}
          onPress={() => setSelectedMethod("Cash on Delivery")}
        >
          <View style={styles.paymentCardLeft}>
            <View style={[styles.iconCircle, selectedMethod === "Cash on Delivery" && styles.iconCircleActive]}>
              <Ionicons
                name="cash-outline"
                size={22}
                color={selectedMethod === "Cash on Delivery" ? "#FFFFFF" : "#1B7D3C"}
              />
            </View>
            <Text style={[styles.cardTitleText, selectedMethod === "Cash on Delivery" && { fontWeight: "800" }]}>
              Cash on Delivery
            </Text>
          </View>

          <View style={styles.radioContainer}>
            {selectedMethod === "Cash on Delivery" ? (
              <Ionicons name="checkmark-circle" size={26} color="#1B7D3C" />
            ) : (
              <View style={styles.radioEmpty} />
            )}
          </View>
        </TouchableOpacity>

        {/* 2. Mobile Money */}
        <TouchableOpacity
          style={[styles.paymentCard, selectedMethod === "Mobile Money" && styles.paymentCardActive]}
          activeOpacity={0.88}
          onPress={() => setSelectedMethod("Mobile Money")}
        >
          <View style={styles.paymentCardLeft}>
            <View style={[styles.iconCircle, selectedMethod === "Mobile Money" && styles.iconCircleActive]}>
              <Ionicons
                name="phone-portrait-outline"
                size={22}
                color={selectedMethod === "Mobile Money" ? "#FFFFFF" : "#1B7D3C"}
              />
            </View>
            <View>
              <Text style={[styles.cardTitleText, selectedMethod === "Mobile Money" && { fontWeight: "800" }]}>
                Mobile Money
              </Text>
              <Text style={styles.cardSubtitleText}>(E-dahab, Zaad, Sahal)</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.comingSoonTag}>Popular</Text>
            {selectedMethod === "Mobile Money" ? (
              <Ionicons name="checkmark-circle" size={26} color="#1B7D3C" />
            ) : (
              <View style={styles.radioEmpty} />
            )}
          </View>
        </TouchableOpacity>

        {/* Mobile Money Input Field (Conditional) */}
        {selectedMethod === "Mobile Money" && (
          <View style={styles.mobileMoneyInputContainer}>
            <Text style={styles.mobileMoneyLabel}>Enter Mobile Money Number</Text>
            <View style={styles.mobileMoneyInputWrapper}>
              <Text style={styles.mobileMoneyPrefix}>+252</Text>
              <TextInput
                style={styles.mobileMoneyInput}
                placeholder="90 7000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={mobileNumber}
                onChangeText={setMobileNumber}
                maxLength={9}
              />
            </View>
            <Text style={styles.mobileMoneyHelp}>You will receive a prompt on this number to confirm payment.</Text>
          </View>
        )}

        {/* 3. Card Payment */}
        <TouchableOpacity
          style={[styles.paymentCard, selectedMethod === "Card Payment" && styles.paymentCardActive]}
          activeOpacity={0.88}
          onPress={() => setSelectedMethod("Card Payment")}
        >
          <View style={styles.paymentCardLeft}>
            <View style={[styles.iconCircle, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="card-outline" size={22} color="#3B82F6" />
            </View>
            <View>
              <Text style={[styles.cardTitleText, selectedMethod === "Card Payment" && { fontWeight: "800" }]}>
                Card Payment
              </Text>
              <Text style={styles.cardSubtitleText}>(Visa, MasterCard)</Text>
            </View>
          </View>

          <View style={styles.radioContainer}>
            {selectedMethod === "Card Payment" ? (
              <Ionicons name="checkmark-circle" size={26} color="#1B7D3C" />
            ) : (
              <View style={styles.radioEmpty} />
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* BOTTOM STICKY SUMMARY & ACTION */}
      <View style={styles.bottomStickyBar}>
        <View>
          <Text style={styles.totalLabel}>Total to pay</Text>
          <Text style={styles.totalAmount}>${computedTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.placeOrderBtn, isSubmitting && { opacity: 0.7 }]} 
          activeOpacity={0.88} 
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Place Order"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.placeOrderBtnText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* CONGRATULATIONS SUCCESS MODAL */}
      <Modal visible={successModalVisible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={54} color="#FFFFFF" />
            </View>

            <Text style={styles.congratsTitle}>Order Placed Successfully!</Text>
            <Text style={styles.congratsSub}>
              {selectedMethod === "Mobile Money" 
                ? "Your order is confirmed. A payment request will be sent to your phone shortly."
                : "Your order has been sent to the restaurant and will be delivered shortly."}
            </Text>

            <View style={styles.orderDetailsBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order ID:</Text>
                <Text style={styles.detailValBold}>{placedOrderId}</Text>
              </View>
              <View style={[styles.detailRow, { marginVertical: 8 }]}>
                <Text style={styles.detailLabel}>Delivery Address:</Text>
                <Text style={styles.detailValBold} numberOfLines={1}>
                  {params.address || "Garowe, Puntland, Somalia"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated Time:</Text>
                <Text style={[styles.detailValBold, { color: "#1B7D3C" }]}>20-30 mins</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.trackOrderBtn} activeOpacity={0.88} onPress={handleTrackMyOrder}>
              <Text style={styles.trackOrderBtnText}>Track Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backHomeBtn}
              activeOpacity={0.8}
              onPress={() => {
                setSuccessModalVisible(false);
                clearCart(); // Clear cart ONLY when leaving the screen
                router.replace("/(tabs)");
              }}
            >
              <Text style={styles.backHomeBtnText}>Browse Food / Back to Home</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
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
    paddingTop: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  paymentCardActive: {
    borderColor: "#1B7D3C",
    backgroundColor: "#F0FDF4",
  },
  paymentCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconCircleActive: {
    backgroundColor: "#1B7D3C",
  },
  cardTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  cardSubtitleText: {
    fontSize: 13,
    color: "#6B6B6B",
    marginTop: 2,
  },
  radioContainer: {
    marginLeft: 10,
  },
  radioEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  comingSoonTag: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#F5A623",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    overflow: "hidden",
  },
  mobileMoneyInputContainer: {
    backgroundColor: "#F0FDF4",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1B7D3C",
    marginTop: -4,
    marginBottom: 14,
  },
  mobileMoneyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1B7D3C",
    marginBottom: 8,
  },
  mobileMoneyInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
  },
  mobileMoneyPrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginRight: 8,
  },
  mobileMoneyInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#1A1A1A",
  },
  mobileMoneyHelp: {
    fontSize: 12,
    color: "#6B6B6B",
    marginTop: 8,
  },
  bottomStickyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  totalLabel: {
    fontSize: 13,
    color: "#6B6B6B",
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  placeOrderBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 36,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  placeOrderBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  congratsTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  congratsSub: {
    fontSize: 14.5,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  orderDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    width: "100%",
    marginTop: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B6B6B",
  },
  detailValBold: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1A1A1A",
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
  trackOrderBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  trackOrderBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  backHomeBtn: {
    width: "100%",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  backHomeBtnText: {
    color: "#6B6B6B",
    fontSize: 15,
    fontWeight: "700",
  },
});
