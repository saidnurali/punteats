import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  Animated as RNAnimated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categoriesData";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/CartContext";
import { RestaurantCard, RestaurantItem } from "@/components/RestaurantCard";
import { useWishlist } from "@/lib/WishlistContext";
import {
  getCachedCategoryDishes,
  fetchCategoryDishes,
  getCachedRestaurants,
  fetchRestaurants,
  fetchAllProducts,
  getCachedAllProducts,
} from "@/lib/DataCache";

const { width } = Dimensions.get("window");

// Skeleton Pulse Placeholder Component
const SkeletonBox = ({ style }: { style: any }) => {
  const pulseAnim = useRef(new RNAnimated.Value(0.4)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <RNAnimated.View
      style={[
        { backgroundColor: "#E5E7EB", borderRadius: 12 },
        style,
        { opacity: pulseAnim },
      ]}
    />
  );
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [foodCategories, setFoodCategories] = useState(() => {
    // Compute active categories from in-memory cache immediately (zero network on warm cache)
    const allProducts = getCachedAllProducts();
    const base = CATEGORIES.filter((c) => c.name !== "All" && c.id !== "0");
    if (allProducts.length === 0) return base;
    return CATEGORIES.filter((c) => {
      if (c.name === "All" || c.id === "0") return false;
      return allProducts.some(p => p.category && (
        p.category.toLowerCase() === c.name.toLowerCase() ||
        p.category.toLowerCase().includes(c.name.toLowerCase())
      ));
    });
  });

  useEffect(() => {
    // Use shared cache — no duplicate network call
    fetchAllProducts().then((products) => {
      if (products && products.length > 0) {
        const active = CATEGORIES.filter((c) => {
          if (c.name === "All" || c.id === "0") return false;
          return products.some(p => p.availability === "In Stock" && p.category && (
            p.category.toLowerCase() === c.name.toLowerCase() ||
            p.category.toLowerCase().includes(c.name.toLowerCase())
          ));
        });
        if (active.length > 0) setFoodCategories(active);
      }
    }).catch(() => {});
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>("Pizza");
  const [dishes, setDishes] = useState<Product[]>(() => getCachedCategoryDishes("Pizza"));
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>(() => getCachedRestaurants());
  const [loadingDishes, setLoadingDishes] = useState(() => getCachedCategoryDishes("Pizza").length === 0);
  const [loadingRest, setLoadingRest] = useState(() => getCachedRestaurants().length === 0);

  // Fetch dishes from cache immediately, then refresh in background (stale-while-revalidate)
  const loadCategoryDishes = async (categoryName: string) => {
    const cached = getCachedCategoryDishes(categoryName);
    if (cached.length > 0) {
      setDishes(cached);
      setLoadingDishes(false);
    } else {
      setLoadingDishes(true);
    }

    const fresh = await fetchCategoryDishes(categoryName);
    setDishes(fresh);
    setLoadingDishes(false);
  };

  // Fetch top restaurants from cache immediately, then refresh in background
  const loadTopRestaurants = async () => {
    const cached = getCachedRestaurants();
    if (cached.length > 0) {
      setRestaurants(cached);
      setLoadingRest(false);
    } else {
      setLoadingRest(true);
    }

    const fresh = await fetchRestaurants();
    setRestaurants(fresh);
    setLoadingRest(false);
  };

  useEffect(() => {
    loadCategoryDishes(selectedCategory);
  }, [selectedCategory]);

  const realtimeCatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTopRestaurants();

    // Global listener for admin-pushed changes — debounced to avoid cascading reloads
    const channelTopic = `categories_screen_sync`;
    const channel = supabase
      .channel(channelTopic)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_items" }, () => {
        if (realtimeCatDebounceRef.current) clearTimeout(realtimeCatDebounceRef.current);
        realtimeCatDebounceRef.current = setTimeout(() => { loadCategoryDishes(selectedCategory); }, 2000);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, () => {
        if (realtimeCatDebounceRef.current) clearTimeout(realtimeCatDebounceRef.current);
        realtimeCatDebounceRef.current = setTimeout(() => { loadTopRestaurants(); }, 2000);
      })
      .subscribe();

    return () => {
      if (realtimeCatDebounceRef.current) clearTimeout(realtimeCatDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const renderHeader = () => (
    <>
      {/* ── Section 1: Food Categories Grid (Top Section) ── */}
      <View style={styles.sectionContainer}>

        <View style={styles.categoriesGrid}>
          {foodCategories.map((cat, index) => {
            const active = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id || index}
                style={styles.gridItem}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat.name)}
              >
                <View style={[styles.circleContainer, active && styles.circleContainerActive]}>
                  <Text style={styles.catEmoji}>{cat.emoji || "🍴"}</Text>
                </View>
                <Text
                  style={[styles.catNameText, active && styles.catNameTextActive]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Section 2: Dynamic Dishes Header ── */}
      <View style={[styles.dishesSection, { paddingBottom: 10 }]}>
        <View style={styles.dishesHeader}>
          <Text style={styles.dishesSectionTitle}>{selectedCategory} Dishes</Text>
        </View>
      </View>
    </>
  );

  const renderEmptyDishes = () => {
    if (loadingDishes) {
      return (
        <View style={[styles.dishesGrid, { paddingHorizontal: 18 }]}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={styles.dishCardWrap}>
              <View style={styles.dishCard}>
                <SkeletonBox style={{ width: "100%", height: 110, borderRadius: 0 }} />
                <View style={styles.dishCardContent}>
                  <SkeletonBox style={{ width: "70%", height: 14, marginBottom: 6 }} />
                  <SkeletonBox style={{ width: "40%", height: 12, marginBottom: 10 }} />
                  <View style={styles.dishBottomRow}>
                    <SkeletonBox style={{ width: "35%", height: 16 }} />
                    <SkeletonBox style={{ width: 28, height: 28, borderRadius: 14 }} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={[styles.emptyDishesBox, { marginHorizontal: 18 }]}>
        <Text style={styles.emptyEmoji}>🍽️</Text>
        <Text style={styles.emptyText}>
          No dishes available in this category yet.
        </Text>
      </View>
    );
  };

  const renderFooter = () => (
    <View style={styles.restaurantsSection}>
      <View style={styles.restaurantsHeaderRow}>
        <Text style={styles.restaurantsSectionTitle}>Top Restaurants</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/all-restaurants")}>
          <Text style={styles.seeAllText}>See all &gt;</Text>
        </TouchableOpacity>
      </View>

      {loadingRest ? (
        <View style={styles.restaurantsList}>
          {[...Array(2)].map((_, i) => (
            <View key={i} style={{ width: "48%", marginBottom: 16 }}>
              <SkeletonBox style={{ width: "100%", height: 160, borderRadius: 14 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.restaurantsList}>
          {restaurants.map((rest, idx) => {
            const fav = isWishlisted(`rest_${rest.id}`);
            return (
              <View
                key={rest.id}
                style={{ width: "48%", marginBottom: 16 }}
              >
                <RestaurantCard
                  item={rest}
                  isFav={fav}
                  onToggleWishlist={() =>
                    toggleWishlist({
                      id: `rest_${rest.id}`,
                      name: rest.name,
                      category: rest.tags,
                      price: 0,
                      priceFormatted: "",
                      rating: rest.rating,
                      calories: "",
                      deliveryTime: rest.time,
                      description: "",
                      image: rest.coverImage || (rest as any).image_url || rest.image,
                      images: [],
                    })
                  }
                  onPress={() => router.push(`/restaurant/${rest.id}`)}
                  style={{ width: "100%", marginRight: 0 }}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
      <View style={styles.container}>
        {/* ── Top Header Navigation ── */}
      <SafeAreaView edges={["top"]} style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>More Category</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <FlatList
        data={dishes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 18 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyDishes}
        renderItem={({ item, index }) => {
          return (
            <View style={styles.dishCardWrap}>
              <TouchableOpacity
                style={styles.foodCardItem}
                activeOpacity={0.7}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <View style={styles.foodImgWrap}>
                  <Image
                    source={{ uri: item.image }}
                    style={styles.foodImg}
                    contentFit="cover" cachePolicy="memory-disk" transition={200}
                    recyclingKey={item.id}
                  />
                  
                  {/* Optional Promo Badge */}
                  <View style={styles.foodPromoBadge}>
                    <Text style={styles.foodPromoText}>PROMO</Text>
                  </View>
                </View>

                <View style={styles.foodCardContent}>
                  <Text style={styles.foodItemTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  
                  <View style={styles.foodSubRow}>
                    <Text style={styles.foodSubText}>{item.distance || '1.5 km'}</Text>
                    <Text style={styles.foodSubDivider}>|</Text>
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={styles.foodSubText}> {item.rating || '0'} ({item.reviews_count || '0'})</Text>
                  </View>

                  <View style={styles.foodBottomRow}>
                    <View style={styles.foodPriceWrap}>
                      <Text style={styles.foodItemPrice}>{item.priceFormatted}</Text>
                      <Text style={styles.foodSubDivider}>|</Text>
                      <Ionicons name="bicycle-outline" size={16} color="#1B7D3C" />
                      <Text style={styles.foodDeliveryText}> {item.delivery_fee > 0 ? `$${Number(item.delivery_fee).toFixed(2)}` : 'Free'}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.foodHeartBtn}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        // Wishlist toggle placeholder
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={"heart-outline"}
                        size={22}
                        color={"#EF4444"}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBarContainer: {
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  subtitleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  gridItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 24,
  },
  circleContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  circleContainerActive: {
    backgroundColor: "#E8F5E9",
  },
  catImage: {
    width: 48,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  catEmoji: {
    fontSize: 42,
  },
  catNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
  catNameTextActive: {
    color: "#1B7D3C",
    fontWeight: "700",
  },
  dishesSection: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 6,
    borderBottomColor: "#F8F9FA",
  },
  dishesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dishesSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  emptyDishesBox: {
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginVertical: 4,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
  },
  dishesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dishCardWrap: {
    width: "48%",
    marginBottom: 14,
  },
  foodCardItem: {
    width: "100%", // Full width of the 48% parent container
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: "hidden",
  },
  foodImgWrap: {
    width: "100%",
    aspectRatio: 1, // Square ratio
    position: "relative",
  },
  foodImg: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  foodPromoBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#4ADE80",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  foodPromoText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  foodCardContent: {
    padding: 12,
  },
  foodItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  foodSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  foodSubText: {
    fontSize: 12,
    color: "#6B6B6B",
  },
  foodSubDivider: {
    fontSize: 12,
    color: "#D1D5DB",
    marginHorizontal: 6,
  },
  foodBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  foodPriceWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  foodItemPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#22C55E",
  },
  foodDeliveryText: {
    fontSize: 12,
    color: "#6B6B6B",
  },
  foodHeartBtn: {
    width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
  },
  restaurantsSection: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },
  restaurantsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  restaurantsSectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  restaurantsList: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});
