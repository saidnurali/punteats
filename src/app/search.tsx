import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { Product, mapFoodItemToProduct } from "@/lib/products";
import { useCart } from "@/lib/CartContext";

// ─── Debounce Hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Static Popular Cuisines ──────────────────────────────────────────────────
const POPULAR_CUISINES = [
  "Breakfast", "Snack", "Fast Food", "Beverages",
  "Chicken", "Noodles", "Rice", "Seafood", "International",
];

const ALL_CUISINES = ["Bakery & Cake", "Dessert", "Pizza", "Burger", "Salad", "Soup"];

const RECENT_KEY = "@puntgo_recent_searches_v2";

// ─── SearchResultCard ─────────────────────────────────────────────────────────
const SearchResultCard = React.memo(({
  item,
  onPress,
}: {
  item: Product;
  onPress: () => void;
}) => {
  const deliveryFee = item.delivery_fee != null && item.delivery_fee > 0
    ? `$${Number(item.delivery_fee).toFixed(2)}`
    : "Free";

  const safeImage = item.image || item.image_url || item.images?.[0];

  return (
    <TouchableOpacity style={styles.resultCard} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.resultImgWrap}>
        <Image
          source={{ uri: safeImage }}
          style={styles.resultImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          recyclingKey={item.id}
        />
        {/* PROMO badge — only show if price is notable */}
        <View style={styles.promoBadge}>
          <Text style={styles.promoText}>PROMO</Text>
        </View>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.resultMeta}>
          <Text style={styles.resultMetaText}>
            {item.distance || "1.5 km"}
          </Text>
          <Text style={styles.resultMetaDot}> | </Text>
          <Ionicons name="star" size={12} color="#F5A623" />
          <Text style={styles.resultMetaText}>
            {" "}{item.rating || "0"} ({item.reviews_count || "0"})
          </Text>
        </View>
        <View style={styles.resultFooter}>
          <Text style={styles.resultPrice}>${item.price.toFixed(2)}</Text>
          <View style={styles.resultFeeRow}>
            <Ionicons name="bicycle" size={14} color="#1B7D3C" />
            <Text style={styles.resultFeeText}> {deliveryFee}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── RestaurantResultCard ─────────────────────────────────────────────────────
const RestaurantResultCard = React.memo(({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) => {
  const coverImg = item.cover_image || item.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4";
  return (
    <TouchableOpacity style={styles.restCard} activeOpacity={0.75} onPress={onPress}>
      <Image
        source={{ uri: coverImg }}
        style={styles.restCardImg}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      <View style={styles.restCardBody}>
        <Text style={styles.restCardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.restCardCategory} numberOfLines={1}>{item.category || "Restaurant"}</Text>
        <View style={styles.restCardMeta}>
          <Ionicons name="star" size={13} color="#F5A623" />
          <Text style={styles.restCardRating}> {item.rating || "4.5"}</Text>
          {item.delivery_fee != null && (
            <>
              <Text style={styles.restMetaDot}> · </Text>
              <Ionicons name="bicycle" size={13} color="#1B7D3C" />
              <Text style={styles.restCardFee}> ${Number(item.delivery_fee).toFixed(2)}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );
});

// ─── Main SearchScreen ────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const { addToCart, cartItems } = useCart();
  const inputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 350);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{
    products: Product[];
    restaurants: any[];
  }>({ products: [], restaurants: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load recent searches on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then(raw => {
        if (raw) setRecentSearches(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  // Live search on debounced query change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults({ products: [], restaurants: [] });
      setHasSearched(false);
      return;
    }

    let cancelled = false;
    const performSearch = async () => {
      setIsSearching(true);
      try {
        // Fetch restaurants separately for delivery_fee
        const [prodRes, restRes] = await Promise.all([
          supabase
            .from("food_items")
            .select(
              "id, name, price, rating, prep_time, description, image_url, images, category, category_id, restaurant_id, availability, variants, add_ons, restaurants(name, delivery_fee)"
            )
            .ilike("name", `%${debouncedQuery}%`)
            .eq("availability", "In Stock")
            .limit(20),
          supabase
            .from("restaurants")
            .select("id, name, rating, cover_image, image_url, category, prep_time, delivery_fee")
            .ilike("name", `%${debouncedQuery}%`)
            .limit(8),
        ]);

        if (cancelled) return;

        const products = prodRes.data
          ? prodRes.data.map((item: any) => ({
              id: String(item.id),
              name: item.name,
              price: item.price,
              rating: item.rating ? String(item.rating) : "0",
              calories: item.calories || "",
              time: item.prep_time || "20-30 min",
              description: item.description || "",
              image: item.image_url || item.images?.[0] || "",
              category_id: item.category_id || "",
              restaurant_id: item.restaurant_id || "",
              restaurant_name: item.restaurants?.name || "Restaurant",
              delivery_fee: item.restaurants?.delivery_fee || 0,
              variants: item.variants || [],
              add_ons: item.add_ons || [],
            }))
          : [];
        const restaurants = restRes.data ?? [];

        setSearchResults({ products, restaurants });
        setHasSearched(true);
        if (!cancelled) saveRecentSearch(debouncedQuery.trim());
      } catch (_) {
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    performSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const saveRecentSearch = useCallback(async (query: string) => {
    if (!query) return;
    setRecentSearches(prev => {
      const updated = [
        query,
        ...prev.filter(q => q.toLowerCase() !== query.toLowerCase()),
      ].slice(0, 10);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const clearRecent = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }, []);

  const triggerSearch = useCallback((q: string) => {
    setSearchQuery(q);
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  // ── Derived UI State ──────────────────────────────────────────────────────
  const isEmptyState = debouncedQuery.trim() === "";
  const hasResults =
    searchResults.products.length > 0 || searchResults.restaurants.length > 0;
  const isNotFound = hasSearched && !isSearching && !hasResults;

  const totalCartItems = cartItems.reduce((s, c) => s + c.quantity, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={18}
            color={searchQuery ? "#1B7D3C" : "#9CA3AF"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search food, restaurants..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => triggerSearch(searchQuery.trim())}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Icon */}
        <TouchableOpacity
          style={[styles.cartBtn, { marginRight: 8 }]}
          activeOpacity={0.7}
          onPress={() => Alert.alert("Search Filters", "Sort by: Price, Rating, Time (Mock UI)")}
        >
          <Ionicons name="options-outline" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Cart Icon */}
        <TouchableOpacity
          style={styles.cartBtn}
          activeOpacity={0.7}
          onPress={() => router.push("/(tabs)/cart")}
        >
          <Ionicons name="bag-handle-outline" size={22} color="#1A1A1A" />
          {totalCartItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isEmptyState ? (
          /* ── STATE 1: Default (Recent Searches + Popular Cuisines) ── */
          <Animated.View entering={FadeIn.duration(250)}>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearRecent}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pillsWrap}>
                  {recentSearches.map((kw, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.pill}
                      activeOpacity={0.7}
                      onPress={() => triggerSearch(kw)}
                    >
                      <Ionicons name="time-outline" size={13} color="#6B6B6B" style={{ marginRight: 5 }} />
                      <Text style={styles.pillText}>{kw}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Popular Cuisines */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(80)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Popular Cuisines</Text>
              <View style={styles.pillsWrap}>
                {POPULAR_CUISINES.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.pillGreen}
                    activeOpacity={0.7}
                    onPress={() => triggerSearch(c)}
                  >
                    <Text style={styles.pillGreenText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* All Cuisines */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(160)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>All Cuisines</Text>
              <View style={styles.pillsWrap}>
                {ALL_CUISINES.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.pillGreen}
                    activeOpacity={0.7}
                    onPress={() => triggerSearch(c)}
                  >
                    <Text style={styles.pillGreenText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        ) : isSearching ? (
          /* ── Loading ── */
          <Animated.View entering={FadeIn.duration(200)} style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#1B7D3C" />
            <Text style={styles.loaderText}>Searching...</Text>
          </Animated.View>
        ) : isNotFound ? (
          /* ── STATE 3: Empty / Not Found ── */
          <Animated.View entering={FadeInDown.duration(350)} style={styles.notFoundWrap}>
            {/* Big green emoji face */}
            <View style={styles.notFoundFace}>
              <Text style={styles.notFoundEmoji}>😔</Text>
            </View>
            <Text style={styles.notFoundTitle}>Not Found</Text>
            <Text style={styles.notFoundSub}>
              Sorry, the keyword you entered cannot be found, please check again or search with another keyword.
            </Text>
            <TouchableOpacity
              style={styles.tryAgainBtn}
              activeOpacity={0.8}
              onPress={handleClear}
            >
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          /* ── STATE 2: Results ── */
          <Animated.View entering={FadeIn.duration(250)}>

            {/* Restaurants */}
            {searchResults.restaurants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restaurants</Text>
                {searchResults.restaurants.map(rest => (
                  <RestaurantResultCard
                    key={rest.id}
                    item={rest}
                    onPress={() => router.push(`/restaurant/${rest.id}`)}
                  />
                ))}
              </View>
            )}

            {/* Food Items */}
            {searchResults.products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Food Items ({searchResults.products.length})
                </Text>
                {searchResults.products.map(item => (
                  <SearchResultCard
                    key={item.id}
                    item={item}
                    onPress={() => router.push(`/product/${item.id}`)}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    paddingVertical: 0,
  },
  cartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#1B7D3C",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  cartBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "bold" },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 14,
  },
  clearText: { fontSize: 13, fontWeight: "600", color: "#EF4444", marginBottom: 14 },

  // Pills
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  pillText: { fontSize: 13, color: "#4B5563", fontWeight: "500" },
  pillGreen: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#1B7D3C",
    backgroundColor: "#FFF",
  },
  pillGreenText: { fontSize: 13, color: "#1B7D3C", fontWeight: "600" },

  // Loading
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  loaderText: { fontSize: 14, color: "#6B6B6B" },

  // Not Found State
  notFoundWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingHorizontal: 30,
  },
  notFoundFace: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  notFoundEmoji: { fontSize: 72 },
  notFoundTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  notFoundSub: {
    fontSize: 14,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  tryAgainBtn: {
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 25,
    backgroundColor: "#1B7D3C",
  },
  tryAgainText: { fontSize: 15, fontWeight: "700", color: "#FFF" },

  // Food Result Card (list-style from reference design 35)
  resultCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  resultImgWrap: {
    width: 90,
    height: 90,
    position: "relative",
  },
  resultImg: {
    width: 90,
    height: 90,
    backgroundColor: "#F3F4F6",
  },
  promoBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#1B7D3C",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  promoText: { fontSize: 9, fontWeight: "800", color: "#FFF" },
  resultBody: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  resultName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 5,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  resultMetaText: { fontSize: 12, color: "#6B6B6B" },
  resultMetaDot: { fontSize: 12, color: "#D1D5DB" },
  resultFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultPrice: { fontSize: 16, fontWeight: "800", color: "#22C55E" },
  resultFeeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultFeeText: { fontSize: 12, color: "#1B7D3C", fontWeight: "600" },

  // Restaurant Result Card
  restCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  restCardImg: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  restCardBody: { flex: 1 },
  restCardName: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 3 },
  restCardCategory: { fontSize: 12, color: "#6B6B6B", marginBottom: 6 },
  restCardMeta: { flexDirection: "row", alignItems: "center" },
  restCardRating: { fontSize: 13, fontWeight: "700", color: "#F5A623" },
  restMetaDot: { fontSize: 13, color: "#D1D5DB" },
  restCardFee: { fontSize: 12, color: "#1B7D3C", fontWeight: "600" },
});
