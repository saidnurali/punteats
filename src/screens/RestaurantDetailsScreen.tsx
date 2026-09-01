import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Share,
  StatusBar,
  FlatList,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { mapFoodItemToProduct, Product } from "@/lib/products";
import { useCart } from "@/lib/CartContext";
import { useWishlist } from "@/lib/WishlistContext";
import { useLanguage } from "@/lib/LanguageContext";
import { RestaurantHeaderSkeleton, FoodCardSkeleton } from "@/components/SkeletonLoader";

const { width } = Dimensions.get("window");

const DEFAULT_COVER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80";

interface MenuDishCardProps {
  item: any;
  /** Stable number primitive — the key prop for memo bailout */
  cartQuantity: number;
  addToCart: (item: any, qty: number) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
}

const MenuDishCard = React.memo(({
  item, cartQuantity, addToCart, updateQuantity, removeFromCart
}: MenuDishCardProps) => {
  const router = useRouter();
  
  // Example dummy logic for wishlist since it wasn't here originally
  const isFav = false; // Could pass this as prop in future if needed
  
  return (
    <TouchableOpacity
      style={styles.foodCardItem}
      activeOpacity={0.7}
      onPress={() => router.push(`/product/${item.id}`)}
    >
      <View style={styles.foodImgWrap}>
        <Image source={{ uri: item.image }} style={styles.foodImg} contentFit="cover" cachePolicy="memory-disk" transition={200} recyclingKey={item.id} />
        
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFav ? "heart" : "heart-outline"}
              size={22}
              color={isFav ? "#EF4444" : "#EF4444"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
},
// Custom comparator: re-render only when this card's own data changes.
(prev, next) =>
  prev.item === next.item &&
  prev.cartQuantity === next.cartQuantity
);


/** Pure function — outside component so it's never redefined on render */
function getCategoryEmoji(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("pizza")) return "🍕";
  if (lower.includes("burger")) return "🍔";
  if (lower.includes("chicken")) return "🍗";
  if (lower.includes("dessert") || lower.includes("cake")) return "🍰";
  if (lower.includes("drink") || lower.includes("cola")) return "🥤";
  if (lower.includes("coffee") || lower.includes("tea")) return "☕️";
  if (lower.includes("rice")) return "🍚";
  if (lower.includes("shawarma")) return "🌯";
  if (lower.includes("pasta")) return "🍝";
  if (lower.includes("bbq") || lower.includes("grill")) return "🥩";
  if (lower.includes("somali")) return "🐪";
  return "🍽️";
}

export default function RestaurantDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { addToCart, totalItems, totalPrice, cartItems, updateQuantity, removeFromCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [foodItems, setFoodItems] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"Menu" | "Reviews" | "Info">("Menu");

  const dynamicRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return restaurant?.rating || "4.6";
    const total = reviews.reduce((sum, r) => sum + (r.rating || r.food_rating || 5), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews, restaurant]);

  const dynamicReviewsCount = useMemo(() => {
    if (!reviews || reviews.length === 0) return restaurant?.reviews_count || "0";
    return reviews.length;
  }, [reviews, restaurant]);

  const [selectedCategory, setSelectedCategory] = useState("All");

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach(c => map.set(c.id, c.quantity));
    return map;
  }, [cartItems]);

  const cartExtraKey = useMemo(() => cartItems.map(c => `${c.id}:${c.quantity}`).join(','), [cartItems]);

  const renderFoodItem = useCallback(({ item }: { item: any }) => {
    const cartQuantity = cartQuantityMap.get(item.id) ?? 0;
    return (
      <MenuDishCard
        item={item}
        cartQuantity={cartQuantity}
        addToCart={addToCart}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
      />
    );
  }, [cartQuantityMap, addToCart, updateQuantity, removeFromCart]);

  const restFav = useMemo(() => {
    if (!restaurant) return false;
    return isWishlisted(`rest_${id || restaurant.id}`);
  }, [restaurant, id, isWishlisted]);

  const handleToggleFav = () => {
    if (!restaurant) return;
    toggleWishlist({
      id: `rest_${id || restaurant.id}`,
      name: restaurant.name || "Restaurant",
      category: restaurant.tags || "Fast Food",
      price: 0,
      priceFormatted: "",
      rating: restaurant.rating ? String(restaurant.rating) : "0",
      calories: "",
      deliveryTime: restaurant.prep_time || "20-30 min",
      description: "",
      image: restaurant.cover_image || DEFAULT_COVER,
      images: [],
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${restaurant?.name || "this restaurant"} on PuntEats! Fast • Easy • Reliable delivery in Garowe.`,
      });
    } catch (err) {}
  };

  const loadData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const [cachedRest, cachedFoods] = await Promise.all([
        AsyncStorage.getItem(`@cached_rest_${id}`),
        AsyncStorage.getItem(`@cached_foods_${id}`),
      ]);
      if (cachedRest && cachedFoods && cachedFoods !== '[]') {
        setRestaurant(JSON.parse(cachedRest));
        setFoodItems(JSON.parse(cachedFoods));
        setLoading(false);
      }

      let restQuery = supabase.from("restaurants").select("*");
      if (!isNaN(Number(id))) {
        restQuery = restQuery.or(`id.eq.${id},id.eq.${Number(id)}`);
      } else {
        restQuery = restQuery.eq("id", id);
      }

      let reviewsQuery = supabase.from("order_reviews").select("*").order("created_at", { ascending: false });
      if (!isNaN(Number(id))) {
        reviewsQuery = reviewsQuery.or(`restaurant_id.eq.${id},restaurant_id.eq.${Number(id)}`);
      } else {
        reviewsQuery = reviewsQuery.eq("restaurant_id", id);
      }

      const [restResult, foodsResult, reviewsResult] = await Promise.all([
        restQuery.single(),
        supabase.from("food_items").select("id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, category_id, restaurant_id, variants, add_ons").eq("restaurant_id", id),
        reviewsQuery,
      ]);

      if (restResult.data) {
        setRestaurant(restResult.data);
        AsyncStorage.setItem(`@cached_rest_${id}`, JSON.stringify(restResult.data)).catch(() => null);
      }
      if (foodsResult.data && foodsResult.data.length > 0) {
        const rMap = restResult.data ? { [String(restResult.data.id)]: restResult.data.name } : {};
        const dMap = restResult.data ? { [String(restResult.data.id)]: Number(restResult.data.delivery_fee) || 0 } : {};
        const mappedFoods = foodsResult.data.map(item => mapFoodItemToProduct(item, rMap, dMap));
        setFoodItems(mappedFoods);
        AsyncStorage.setItem(`@cached_foods_${id}`, JSON.stringify(mappedFoods)).catch(() => null);
      }
      if (reviewsResult.data) {
        setReviews(reviewsResult.data);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching restaurant details:", err);
      setLoading(false);
    }
  };

  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();

    const channelTopic = `restaurant_${id}_sync_${Date.now()}`;
    const channel = supabase.channel(channelTopic)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "food_items",
        filter: `restaurant_id=eq.${id}`,
      }, () => {
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => { loadData(); }, 2000);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "restaurants",
        filter: `id=eq.${id}`,
      }, () => {
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => { loadData(); }, 2000);
      })
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [id]);

  const groupedMenu = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    foodItems.forEach((item) => {
      const cat = item.category?.trim() || "Menu";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [foodItems]);

  const activeDishes = useMemo(() => {
    if (selectedCategory === "All") return foodItems;
    const cleanSelected = selectedCategory.trim().toLowerCase();
    return foodItems.filter(item => item.category?.trim().toLowerCase() === cleanSelected);
  }, [selectedCategory, foodItems]);

  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set('All', foodItems.length);
    foodItems.forEach(item => {
      const cat = item.category?.trim().toLowerCase() || '';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return map;
  }, [foodItems]);

  const getCategoryCount = (catName: string) => {
    if (catName === 'All') return categoryCountMap.get('All') ?? 0;
    return categoryCountMap.get(catName.trim().toLowerCase()) ?? 0;
  };

  const availableCategories = useMemo(() => {
    return Object.keys(groupedMenu).filter(cat => getCategoryCount(cat) > 0);
  }, [groupedMenu, categoryCountMap]);

  const coverUri = restaurant?.cover_image || DEFAULT_COVER;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView edges={["top"]} style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.navBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>

          <Text style={styles.topBarTitle} numberOfLines={1}>
            {restaurant?.name || "Restaurant"}
          </Text>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.navBtn}
              activeOpacity={0.7}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#1A1A1A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navBtn, { marginLeft: 8 }]}
              activeOpacity={0.7}
              onPress={handleToggleFav}
            >
              <Ionicons
                name={restFav ? "heart" : "heart-outline"}
                size={22}
                color={restFav ? "#EF4444" : "#1A1A1A"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {loading && !restaurant ? (
        <RestaurantHeaderSkeleton />
      ) : (
      <FlatList
        data={activeTab === "Menu" && !loading ? activeDishes : []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={activeTab === "Menu" && !loading && activeDishes.length > 0 ? { justifyContent: "space-between", paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 150 : 30 }}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        ListHeaderComponent={
          <>
            <View style={styles.heroImgWrap}>
              <Image
                source={{ uri: coverUri }}
                style={styles.heroImg}
                contentFit="cover" cachePolicy="memory-disk" transition={200}
              />
            </View>

            <View style={styles.infoSection}>
              <View style={styles.titleRow}>
                <Text style={styles.restTitle}>{restaurant?.name || "Pizza House"}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={15} color="#F5A623" style={{ marginRight: 4 }} />
                  <Text style={styles.ratingText}>
                    {dynamicRating} ({dynamicReviewsCount} reviews)
                  </Text>
                </View>
              </View>

              <Text style={styles.tagsSubtitle}>{restaurant?.category || restaurant?.tags || "Italian • Pizza • Fast Food"}</Text>

              <View style={styles.metricsContainer}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{restaurant?.delivery_time || restaurant?.prep_time || "15-25 min"}</Text>
                  <Text style={styles.metricLabel}>{t("delivery_time_label")}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {restaurant?.delivery_fee !== undefined && restaurant?.delivery_fee !== null ? `$${Number(restaurant.delivery_fee).toFixed(2)}` : "$2.00"}
                  </Text>
                  <Text style={styles.metricLabel}>{t("delivery_fee")}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {restaurant?.min_order !== undefined && restaurant?.min_order !== null ? `$${Number(restaurant.min_order).toFixed(2)}` : "$0.00"}
                  </Text>
                  <Text style={styles.metricLabel}>{t("min_order")}</Text>
                </View>
              </View>

              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "Menu" && styles.activeTabItem]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab("Menu")}
                >
                  <Text style={[styles.tabText, activeTab === "Menu" && styles.activeTabText]}>
                    {t("menu")}
                  </Text>
                  {activeTab === "Menu" && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "Reviews" && styles.activeTabItem]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab("Reviews")}
                >
                  <Text style={[styles.tabText, activeTab === "Reviews" && styles.activeTabText]}>
                    {t("reviews")}
                  </Text>
                  {activeTab === "Reviews" && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "Info" && styles.activeTabItem]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab("Info")}
                >
                  <Text style={[styles.tabText, activeTab === "Info" && styles.activeTabText]}>
                    {t("info")}
                  </Text>
                  {activeTab === "Info" && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
              </View>
            </View>

            {activeTab === "Menu" && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ marginBottom: 16 }} 
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              >
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: selectedCategory === "All" ? "#1B7D3C" : "#F3F4F6",
                  }}
                  onPress={() => setSelectedCategory("All")}
                >
                  <Text style={{ color: selectedCategory === "All" ? "#FFFFFF" : "#4B5563", fontWeight: "700" }}>{t("all")}</Text>
                </TouchableOpacity>
                {availableCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: selectedCategory === cat ? "#1B7D3C" : "#F3F4F6",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6
                    }}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text>{getCategoryEmoji(cat)}</Text>
                    <Text style={{ color: selectedCategory === cat ? "#FFFFFF" : "#4B5563", fontWeight: "700" }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        }
        extraData={cartExtraKey}
        renderItem={renderFoodItem}
        ListEmptyComponent={
          activeTab === "Menu" ? (
            loading && foodItems.length === 0 ? (
              <View style={[styles.categoryGroup, { paddingHorizontal: 16 }]}>
                <View style={styles.dishGridContainer}>
                  {[1, 2, 3, 4].map((i) => (
                    <FoodCardSkeleton key={i} />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🍽️</Text>
                <Text style={styles.emptyText}>{t("no_menu_items")}</Text>
              </View>
            )
          ) : null
        }
        ListFooterComponent={
          <>
            {activeTab === "Reviews" && (
              <View style={styles.tabContentSection}>
                <View style={styles.reviewSummary}>
                  <Text style={styles.bigRatingText}>{dynamicRating}</Text>
                  <View style={{ marginLeft: 16 }}>
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons key={i} name={i < Math.round(Number(dynamicRating)) ? "star" : "star-outline"} size={16} color="#F5A623" style={{ marginRight: 2 }} />
                      ))}
                    </View>
                    <Text style={styles.reviewSubtext}>Based on {dynamicReviewsCount} reviews</Text>
                  </View>
                </View>

                {reviews.length === 0 ? (
                  <View style={styles.emptyReviewsContainer}>
                    <Text style={styles.emptyEmoji}>🌟</Text>
                    <Text style={styles.emptyText}>{t("no_reviews")}</Text>
                  </View>
                ) : (
                  reviews.map(review => (
                    <View key={review.id} style={styles.sampleReviewCard}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewerName}>{review.customer_name || "Customer"}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", marginVertical: 4 }}>
                        {[...Array(5)].map((_, i) => (
                          <Ionicons key={i} name={i < Math.floor(review.rating || review.food_rating || 5) ? "star" : "star-outline"} size={13} color="#F5A623" style={{ marginRight: 2 }} />
                        ))}
                      </View>
                      <Text style={styles.reviewComment}>
                        {review.review_text || review.comment || "Great experience!"}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === "Info" && (
              <View style={styles.tabContentSection}>
                <Text style={styles.infoHeading}>{t("info")} {restaurant?.name}</Text>
                <Text style={styles.infoDescription}>{restaurant?.description}</Text>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color="#1B7D3C" />
                  <Text style={styles.infoRowText}>{restaurant?.address}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color="#1B7D3C" />
                  <Text style={styles.infoRowText}>{restaurant?.phone}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color={restaurant?.status === 'Active' ? "#1B7D3C" : "#DC2626"} />
                  <Text style={styles.infoRowText}>
                    {restaurant?.status === 'Active' ? 'Open' : 'Closed'}
                    {restaurant?.opening_time && restaurant?.closing_time 
                      ? ` • ${restaurant.opening_time.slice(0, 5)} – ${restaurant.closing_time.slice(0, 5)}`
                      : ''}
                  </Text>
                </View>
              </View>
            )}
          </>
        }
      />
      )}

      {totalItems > 0 && (
        <View style={{ position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#10B981', borderRadius: 56, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, zIndex: 9999 }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }} onPress={() => router.push('/(tabs)/cart')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>{totalItems}</Text>
              </View>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>{t("my_cart")}</Text>
            </View>
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>${totalPrice.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
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
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginHorizontal: 12,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  heroImgWrap: {
    width: "100%",
    height: 220,
    backgroundColor: "#F3F4F6",
  },
  heroImg: {
    width: "100%",
    height: "100%",
  },
  infoSection: {
    paddingHorizontal: 18,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A1A",
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  tagsSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 16,
  },
  metricsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    position: "relative",
  },
  activeTabItem: {},
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#1B7D3C",
    fontWeight: "800",
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: -1,
    left: "15%",
    right: "15%",
    height: 3,
    backgroundColor: "#1B7D3C",
    borderRadius: 1.5,
  },
  categoryGroup: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: "center",
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "600",
  },
  tabContentSection: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  bigRatingText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1A1A1A",
    marginRight: 16,
  },
  reviewSubtext: {
    fontSize: 13,
    color: "#6B7280",
  },
  sampleReviewCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  reviewDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reviewComment: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginTop: 6,
  },
  infoHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  infoRowText: {
    fontSize: 14,
    color: "#1A1A1A",
    fontWeight: "600",
    marginLeft: 12,
  },
  emptyReviewsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
  },
  dishGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  foodCardItem: {
    width: "48%",
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
});
