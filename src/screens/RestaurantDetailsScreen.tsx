import React, { useState, useEffect, useMemo } from "react";
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
} from "react-native";
import { FlashList } from "@shopify/flash-list";
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
import { RestaurantHeaderSkeleton, FoodCardSkeleton } from "@/components/SkeletonLoader";

const { width } = Dimensions.get("window");

const DEFAULT_COVER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80";

export default function RestaurantDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, totalItems, totalPrice, cartItems, updateQuantity, removeFromCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [foodItems, setFoodItems] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"Menu" | "Reviews" | "Info">("Menu");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const getCategoryEmoji = (cat: string) => {
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
  };

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
      rating: restaurant.rating || "4.8",
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
        message: `Check out ${restaurant?.name || "this restaurant"} on PuntGo! Fast • Easy • Reliable delivery in Garowe.`,
      });
    } catch (err) {}
  };

  const loadData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      // 0. Try to load from cache instantly
      let hasCache = false;
      const cachedRest = await AsyncStorage.getItem(`@cached_rest_${id}`);
      const cachedFoods = await AsyncStorage.getItem(`@cached_foods_${id}`);
      if (cachedRest && cachedFoods && cachedFoods !== '[]') {
        setRestaurant(JSON.parse(cachedRest));
        setFoodItems(JSON.parse(cachedFoods));
        hasCache = true;
        setLoading(false); // Instantly show cached UI
      }

      // 1. Fetch restaurant info silently
      let queryRest = supabase.from("restaurants").select("*");
      if (!isNaN(Number(id))) {
        queryRest = queryRest.or(`id.eq.${id},id.eq.${Number(id)}`);
      } else {
        queryRest = queryRest.eq("id", id);
      }
      const { data: restData } = await queryRest.single();

      if (restData) {
        setRestaurant(restData);
        AsyncStorage.setItem(`@cached_rest_${id}`, JSON.stringify(restData)).catch(()=>null);
      }

      // 2. Fetch food items linked specifically to this restaurant ID
      const { data: foods } = await supabase
        .from("food_items")
        .select("*")
        .eq("restaurant_id", id);
        
      if (foods && foods.length > 0) {
        const mappedFoods = foods.map(mapFoodItemToProduct);
        setFoodItems(mappedFoods);
        AsyncStorage.setItem(`@cached_foods_${id}`, JSON.stringify(mappedFoods)).catch(()=>null);
      }

      // 3. Fetch real reviews for this restaurant
      let queryReviews = supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (!isNaN(Number(id))) {
        queryReviews = queryReviews.or(`restaurant_id.eq.${id},restaurant_id.eq.${Number(id)}`);
      } else {
        queryReviews = queryReviews.eq("restaurant_id", id);
      }
      const { data: reviewsData } = await queryReviews;
      if (reviewsData) {
        setReviews(reviewsData);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching restaurant details:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      loadData();
    }
    
    const channelTopic = `restaurant_${id}_sync_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelTopic)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "food_items" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Group food items by their category
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

  const getCategoryCount = (catName: string) => {
    if (catName === 'All') return foodItems.length;
    const cleanCat = catName.trim().toLowerCase();
    return foodItems.filter(item => item.category?.trim().toLowerCase() === cleanCat).length;
  };

  const availableCategories = useMemo(() => {
    return Object.keys(groupedMenu).filter(cat => getCategoryCount(cat) > 0);
  }, [groupedMenu, foodItems]);

  const coverUri = restaurant?.cover_image || DEFAULT_COVER;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Navigation Bar ── */}
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
      <FlashList
        data={activeTab === "Menu" && !loading ? activeDishes : []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        estimatedItemSize={230}
        columnWrapperStyle={activeTab === "Menu" && !loading && activeDishes.length > 0 ? { justifyContent: "space-between", paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 150 : 30 }}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        ListHeaderComponent={
          <>
            {/* ── Hero Cover Image ── */}
            <View style={styles.heroImgWrap}>
              <Image
                source={{ uri: coverUri }}
                style={styles.heroImg}
                contentFit="cover" cachePolicy="memory-disk" transition={200}
              />
            </View>

            {/* ── Restaurant Info Card ── */}
            <View style={styles.infoSection}>
              <View style={styles.titleRow}>
                <Text style={styles.restTitle}>{restaurant?.name || "Pizza House"}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={15} color="#F5A623" style={{ marginRight: 4 }} />
                  <Text style={styles.ratingText}>
                    {restaurant?.rating || "4.6"} ({restaurant?.reviews_count || "128"})
                  </Text>
                </View>
              </View>

              <Text style={styles.tagsSubtitle}>{restaurant?.category || restaurant?.tags || "Italian • Pizza • Fast Food"}</Text>

              {/* 3-Badge Metric Container */}
              <View style={styles.metricsContainer}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{restaurant?.delivery_time || restaurant?.prep_time || "15-25 min"}</Text>
                  <Text style={styles.metricLabel}>Delivery Time</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {restaurant?.delivery_fee !== undefined && restaurant?.delivery_fee !== null ? `$${Number(restaurant.delivery_fee).toFixed(2)}` : "$2.00"}
                  </Text>
                  <Text style={styles.metricLabel}>Delivery Fee</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {restaurant?.min_order !== undefined && restaurant?.min_order !== null ? `$${Number(restaurant.min_order).toFixed(2)}` : "$0.00"}
                  </Text>
                  <Text style={styles.metricLabel}>Min. Order</Text>
                </View>
              </View>

              {/* Navigation Tabs */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "Menu" && styles.activeTabItem]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab("Menu")}
                >
                  <Text style={[styles.tabText, activeTab === "Menu" && styles.activeTabText]}>
                    Menu
                  </Text>
                  {activeTab === "Menu" && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "Reviews" && styles.activeTabItem]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab("Reviews")}
                >
                  <Text style={[styles.tabText, activeTab === "Reviews" && styles.activeTabText]}>
                    Reviews
                  </Text>
                  {activeTab === "Reviews" && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "Info" && styles.activeTabItem]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab("Info")}
                >
                  <Text style={[styles.tabText, activeTab === "Info" && styles.activeTabText]}>
                    Info
                  </Text>
                  {activeTab === "Info" && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Category Selectors (Menu Only) ── */}
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
                  <Text style={{ color: selectedCategory === "All" ? "#FFFFFF" : "#4B5563", fontWeight: "700" }}>All</Text>
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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.dishGridCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <Image
              source={{ uri: item.image }}
              style={styles.dishGridImg}
              contentFit="cover" cachePolicy="memory-disk" transition={200}
              recyclingKey={item.id}
            />
            <View style={styles.dishGridRatingBadge}>
              <Ionicons name="star" size={10} color="#F5A623" />
              <Text style={styles.dishGridRatingText}>{item.rating || "4.8"}</Text>
            </View>
            <View style={styles.dishGridInfo}>
              <View style={{ minHeight: 40, justifyContent: 'flex-start' }}>
                <Text style={styles.dishGridName} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.dishGridPrice}>{item.priceFormatted}</Text>
                {(() => {
                  const cartItem = cartItems.find(c => c.id === item.id);
                  if (cartItem) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4 }}>
                        <TouchableOpacity 
                          onPress={(e) => { e.stopPropagation(); cartItem.quantity > 1 ? updateQuantity(item.id, -1) : removeFromCart(item.id); }}
                          style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 13, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
                        >
                          <Ionicons name="remove" size={16} color="#1B7D3C" />
                        </TouchableOpacity>
                        <Text style={{ marginHorizontal: 10, fontSize: 14, fontWeight: '700', color: '#1B7D3C' }}>{cartItem.quantity}</Text>
                        <TouchableOpacity 
                          onPress={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                          style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B7D3C', borderRadius: 13 }}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#1B7D3C",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        addToCart(item, 1);
                      }}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          </TouchableOpacity>
        )}
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
                <Text style={styles.emptyText}>No dishes available in this category.</Text>
              </View>
            )
          ) : null
        }
        ListFooterComponent={
          <>
            {activeTab === "Reviews" && (
              <View style={styles.tabContentSection}>
                <View style={styles.reviewSummary}>
                  <Text style={styles.bigRatingText}>{restaurant?.rating || "4.8"}</Text>
                  <View>
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons key={i} name="star" size={16} color="#F5A623" style={{ marginRight: 2 }} />
                      ))}
                    </View>
                    <Text style={styles.reviewSubtext}>Based on {reviews.length} reviews</Text>
                  </View>
                </View>

                {reviews.length === 0 ? (
                  <View style={styles.emptyReviewsContainer}>
                    <Text style={styles.emptyEmoji}>🌟</Text>
                    <Text style={styles.emptyText}>No reviews yet. Be the first to rate this restaurant!</Text>
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
                          <Ionicons key={i} name={i < Math.floor(review.rating || 5) ? "star" : "star-outline"} size={13} color="#F5A623" style={{ marginRight: 2 }} />
                        ))}
                      </View>
                      <Text style={styles.reviewComment}>
                        {review.comment || "Great experience!"}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === "Info" && (
              <View style={styles.tabContentSection}>
                <Text style={styles.infoHeading}>About {restaurant?.name}</Text>
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
                  <Ionicons name="time-outline" size={20} color="#1B7D3C" />
                  <Text style={styles.infoRowText}>Open Daily • 8:00 AM – 11:30 PM</Text>
                </View>
              </View>
            )}
          </>
        }
      />
      )}

      {/* ── Fixed Bottom Cart Button ── */}
      {totalItems > 0 && (
        <View style={{ position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#10B981', borderRadius: 56, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, zIndex: 9999 }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }} onPress={() => router.push('/(tabs)/cart')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>{totalItems}</Text>
              </View>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>View Cart</Text>
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
  menuSection: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
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
  dishList: {
    marginTop: 4,
  },
  dishRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dishImg: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#F3F4F6",
  },
  dishInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  dishName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  dishPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1B7D3C",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
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
  dishGridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dishGridImg: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginBottom: 10,
  },
  dishGridRatingBadge: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  dishGridRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 4,
  },
  dishGridInfo: {
    paddingBottom: 2,
  },
  dishGridName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  dishGridPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B7D3C",
  },
  addGridBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1B7D3C",
    justifyContent: "center",
    alignItems: "center",
  },
});
