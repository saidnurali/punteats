import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated as RNAnimated,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categoriesData";
import { Product, fetchProductsFromSupabase } from "@/lib/products";
import { useCart } from "@/lib/CartContext";
import { RestaurantCard, RestaurantItem } from "@/components/RestaurantCard";
import { useWishlist } from "@/lib/WishlistContext";
import {
  getCachedCategoryDishes,
  fetchCategoryDishes,
  getCachedRestaurants,
  fetchRestaurants,
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

  const [foodCategories, setFoodCategories] = useState(() => CATEGORIES.filter((c) => c.name !== "All" && c.id !== "0"));

  useEffect(() => {
    fetchProductsFromSupabase().then((products) => {
      if (products) {
        const active = CATEGORIES.filter((c) => {
          if (c.name === "All" || c.id === "0") return false;
          return products.some(p => p.availability === "In Stock" && p.category && (p.category.toLowerCase() === c.name.toLowerCase() || p.category.toLowerCase().includes(c.name.toLowerCase())));
        });
        setFoodCategories(active);
      }
    });
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

  useEffect(() => {
    loadTopRestaurants();

    const channelTopic = `categories_screen_sync_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const channel = supabase
      .channel(channelTopic)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_items" }, () => {
        loadCategoryDishes(selectedCategory);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, () => {
        loadTopRestaurants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const renderHeader = () => (
    <>
      {/* ── Section 1: Food Categories Grid (Top Section) ── */}
      <View style={styles.sectionContainer}>
        <Text style={styles.subtitleText}>Food Categories</Text>

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
                <View
                  style={[
                    styles.circleContainer,
                    active && styles.circleContainerActive,
                  ]}
                >
                  {cat.image ? (
                    <Image
                      source={
                        typeof cat.image === "string"
                          ? { uri: cat.image }
                          : cat.image
                      }
                      style={styles.catImage}
                      contentFit="contain" cachePolicy="memory-disk" transition={200}
                    />
                  ) : (
                    <Text style={styles.catEmoji}>{cat.emoji || "🍴"}</Text>
                  )}
                </View>
                <Text
                  style={[styles.catNameText, active && styles.catNameTextActive]}
                  numberOfLines={1}
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
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.seeAllText}>See all &gt;</Text>
        </TouchableOpacity>
      </View>

      {loadingRest ? (
        <View style={styles.restaurantsList}>
          {[...Array(2)].map((_, i) => (
            <View key={i} style={{ marginBottom: 16 }}>
              <SkeletonBox style={{ width: "100%", height: 160, borderRadius: 14 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.restaurantsList}>
          {restaurants.map((rest, idx) => {
            const fav = isWishlisted(`rest_${rest.id}`);
            return (
              <Animated.View
                key={rest.id}
                style={{ marginBottom: 16 }}
                entering={FadeInDown.duration(350)}
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
                />
              </Animated.View>
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
          <Text style={styles.headerTitle}>Categories</Text>
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
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyDishes}
        renderItem={({ item, index }) => {
          const safeImage = item?.images?.[0] || item?.image_url || item?.image;
          return (
            <Animated.View
              style={styles.dishCardWrap}
              entering={FadeInDown.duration(300)}
            >
              <TouchableOpacity
                style={styles.dishCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <Image
                  source={{ uri: safeImage }}
                  style={styles.dishThumb}
                  contentFit="cover" cachePolicy="memory-disk" transition={200}
                />

                <View style={styles.dishCardContent}>
                  <Text style={styles.dishCardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.dishMetaRow}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color="#6B7280"
                      style={{ marginRight: 3 }}
                    />
                    <Text style={styles.dishTimeText}>
                      {item.deliveryTime || "20-30 mins"}
                    </Text>
                  </View>
                  <View style={styles.dishBottomRow}>
                    <Text style={styles.dishPriceText}>
                      {item.priceFormatted}
                    </Text>
                    <TouchableOpacity
                      style={styles.addToCartBtn}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        addToCart(item, 1);
                      }}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
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
  },
  gridItem: {
    width: "23%",
    alignItems: "center",
    marginBottom: 18,
  },
  circleContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  circleContainerActive: {
    backgroundColor: "#E8F5E9",
    borderColor: "#1B7D3C",
  },
  catImage: {
    width: 38,
    height: 38,
  },
  catEmoji: {
    fontSize: 30,
  },
  catNameText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
    textAlign: "center",
  },
  catNameTextActive: {
    color: "#1B7D3C",
    fontWeight: "800",
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
  dishCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  dishThumb: {
    width: "100%",
    height: 110,
    backgroundColor: "#F3F4F6",
  },
  dishCardContent: {
    padding: 10,
  },
  dishCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  dishMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dishTimeText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  dishBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dishPriceText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B7D3C",
  },
  addToCartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1B7D3C",
    justifyContent: "center",
    alignItems: "center",
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
  },
});
