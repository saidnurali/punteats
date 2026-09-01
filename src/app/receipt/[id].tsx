import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function OrderReceiptScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", id)
          .single();
        if (!error && data) {
          setOrder(data);
        }
      } catch (err) {
        console.error("Fetch receipt error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleShare = async () => {
    if (!order) return;
    try {
      const receiptText = `
PuntEats - Order Receipt
Invoice: ${order.order_number || order.id}
Date: ${new Date(order.created_at).toLocaleString()}
Restaurant: ${order.restaurant_name || "Restaurant"}
Total Paid: $${(parseFloat(order.total_price) || 0).toFixed(2)}
      `.trim();

      await Share.share({
        message: receiptText,
        title: "PuntEats Receipt",
      });
    } catch (error) {
      console.error("Error sharing receipt:", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color="#1B7D3C" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.centered} edges={["top", "bottom"]}>
        <Text style={{ fontSize: 16, color: "#6B6B6B" }}>Receipt not found.</Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
          <Text style={{ color: "#1B7D3C", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Parse items safely
  let items: any[] = [];
  try {
    if (typeof order.items === "string") {
      items = JSON.parse(order.items);
    } else if (Array.isArray(order.items)) {
      items = order.items;
    }
  } catch (e) {}

  const total = parseFloat(order.total_price) || 0;
  const deliveryFee = 2.0; // Assuming static/default or extracted from total if available
  const subtotal = Math.max(0, total - deliveryFee);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Receipt</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.receiptCard}>
          {/* Logo Section */}
          <View style={styles.logoRow}>
            <Image
              source={require("../../../assets/branding/punteats-logo.png")}
              style={{ width: 180, height: 50 }}
              resizeMode="contain"
            />
          </View>

          {/* Invoice Meta */}
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>Invoice</Text>
              <Text style={styles.metaValue}>{order.order_number || `#${String(order.id).substring(0, 8)}`}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.metaLabel}>Date & Time</Text>
              <Text style={styles.metaValue}>{new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Restaurant & Delivery Info */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Restaurant</Text>
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={16} color="#6B6B6B" />
              <Text style={styles.infoText}>{order.restaurant_name || "Restaurant"}</Text>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Delivery Address</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#6B6B6B" />
              <Text style={styles.infoText}>{order.delivery_address || "Garowe, Nugaal, Somalia"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Item</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}>Qty</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Price</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Total</Text>
            </View>

            {items.map((item: any, idx: number) => {
              const qty = item.quantity || 1;
              const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
              const lineTotal = qty * price;
              return (
                <View key={idx} style={styles.itemRow}>
                  <Text style={[styles.itemText, { flex: 2 }]} numberOfLines={2}>
                    {item.name || "Item"}
                  </Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: "center" }]}>{qty}</Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: "right" }]}>${price.toFixed(2)}</Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: "right" }]}>${lineTotal.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Food Subtotal</Text>
              <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee</Text>
              <Text style={styles.totalValue}>${deliveryFee.toFixed(2)}</Text>
            </View>
            {/* Promo could go here if in DB */}
            
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total Amount Paid</Text>
              <Text style={styles.grandTotalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentBadge}>
              <Ionicons name="wallet-outline" size={16} color="#1A1A1A" />
              <Text style={styles.paymentText}>{order.payment_method || "Cash on Delivery"}</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-social-outline" size={20} color="#1B7D3C" />
          <Text style={styles.shareBtnText}>Share Receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.push("/(tabs)")} activeOpacity={0.8}>
          <Ionicons name="home-outline" size={20} color="#FFFFFF" />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  
  scrollContent: { padding: 20, paddingBottom: 40 },
  receiptCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#1B7D3C",
    alignItems: "center", justifyContent: "center",
    marginRight: 10,
  },
  logoText: { fontSize: 22, fontWeight: "800", color: "#1A1A1A" },
  
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  metaValue: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 16, borderStyle: "dashed" },
  
  infoSection: {},
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoText: { fontSize: 13, color: "#4B5563", marginLeft: 8 },
  
  itemsSection: {},
  tableHeader: { flexDirection: "row", marginBottom: 12 },
  tableHeaderText: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  itemRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-start" },
  itemText: { fontSize: 13, color: "#1A1A1A" },
  
  totalsSection: { gap: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 14, color: "#4B5563" },
  totalValue: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  grandTotalLabel: { fontSize: 16, fontWeight: "800", color: "#1B7D3C" },
  grandTotalValue: { fontSize: 18, fontWeight: "800", color: "#1B7D3C" },
  
  paymentSection: { marginTop: 24 },
  paymentBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, alignSelf: "flex-start",
  },
  paymentText: { fontSize: 13, fontWeight: "600", color: "#1A1A1A", marginLeft: 8 },
  
  bottomBar: {
    flexDirection: "row",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 12,
  },
  shareBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1, borderColor: "#BBF7D0",
    borderRadius: 25, paddingVertical: 14,
  },
  shareBtnText: { color: "#1B7D3C", fontSize: 15, fontWeight: "700", marginLeft: 8 },
  homeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1B7D3C",
    borderRadius: 25, paddingVertical: 14,
  },
  homeBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginLeft: 8 },
});
