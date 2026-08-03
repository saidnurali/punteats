import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCart } from "@/lib/CartContext";
import Animated, { FadeIn } from "react-native-reanimated";

/**
 * Memoized cart row — only re-renders when its own item changes.
 * Prevents the entire list from re-rendering when one quantity changes.
 */
const CartItemRow = React.memo(({ item, onRemove, onDecrement, onIncrement }: {
  item: any;
  onRemove: (id: string) => void;
  onDecrement: (id: string) => void;
  onIncrement: (id: string) => void;
}) => (
  <View style={styles.card}>
    <Image
      source={{ uri: item.image }}
      style={styles.itemImage}
      contentFit="cover" cachePolicy="memory-disk" transition={200}
      recyclingKey={item.id}
    />
    <View style={styles.itemDetails}>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      <View style={styles.priceStepperRow}>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            activeOpacity={0.7}
            onPress={() => item.quantity === 1 ? onRemove(item.id) : onDecrement(item.id)}
          >
            <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={item.quantity === 1 ? "#6B6B6B" : "#4A4A4A"} />
          </TouchableOpacity>
          <Text style={styles.stepperCount}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            activeOpacity={0.7}
            onPress={() => onIncrement(item.id)}
          >
            <Ionicons name="add" size={16} color="#4A4A4A" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </View>
));

export default function CartScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const { cartItems, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo as string);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(tabs)");
    }
  };

  const handleProceedToPay = () => {
    if (cartItems.length === 0) return;
    router.push("/checkout");
  };

  // Stable handlers so CartItemRow's React.memo works
  const handleRemove = useCallback((id: string) => removeFromCart(id), [removeFromCart]);
  const handleDecrement = useCallback((id: string) => updateQuantity(id, -1), [updateQuantity]);
  const handleIncrement = useCallback((id: string) => updateQuantity(id, 1), [updateQuantity]);

  const renderCartItem = useCallback(({ item }: { item: any }) => (
    <CartItemRow
      item={item}
      onRemove={handleRemove}
      onDecrement={handleDecrement}
      onIncrement={handleIncrement}
    />
  ), [handleRemove, handleDecrement, handleIncrement]);

  // Stable extraData — avoids re-rendering all rows when only one quantity changes
  const cartExtraKey = useMemo(() => cartItems.map(c => `${c.id}:${c.quantity}`).join(','), [cartItems]);

  const CartFooter = useMemo(() => (
    <>
      <View style={styles.bottomBarBreakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Subtotal</Text>
          <Text style={styles.breakdownValue}>${totalPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Delivery Fee</Text>
          <Text style={styles.breakdownValue}>$1.50</Text>
        </View>
        <View style={[styles.breakdownRow, { marginTop: 4 }]}>
          <Text style={styles.breakdownTotalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(totalPrice + 1.5).toFixed(2)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.proceedBtn}
        activeOpacity={0.88}
        onPress={handleProceedToPay}
      >
        <Text style={styles.proceedBtnText}>Checkout</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </>
  ), [totalPrice]);

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={styles.centerTitleContainer}>
          <Ionicons name="cart-outline" size={24} color="#1A1A1A" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Cart</Text>
        </View>

        <View style={styles.rightPlaceholder}>
          {cartItems.length > 0 && (
            <TouchableOpacity onPress={clearCart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CONTENT */}
      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={64} color="#5C9A44" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Looks like you haven&apos;t added any food yet. Discover delicious meals across Garowe!
          </Text>
          <TouchableOpacity
            style={styles.browseMenuBtn}
            activeOpacity={0.88}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.browseMenuBtnText}>Browse Food Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // FlatList instead of ScrollView+map — virtualizes cart items
        // Removes cascading FadeInDown animations that ran 10 Reanimated worklets on mount
        <FlatList
          data={cartItems}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderCartItem}
          extraData={cartExtraKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          initialNumToRender={10}
          windowSize={3}
          ListFooterComponent={<View style={styles.bottomBar}>{CartFooter}</View>}
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 48,
    justifyContent: "center",
  },
  centerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  rightPlaceholder: {
    width: 48,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    backgroundColor: "#F8F8F8",
  },
  emptyIconCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#D1E7DD",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  emptySubtitle: {
    fontSize: 14.5,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 30,
  },
  browseMenuBtn: {
    backgroundColor: "#5C9A44",
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 36,
    shadowColor: "#5C9A44",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  browseMenuBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A4A4A",
    marginBottom: 10,
  },
  priceStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginHorizontal: 12,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  bottomBarBreakdown: {
    flex: 1,
    marginRight: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 13,
    color: "#6B6B6B",
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  proceedBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  proceedBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
