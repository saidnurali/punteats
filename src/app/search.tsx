import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { Product, mapFoodItemToProduct } from "@/lib/products";
import { useCart } from "@/lib/CartContext";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SearchScreen() {
  const router = useRouter();
  const { cartItems, addToCart } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestedRestaurants, setSuggestedRestaurants] = useState<any[]>([]);
  const [popularFood, setPopularFood] = useState<Product[]>([]);
  
  const [searchResults, setSearchResults] = useState<{ products: Product[], restaurants: any[] }>({ products: [], restaurants: [] });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadDefaults();
  }, []);

  const loadDefaults = async () => {
    try {
      // Parallelize all 3 loads — was sequential (recent, restaurants, food in sequence)
      const [recent, restsResult, popFoodResult] = await Promise.all([
        AsyncStorage.getItem('@recent_searches'),
        supabase
          .from('restaurants')
          .select('id, name, rating, cover_image, image_url')
          .order('rating', { ascending: false })
          .limit(3),
        supabase
          .from('food_items')
          .select('id, name, description, price, image_url, category, restaurant_id, restaurant:restaurants(name)')
          .limit(6),
      ]);

      if (recent) setRecentSearches(JSON.parse(recent));
      if (restsResult.data) setSuggestedRestaurants(restsResult.data);
      if (popFoodResult.data) setPopularFood(popFoodResult.data.map(mapFoodItemToProduct));
    } catch (e) {}
  };

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery) {
        setSearchResults({ products: [], restaurants: [] });
        return;
      }
      setIsSearching(true);
      try {
        const [prodRes, restRes] = await Promise.all([
          supabase.from('food_items').select('*, restaurant:restaurants(name)').ilike('name', `%${debouncedQuery}%`).limit(20),
          supabase.from('restaurants').select('*').ilike('name', `%${debouncedQuery}%`).limit(10)
        ]);

        const products = prodRes.data ? prodRes.data.map(mapFoodItemToProduct) : [];
        const restaurants = restRes.data ? restRes.data : [];

        setSearchResults({ products, restaurants });
        saveRecentSearch(debouncedQuery);
      } catch (e) {
      } finally {
        setIsSearching(false);
      }
    };
    performSearch();
  }, [debouncedQuery]);

  const saveRecentSearch = async (query: string) => {
    if (!query.trim()) return;
    try {
      const updated = [query, ...recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase())].slice(0, 10);
      setRecentSearches(updated);
      await AsyncStorage.setItem('@recent_searches', JSON.stringify(updated));
    } catch (e) {}
  };

  const clearRecent = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem('@recent_searches');
  };

  const handleRecentTap = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Search</Text>

        <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart')}>
          <Ionicons name="bag-handle-outline" size={22} color="#1A1A1A" />
          {cartItems.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Pizza, Burger, Sandwiches..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!debouncedQuery ? (
          <>
            {/* RECENT SEARCHES */}
            {recentSearches.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Keywords</Text>
                  <TouchableOpacity onPress={clearRecent}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
                  {recentSearches.map((kw, i) => (
                    <TouchableOpacity key={i} style={styles.recentPill} onPress={() => handleRecentTap(kw)}>
                      <Text style={styles.recentPillText}>{kw}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {/* SUGGESTED RESTAURANTS */}
            {suggestedRestaurants.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.section}>
                <Text style={styles.sectionTitle}>Suggested Restaurants</Text>
                {suggestedRestaurants.map((rest, i) => (
                  <TouchableOpacity key={rest.id} style={styles.restItem} onPress={() => router.push(`/restaurant/${rest.id}`)}>
                    <Image source={{ uri: rest.cover_image || rest.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4' }} style={styles.restImg} />
                    <View style={styles.restInfo}>
                      <Text style={styles.restName}>{rest.name}</Text>
                      <View style={styles.restRatingRow}>
                        <Ionicons name="star" size={14} color="#F5A623" />
                        <Text style={styles.restRating}>{rest.rating}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}

            {/* POPULAR FAST FOOD */}
            {popularFood.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.section}>
                <Text style={styles.sectionTitle}>Popular Fast Food</Text>
                <View style={styles.popularGrid}>
                  {popularFood.map(item => (
                    <TouchableOpacity key={item.id} style={styles.popCard} activeOpacity={0.9} onPress={() => router.push(`/product/${item.id}`)}>
                      <Image source={{ uri: item.image || item.image_url }} style={styles.popImg} />
                      <View style={styles.popBody}>
                        <Text style={styles.popName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.popRest} numberOfLines={1}>{item.category}</Text>
                        <View style={styles.popFooter}>
                          <Text style={styles.popPrice}>${item.price.toFixed(2)}</Text>
                          <TouchableOpacity 
                            style={styles.popAddBtn} 
                            activeOpacity={0.7} 
                            onPress={() => addToCart(item, 1)}
                          >
                            <Ionicons name="add" size={18} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            )}
          </>
        ) : (
          /* SEARCH RESULTS */
          <View style={styles.resultsContainer}>
            {isSearching ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#1B7D3C" />
              </View>
            ) : searchResults.products.length === 0 && searchResults.restaurants.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
              </View>
            ) : (
              <>
                {searchResults.restaurants.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Restaurants</Text>
                    {searchResults.restaurants.map((rest, i) => (
                      <TouchableOpacity key={rest.id} style={styles.restItem} onPress={() => router.push(`/restaurant/${rest.id}`)}>
                        <Image source={{ uri: rest.cover_image || rest.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4' }} style={styles.restImg} />
                        <View style={styles.restInfo}>
                          <Text style={styles.restName}>{rest.name}</Text>
                          <View style={styles.restRatingRow}>
                            <Ionicons name="star" size={14} color="#F5A623" />
                            <Text style={styles.restRating}>{rest.rating}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchResults.products.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Food</Text>
                    <View style={styles.popularGrid}>
                      {searchResults.products.map(item => (
                        <TouchableOpacity key={item.id} style={styles.popCard} activeOpacity={0.9} onPress={() => router.push(`/product/${item.id}`)}>
                          <Image source={{ uri: item.image || item.image_url }} style={styles.popImg} />
                          <View style={styles.popBody}>
                            <Text style={styles.popName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.popRest} numberOfLines={1}>{item.category}</Text>
                            <View style={styles.popFooter}>
                              <Text style={styles.popPrice}>${item.price.toFixed(2)}</Text>
                              <TouchableOpacity 
                                style={styles.popAddBtn} 
                                activeOpacity={0.7} 
                                onPress={() => addToCart(item, 1)}
                              >
                                <Ionicons name="add" size={18} color="#FFF" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  cartBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#1B7D3C", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFF" },
  cartBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  
  searchContainer: { paddingHorizontal: 20, paddingBottom: 15 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F8F8", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: "#1A1A1A" },
  clearBtn: { padding: 4 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A1A", marginBottom: 16 },
  clearText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
  
  recentScroll: { flexDirection: "row" },
  recentPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", marginRight: 10, backgroundColor: "#FFF" },
  recentPillText: { fontSize: 14, color: "#4B5563" },

  restItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  restImg: { width: 50, height: 50, borderRadius: 10, marginRight: 14 },
  restInfo: { flex: 1 },
  restName: { fontSize: 15, fontWeight: "600", color: "#1A1A1A", marginBottom: 4 },
  restRatingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  restRating: { fontSize: 13, color: "#4B5563", fontWeight: "600" },

  popularGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  popCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, overflow: "hidden", borderWidth: 1, borderColor: "#F1F5F9" },
  popImg: { width: "100%", height: 130 },
  popBody: { padding: 12 },
  popName: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  popRest: { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  popFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  popPrice: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  popAddBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1B7D3C", alignItems: "center", justifyContent: "center" },

  resultsContainer: { flex: 1, marginTop: 10 },
  loader: { padding: 40, alignItems: "center" },
  emptyState: { padding: 50, alignItems: "center" },
  emptyText: { marginTop: 16, fontSize: 15, color: "#6B6B6B", textAlign: "center" }
});
