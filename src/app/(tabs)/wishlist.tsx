import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useWishlist } from "@/lib/WishlistContext";
import { useCart } from "@/lib/CartContext";

const { width } = Dimensions.get("window");

export default function WishlistScreen() {
  const router = useRouter();
  const { wishlistItems, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const validItems = wishlistItems.filter(item => item.price > 0 && (item.image || item.image_url));

  if (wishlistItems.length === 0) {
    return (
      <Animated.View style={{ flex: 1, backgroundColor: "#F8F8F8" }} entering={FadeInDown.duration(400)}>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>Wishlist</Text>
          </View>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="heart-outline" size={54} color="#1B7D3C" />
            </View>
            <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Explore top restaurants and save your favorite dishes here.
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              activeOpacity={0.88}
              onPress={() => router.push("/(tabs)")}
            >
              <Text style={styles.browseBtnText}>Browse Food</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ flex: 1, backgroundColor: "#F8F8F8" }} entering={FadeInDown.duration(400)}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Wishlist</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{validItems.length}</Text>
          </View>
        </View>

        <FlatList
          data={validItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.scrollContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const safeImage = item.image || item.image_url;
            return (
              <Animated.View entering={FadeInDown.duration(350).delay(index * 50)} style={styles.cardWrapper}>
                <View style={styles.card}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.push(`/product/${item.id}`)}
                  >
                    <Image source={{ uri: safeImage }} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.heartBtn}
                    activeOpacity={0.8}
                    onPress={() => toggleWishlist(item)}
                  >
                    <Ionicons name="heart" size={18} color="#EF4444" />
                  </TouchableOpacity>

                  <View style={styles.cardBody}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => router.push(`/product/${item.id}`)}
                    >
                      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.cardCategory} numberOfLines={1}>{item.category}</Text>
                      
                      <View style={styles.metaRow}>
                        <Ionicons name="star" size={12} color="#F5A623" />
                        <Text style={styles.metaText}>{item.rating}</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
                      <TouchableOpacity
                        style={styles.addBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                          addToCart(item, 1);
                          showToast("Added to Cart!");
                        }}
                      >
                        <Ionicons name="add" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />

        {toastMsg ? (
          <Animated.View style={styles.toast} entering={FadeInDown.duration(200)} exiting={FadeOut.duration(200)}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.toastText}>{toastMsg}</Text>
          </Animated.View>
        ) : null}

      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  headerBadge: { marginLeft: 8, backgroundColor: "#1B7D3C", borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  headerBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  columnWrapper: { justifyContent: "space-between", marginBottom: 16 },
  
  /* Empty State */
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#6B6B6B", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  browseBtn: { backgroundColor: "#1B7D3C", borderRadius: 25, paddingVertical: 14, paddingHorizontal: 32, shadowColor: "#1B7D3C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  browseBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  /* Card Grid (numColumns=2) */
  cardWrapper: { width: "48%" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: "#F1F5F9" },
  cardImage: { width: "100%", height: 130 },
  heartBtn: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 },
  cardBody: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: "800", color: "#1A1A1A", marginBottom: 4 },
  cardCategory: { fontSize: 12, color: "#6B6B6B", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  metaText: { fontSize: 12, color: "#4B5563", fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardPrice: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1B7D3C", alignItems: "center", justifyContent: "center" },
  
  /* Toast */
  toast: { position: "absolute", bottom: 40, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A1A", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  toastText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});
