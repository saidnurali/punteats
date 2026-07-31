import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCart } from "@/lib/CartContext";
import { saveNewOrder, LiveOrder } from "@/lib/ordersStore";
import { supabase } from "@/lib/supabase";

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, totalPrice, clearCart } = useCart();

  // Progress Stepper state: 1 (Delivery) -> 2 (Payment) -> 3 (Confirm)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 states
  const [addressTitle, setAddressTitle] = useState("Home");
  const [addressDetails, setAddressDetails] = useState("Garowe, Puntland, Somalia");
  const [deliveryTime, setDeliveryTime] = useState("As soon as possible");
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [newTitleInput, setNewTitleInput] = useState("Work");
  const [newAddressInput, setNewAddressInput] = useState("Shaqaalaha District, Near Wadajir Hotel, Garowe");

  // Step 2 states
  const [paymentMethod, setPaymentMethod] = useState<"EVC Plus" | "Zaad" | "Sahal" | "Cash on Delivery">("EVC Plus");
  const [phoneNumber, setPhoneNumber] = useState("+252 90 7112233");

  const deliveryFee = 1.5;
  const finalTotal = totalPrice + deliveryFee;

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/(tabs)/cart");
      }
    }
  };

  const handleAddAddressSave = () => {
    if (!newAddressInput.trim()) return;
    setAddressTitle(newTitleInput.trim() || "Custom Address");
    setAddressDetails(newAddressInput.trim());
    setAddressModalOpen(false);
  };

  const handleCycleTime = () => {
    if (deliveryTime === "As soon as possible") {
      setDeliveryTime("Today at 6:30 PM");
    } else if (deliveryTime === "Today at 6:30 PM") {
      setDeliveryTime("Today at 7:30 PM");
    } else {
      setDeliveryTime("As soon as possible");
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert("Empty Cart", "Please add items before placing an order.");
      router.push("/(tabs)");
      return;
    }

    if (paymentMethod !== "Cash on Delivery" && (!phoneNumber || !phoneNumber.includes("+252"))) {
      Alert.alert("Invalid Phone Number", "Please enter a valid +252 Puntland mobile number for payment.");
      return;
    }

    const orderId = `#PG${Math.floor(100000 + Math.random() * 900000)}`;
    const restaurantName = cartItems[0]?.category.includes("Pizza")
      ? "Pizza House"
      : cartItems[0]?.category.includes("Burger")
      ? "Burger Point"
      : "Chicken Center";

    const { data: { user } } = await supabase.auth.getUser();
    const custName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Customer";

    const orderPayload = {
      order_number: orderId,
      user_id: user?.id || null,
      customer_name: custName,
      customer_phone: phoneNumber || "+252 90 7112233",
      restaurant_id: cartItems[0]?.restaurant_id || null,
      restaurant_name: restaurantName,
      items: cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      })),
      total_price: finalTotal,
      delivery_address: `${addressTitle} • ${addressDetails}`,
      status: 'Pending',
      payment_method: paymentMethod === "Cash on Delivery" ? "Cash on Delivery" : `${paymentMethod} (${phoneNumber})`,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('orders').insert([orderPayload]).select('id').single();
    
    if (error || !data?.id) {
      console.error("Order Insert Error:", error);
      Alert.alert("Error", "Could not place order. Please try again.");
      return;
    }

    clearCart();

    const guaranteedId = String(data.id);

    Alert.alert(
      "Order Placed Successfully 🎉",
      `Your order ${orderId} has been sent directly to the PuntGo Admin Panel under Pending Orders! We will deliver to ${addressTitle} (${addressDetails}) soon.`,
      [
        {
          text: "Track Order",
          onPress: () => {
            // Dismiss checkout stack and go to Orders tab first
            if (router.canDismiss()) {
              router.dismissAll();
            }
            router.replace('/(tabs)/orders');
            
            // Wait slightly for the tab to mount, then push the tracking page on top of it
            setTimeout(() => {
              router.push({
                pathname: `/order-details/[id]`,
                params: {
                  id: guaranteedId,
                  from: 'checkout',
                  status: 'Pending',
                  totalAmount: finalTotal,
                  restaurantName: restaurantName
                }
              });
            }, 50);
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER & STEP PROGRESS INDICATOR */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Checkout</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Progress Stepper Row */}
      <View style={styles.stepperRow}>
        {/* Step 1: Delivery */}
        <TouchableOpacity style={styles.stepItem} onPress={() => setStep(1)} activeOpacity={0.8}>
          <View style={[styles.stepCircle, step >= 1 ? styles.stepCircleActive : styles.stepCircleInactive]}>
            <Text style={[styles.stepNumber, step >= 1 ? styles.stepNumberActive : styles.stepNumberInactive]}>
              {step > 1 ? "✓" : "1"}
            </Text>
          </View>
          <Text style={[styles.stepLabel, step >= 1 ? styles.stepLabelActive : styles.stepLabelInactive]}>
            Delivery
          </Text>
        </TouchableOpacity>

        <View style={[styles.stepLine, step >= 2 ? styles.stepLineActive : styles.stepLineInactive]} />

        {/* Step 2: Payment */}
        <TouchableOpacity
          style={styles.stepItem}
          onPress={() =>
            router.push({
              pathname: "/payment",
              params: { total: finalTotal.toFixed(2), address: addressDetails },
            })
          }
          activeOpacity={0.8}
        >
          <View style={[styles.stepCircle, step >= 2 ? styles.stepCircleActive : styles.stepCircleInactive]}>
            <Text style={[styles.stepNumber, step >= 2 ? styles.stepNumberActive : styles.stepNumberInactive]}>
              2
            </Text>
          </View>
          <Text style={[styles.stepLabel, step >= 2 ? styles.stepLabelActive : styles.stepLabelInactive]}>
            Payment
          </Text>
        </TouchableOpacity>

        <View style={[styles.stepLine, step >= 3 ? styles.stepLineActive : styles.stepLineInactive]} />

        {/* Step 3: Confirm */}
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step === 3 ? styles.stepCircleActive : styles.stepCircleInactive]}>
            <Text style={[styles.stepNumber, step === 3 ? styles.stepNumberActive : styles.stepNumberInactive]}>
              3
            </Text>
          </View>
          <Text style={[styles.stepLabel, step === 3 ? styles.stepLabelActive : styles.stepLabelInactive]}>
            Confirm
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* STEP 1: DELIVERY */}
        {step === 1 && (
          <View>
            {/* 2. DELIVERY ADDRESS SECTION */}
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity
              style={styles.selectorCard}
              activeOpacity={0.85}
              onPress={() => setAddressModalOpen(true)}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="home" size={20} color="#1B7D3C" />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>{addressTitle}</Text>
                <Text style={styles.cardSubtitle}>{addressDetails}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B6B6B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addAddressRow}
              activeOpacity={0.7}
              onPress={() => setAddressModalOpen(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#1B7D3C" />
              <Text style={styles.addAddressText}>Add new address</Text>
            </TouchableOpacity>

            {/* 3. DELIVERY TIME SECTION */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Delivery Time</Text>
            <TouchableOpacity style={styles.selectorCard} activeOpacity={0.85} onPress={handleCycleTime}>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitleTime}>{deliveryTime}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B6B6B" />
            </TouchableOpacity>

            {/* 4. ORDER SUMMARY BREAKDOWN */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryHeader}>Order Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 2: PAYMENT */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <Text style={styles.sectionDescription}>
              Select your mobile money provider in Garowe or pay upon arrival.
            </Text>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === "EVC Plus" && styles.paymentCardActive]}
              activeOpacity={0.85}
              onPress={() => setPaymentMethod("EVC Plus")}
            >
              <View style={styles.paymentCardLeft}>
                <View style={styles.radioOuter}>
                  {paymentMethod === "EVC Plus" && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.paymentName}>EVC Plus (Hormuud)</Text>
                  <Text style={styles.paymentSub}>Instant mobile money transfer</Text>
                </View>
              </View>
              <Text style={styles.paymentBadge}>Popular</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === "Zaad" && styles.paymentCardActive]}
              activeOpacity={0.85}
              onPress={() => setPaymentMethod("Zaad")}
            >
              <View style={styles.paymentCardLeft}>
                <View style={styles.radioOuter}>
                  {paymentMethod === "Zaad" && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.paymentName}>Zaad Service</Text>
                  <Text style={styles.paymentSub}>Fast mobile payment</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === "Sahal" && styles.paymentCardActive]}
              activeOpacity={0.85}
              onPress={() => setPaymentMethod("Sahal")}
            >
              <View style={styles.paymentCardLeft}>
                <View style={styles.radioOuter}>
                  {paymentMethod === "Sahal" && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.paymentName}>Sahal (Golis)</Text>
                  <Text style={styles.paymentSub}>Puntland mobile wallet</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === "Cash on Delivery" && styles.paymentCardActive]}
              activeOpacity={0.85}
              onPress={() => setPaymentMethod("Cash on Delivery")}
            >
              <View style={styles.paymentCardLeft}>
                <View style={styles.radioOuter}>
                  {paymentMethod === "Cash on Delivery" && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.paymentName}>Cash on Delivery</Text>
                  <Text style={styles.paymentSub}>Pay driver when order arrives</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Phone Number input for Mobile Money */}
            {paymentMethod !== "Cash on Delivery" && (
              <View style={styles.phoneInputCard}>
                <Text style={styles.phoneLabel}>Mobile Number for {paymentMethod}</Text>
                <View style={styles.phoneRow}>
                  <Ionicons name="call" size={20} color="#1B7D3C" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="+252 90 7112233"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                </View>
                <Text style={styles.phoneHint}>We will send a USSD prompt directly to this number.</Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 3: CONFIRM */}
        {step === 3 && (
          <View>
            <Text style={styles.sectionTitle}>Review Your Order</Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Deliver to:</Text>
                <Text style={styles.reviewValueBold}>{addressTitle}</Text>
              </View>
              <Text style={styles.reviewSubValue}>{addressDetails}</Text>

              <View style={styles.divider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Delivery Time:</Text>
                <Text style={styles.reviewValue}>{deliveryTime}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Payment Method:</Text>
                <Text style={styles.reviewValueBold}>
                  {paymentMethod === "Cash on Delivery" ? "Cash on Delivery" : `${paymentMethod} (${phoneNumber})`}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Items inside order ({cartItems.length})</Text>
            <View style={styles.reviewCard}>
              {cartItems.map((item, index) => (
                <View key={item.id} style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10 }]}>
                  <Text style={styles.itemQty}>{item.quantity}x</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={[styles.divider, { marginVertical: 8 }]} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total to Pay</Text>
                <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Extra spacing for fixed bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* 5. BOTTOM ACTION BUTTON */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.88}
          onPress={() =>
            router.push({
              pathname: "/payment",
              params: { total: finalTotal.toFixed(2), address: addressDetails },
            })
          }
        >
          <Text style={styles.actionBtnText}>Continue to Payment</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: Add New Address */}
      <Modal visible={addressModalOpen} transparent animationType="fade" onRequestClose={() => setAddressModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Delivery Address</Text>
              <TouchableOpacity onPress={() => setAddressModalOpen(false)}>
                <Ionicons name="close" size={24} color="#6B6B6B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInputLabel}>Address Label (e.g. Home, Work)</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitleInput}
              onChangeText={setNewTitleInput}
              placeholder="Home"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalInputLabel}>Detailed Street Address / District</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
              value={newAddressInput}
              onChangeText={setNewAddressInput}
              multiline
              placeholder="Garowe Center, Near Wadajir Hotel"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity style={styles.modalSaveBtn} activeOpacity={0.88} onPress={handleAddAddressSave}>
              <Text style={styles.modalSaveBtnText}>Save Address</Text>
            </TouchableOpacity>
          </View>
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
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  stepCircleActive: {
    backgroundColor: "#1B7D3C",
  },
  stepCircleInactive: {
    backgroundColor: "#F1F5F9",
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "800",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepNumberInactive: {
    color: "#94A3B8",
  },
  stepLabel: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  stepLabelActive: {
    color: "#1B7D3C",
  },
  stepLabelInactive: {
    color: "#94A3B8",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: "#1B7D3C",
  },
  stepLineInactive: {
    backgroundColor: "#E2E8F0",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B6B6B",
    marginBottom: 14,
    lineHeight: 20,
  },
  selectorCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 3,
  },
  cardTitleTime: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  cardSubtitle: {
    fontSize: 13.5,
    color: "#6B6B6B",
  },
  addAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  addAddressText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1B7D3C",
    marginLeft: 6,
  },
  summaryBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 24,
  },
  summaryHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14.5,
    color: "#6B6B6B",
  },
  summaryValue: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B7D3C",
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentCardActive: {
    borderColor: "#1B7D3C",
    backgroundColor: "#F0FDF4",
  },
  paymentCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1B7D3C",
  },
  paymentName: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  paymentSub: {
    fontSize: 13,
    color: "#6B6B6B",
  },
  paymentBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1B7D3C",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  phoneInputCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginTop: 8,
  },
  phoneLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
  },
  phoneInput: {
    flex: 1,
    height: 46,
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  phoneHint: {
    fontSize: 12.5,
    color: "#6B6B6B",
    marginTop: 8,
  },
  reviewCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 16,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewLabel: {
    fontSize: 14,
    color: "#6B6B6B",
  },
  reviewValueBold: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  reviewValue: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  reviewSubValue: {
    fontSize: 13.5,
    color: "#6B6B6B",
    marginTop: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemQty: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1B7D3C",
    width: 32,
  },
  itemName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: "#1A1A1A",
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  actionBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  modalInputLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#4B5563",
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: "#1A1A1A",
  },
  modalSaveBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
