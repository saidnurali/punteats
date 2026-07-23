import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useWishlist } from "@/lib/WishlistContext";
import { useCart } from "@/lib/CartContext";

export default function WishlistScreen() {
  const router = useRouter();
  const { wishlistItems, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  if (wishlistItems.length === 0) {
    return (
      <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <StatusBar barStyle="dark-content" />
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Wishlist</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="heart-outline" size={60} color="#1B7D3C" />
          </View>
          <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Tap the ❤️ icon on any dish to save it here for quick ordering later.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            activeOpacity={0.88}
            onPress={() => router.push("/(tabs)")}
          >
            <Ionicons name="fast-food-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.browseBtnText}>Browse Food Menu</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{wishlistItems.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {wishlistItems.map((item, idx) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(idx * 60).duration(350)}
          >
            <View style={styles.card}>
              {/* Product Image */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
              </TouchableOpacity>

              {/* Heart remove button */}
              <TouchableOpacity
                style={styles.heartBtn}
                activeOpacity={0.8}
                onPress={() => toggleWishlist(item)}
              >
                <Ionicons name="heart" size={20} color="#EF4444" />
              </TouchableOpacity>

              {/* Info */}
              <View style={styles.cardBody}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/product/${item.id}`)}
                  style={{ flex: 1 }}
                >
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardCategory}>{item.category}</Text>

                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaPill}>
                      <Ionicons name="star" size={12} color="#F5A623" />
                      <Text style={styles.metaText}>{item.rating}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Ionicons name="time-outline" size={12} color="#6B6B6B" />
                      <Text style={styles.metaText}>{item.deliveryTime}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
                  <TouchableOpacity
                    style={styles.addBtn}
                    activeOpacity={0.85}
                    onPress={() => addToCart(item, 1)}
                  >
                    <Ionicons name="add" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        ))}
        <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  headerBadge: {
    marginLeft: 8,
    backgroundColor: "#1B7D3C",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  /* Empty State */
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
    backgroundColor: "#FFF0F0",
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
    marginBottom: 28,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 28,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  browseBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 170,
  },
  heartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  cardBody: {
    padding: 14,
  },
  cardName: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 3,
  },
  cardCategory: {
    fontSize: 13,
    color: "#6B6B6B",
    marginBottom: 10,
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardPrice: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
