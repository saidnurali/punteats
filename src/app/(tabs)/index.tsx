import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInRight, FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { PRODUCTS_DATA, Product, fetchProductsFromSupabase } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/CartContext";
import { useWishlist } from "@/lib/WishlistContext";
import { RestaurantCard } from "@/components/RestaurantCard";
import { CATEGORIES, coffeeTeaIcon } from "@/lib/categoriesData";
import { getCachedRestaurants, fetchRestaurants } from "@/lib/DataCache";

const { width } = Dimensions.get("window");

// ─── EXACT IMAGE CONSTANTS (Clean require paths without spaces) ───
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HERO_SALAD_IMG = require("../../../assets/images/hero-salad.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CAB_PREMIUM_IMG = require("../../../assets/images/cab_premium.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RIDE_IMG = require("../../../assets/images/ride.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BURGER_CARD_IMG = require("../../../assets/images/burger-food.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TAXI_CARD_IMG = require("../../../assets/images/taxi-car.png");

const HERO_SLIDES = [
  {
    id: "slide-1",
    tag: "FAST DELIVERY",
    tagIconType: "mci" as const,
    tagIconName: "lightning-bolt",
    title: "Delicious Food\nDelivered Fast",
    subtitle: "Your favorite meals,\ndelivered to your door",
    buttonText: "Order Now",
    imageSource: HERO_SALAD_IMG,
    imageStyleKey: "heroSaladImg" as const,
  },
  {
    id: "slide-2",
    tag: "PREMIUM TAXI",
    tagIconType: "ion" as const,
    tagIconName: "car-outline",
    title: "Safe & Fast Rides\nAnywhere",
    subtitle: "Book your ride with\ntrusted drivers in Garowe",
    buttonText: "Book Ride",
    imageSource: CAB_PREMIUM_IMG,
    imageStyleKey: "heroTaxiImg" as const,
  },
  {
    id: "slide-3",
    tag: "HOT & FRESH",
    tagIconType: "mci" as const,
    tagIconName: "fire",
    title: "Hot Meals Delivered\nTo Your Door",
    subtitle: "Order now and get your\nfood delivered piping hot",
    buttonText: "Order Food",
    imageSource: RIDE_IMG,
    imageStyleKey: "heroRideImg" as const,
  },
];

// ─── Data ────────────────────────────────────────────────────────────────────

const INITIAL_RESTAURANTS: any[] = [];

const DELIVERY_SCOOTER = "https://wsrv.nl/?url=pngimg.com/uploads/motorcycle/motorcycle_PNG3162.png&output=png";

// ─── Component ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { addToCart, totalItems, totalPrice } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [searchQuery, setSearchQuery]           = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeHeroIndex, setActiveHeroIndex]   = useState(0);

  const [products, setProducts] = useState<Product[]>(PRODUCTS_DATA);
  const [categoriesList, setCategoriesList] = useState<any[]>(CATEGORIES);
  const [restaurantsList, setRestaurantsList] = useState<any[]>(INITIAL_RESTAURANTS);

  useEffect(() => {
    let isMounted = true;

    const loadMenuAndRestaurants = async () => {
      // 1. Synchronously set cached restaurants first if available (stale-while-revalidate)
      const cachedRests = getCachedRestaurants();
      if (cachedRests.length > 0 && isMounted) {
        setRestaurantsList(cachedRests);
      }

      // 2. Fetch fresh products and restaurants in background without blocking
      const fetchedProducts = await fetchProductsFromSupabase();
      if (isMounted && fetchedProducts) {
        setProducts(fetchedProducts);

        const officialNames = new Set(CATEGORIES.map(c => c.name.toLowerCase().replace(/^[^\w\s]+/g, "").trim()));
        const dynamicCats: any[] = [...CATEGORIES];
        let idx = 100;
        fetchedProducts.forEach(p => {
          if (p.category && p.category.trim() !== "") {
            const cleanCat = p.category.replace(/^[^\w\s]+/g, "").trim();
            if (cleanCat && !officialNames.has(cleanCat.toLowerCase())) {
              officialNames.add(cleanCat.toLowerCase());
              let emojiOrImg: any = { emoji: "🍴" };
              const lower = cleanCat.toLowerCase();
              if (lower.includes("pizza")) emojiOrImg = { image: "https://wsrv.nl/?url=pngimg.com/uploads/pizza/pizza_PNG44077.png&output=png" };
              else if (lower.includes("burger")) emojiOrImg = { image: "https://wsrv.nl/?url=pngimg.com/uploads/burger_sandwich/burger_sandwich_PNG4135.png&output=png" };
              else if (lower.includes("chicken")) emojiOrImg = { image: "https://wsrv.nl/?url=pngimg.com/uploads/fried_chicken/fried_chicken_PNG14104.png&output=png" };
              else if (lower.includes("dessert") || lower.includes("cake")) emojiOrImg = { image: "https://wsrv.nl/?url=pngimg.com/uploads/cake/cake_PNG13115.png&output=png" };
              else if (lower.includes("drink") || lower.includes("cola")) emojiOrImg = { image: "https://wsrv.nl/?url=pngimg.com/uploads/cocacola/cocacola_PNG22.png&output=png" };
              else if (lower.includes("coffee") || lower.includes("tea")) emojiOrImg = { image: coffeeTeaIcon };
              else if (lower.includes("rice")) emojiOrImg = { emoji: "🍚" };
              else if (lower.includes("shawarma")) emojiOrImg = { emoji: "🌯" };
              else if (lower.includes("pasta")) emojiOrImg = { emoji: "🍝" };
              else if (lower.includes("bbq") || lower.includes("grill")) emojiOrImg = { emoji: "🥩" };
              else if (lower.includes("somali")) emojiOrImg = { emoji: "🐪" };

              dynamicCats.push({
                id: String(idx++),
                name: cleanCat,
                ...emojiOrImg
              });
            }
          }
        });
        
        // Filter out categories with zero "In Stock" items
        const activeCategories = dynamicCats.filter(cat => {
          if (cat.name === "All") return true;
          return fetchedProducts.some(p => {
             const cCat = (p.category || "").replace(/^[^\w\s]+/g, "").trim().toLowerCase();
             return p.availability === "In Stock" && (cCat === cat.name.toLowerCase() || cCat.includes(cat.name.toLowerCase()));
          });
        });
        
        setCategoriesList(activeCategories);
      }

      const { data: activeRestaurants, error } = await supabase
        .from('restaurants')
        .select('*');
        
      if (isMounted && activeRestaurants) {
        // Map to RestaurantItem format for the FlatList
        const mappedRests = activeRestaurants.map((r: any) => ({
          id: String(r.id),
          name: r.name || "Restaurant",
          tags: r.category || "Somali Traditional & Fast Food",
          time: r.prep_time || "20-30m",
          fee: r.delivery_fee || "$2.00",
          rating: String(r.rating || "4.8"),
          image: r.cover_image || r.image_url,
          coverImage: r.cover_image || r.image_url,
          logoImage: r.logo_image || r.emoji || "🏪",
          emoji: r.emoji || r.logo_image || "🏪",
          status: r.status || "Active",
        }));
        setRestaurantsList(mappedRests);
      }
    };

    loadMenuAndRestaurants();

    const channelTopic = `mobile_home_sync_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelTopic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_items' }, () => {
        loadMenuAndRestaurants();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        loadMenuAndRestaurants();
      })
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredFoods = selectedCategory === "All"
    ? products
    : products.filter((item) => {
        const cleanItemCat = (item.category || "")
          .replace(/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF\s]+/g, "")
          .trim()
          .toLowerCase();
        const cleanSelected = selectedCategory
          .replace(/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF\s]+/g, "")
          .trim()
          .toLowerCase();
        return cleanItemCat === cleanSelected || cleanItemCat.includes(cleanSelected) || cleanSelected.includes(cleanItemCat);
      });


  const renderHeader = () => (
    <>
      {/* ── Search ── */}
      <Animated.View style={styles.searchRow} entering={FadeInDown.duration(400).delay(40)}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food, restaurants, dishes..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Hero Banner ── */}
      <Animated.View style={styles.heroBannerContainer} entering={FadeInDown.duration(400).delay(80)}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const slide = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
            setActiveHeroIndex(slide);
          }}
          scrollEventThrottle={16}
          style={styles.heroScrollView}
        >
          {HERO_SLIDES.map((slide, index) => (
            <View key={slide.id} style={styles.heroBannerSlide}>
              <View style={styles.heroTextContainer}>
                <View style={styles.fastDeliveryPill}>
                  {slide.tagIconType === "mci" ? (
                    <MaterialCommunityIcons name={slide.tagIconName as any} size={13} color="#34D399" />
                  ) : (
                    <Ionicons name={slide.tagIconName as any} size={13} color="#34D399" />
                  )}
                  <Text style={styles.fastDeliveryLabel}>{slide.tag}</Text>
                </View>

                <Text style={styles.heroTitle}>{slide.title}</Text>
                <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>

                <TouchableOpacity style={styles.orderNowBtn} activeOpacity={0.85}>
                  <Text style={styles.orderNowText}>{slide.buttonText}</Text>
                  <View style={styles.orderNowArrow}>
                    <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              <Ionicons name="leaf" size={16} color="#34D399" style={styles.leafTop} />
              <Ionicons name="leaf" size={12} color="#10B981" style={styles.leafBottom} />

              <Image source={slide.imageSource} style={styles[slide.imageStyleKey]} contentFit="contain" cachePolicy="memory-disk" transition={200} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {HERO_SLIDES.map((_, index) => (
            <View key={index} style={[styles.dot, activeHeroIndex === index && styles.dotActive]} />
          ))}
        </View>
      </Animated.View>

      {/* ── Dual Service Cards ── */}
      <Animated.View style={styles.cardsRow} entering={FadeInDown.duration(400).delay(140)}>
        <TouchableOpacity style={[styles.serviceCard, styles.foodCard]} activeOpacity={0.7}>
          <View style={styles.cardTextContent}>
            <Text style={styles.cardTitle}>Food{"\n"}Delivery</Text>
            <Text style={styles.cardSubtitle}>Order your{"\n"}favorite food</Text>
            <View style={[styles.cardArrow, { backgroundColor: "#1B7D3C" }]}>
              <Ionicons name="arrow-forward" size={15} color="#FFF" />
            </View>
          </View>
          <Image source={BURGER_CARD_IMG} style={styles.burgerImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.serviceCard, styles.taxiCard]} activeOpacity={0.7}>
          <View style={styles.cardTextContent}>
            <Text style={styles.cardTitle}>Taxi{"\n"}Service</Text>
            <Text style={styles.cardSubtitle}>Book a ride{"\n"}anywhere</Text>
            <View style={[styles.cardArrow, { backgroundColor: "#F5A623" }]}>
              <Ionicons name="arrow-forward" size={15} color="#FFF" />
            </View>
          </View>
          <Image source={TAXI_CARD_IMG} style={styles.carImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Categories ── */}
      <Animated.View style={styles.sectionRow} entering={FadeInDown.duration(400).delay(180)}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/categories')}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
      </Animated.View>

      <Animated.FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 4 }}
        entering={FadeInRight.duration(400).delay(220)}
        data={categoriesList}
        keyExtractor={(cat) => cat.id}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        renderItem={({ item: cat }) => {
          const active = selectedCategory === cat.name;
          return (
            <TouchableOpacity
              style={styles.catItem}
              activeOpacity={0.7}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <View style={[styles.catCard, active && styles.catCardActive]}>
                {cat.image ? (
                  <Image source={typeof cat.image === 'string' ? { uri: cat.image } : cat.image} style={styles.catImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
                ) : (
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                )}
              </View>
              <Text style={[styles.catName, active && styles.catNameActive]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Food Items Grid Header ── */}
      <Animated.View style={styles.foodGridSection} entering={FadeInDown.duration(400).delay(240)}>
        <View style={styles.foodGridHeader}>
          <Text style={styles.foodGridTitle}>
            {selectedCategory === "All" ? "All Delicious Items" : `${selectedCategory} Menu`}
          </Text>
          <Text style={styles.foodGridCount}>{filteredFoods.length} items</Text>
        </View>
      </Animated.View>
    </>
  );

  const renderFooter = () => (
    <>
      {/* ── Popular Restaurants ── */}
      <Animated.View style={styles.sectionRow} entering={FadeInDown.duration(400).delay(260)}>
        <Text style={styles.sectionTitle}>Popular Restaurants</Text>
        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
      </Animated.View>

      <Animated.FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 6 }}
        entering={FadeInRight.duration(400).delay(300)}
        data={restaurantsList}
        keyExtractor={(item) => item.id}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        renderItem={({ item }) => {
          const fav = isWishlisted(item.id);
          return (
            <RestaurantCard
              item={item}
              isFav={fav}
              onToggleWishlist={() =>
                toggleWishlist({
                  id: item.id, name: item.name, category: item.tags, price: 0, priceFormatted: "",
                  rating: item.rating, calories: "", deliveryTime: item.time, description: "",
                  image: item.coverImage || item.image_url || item.image, images: [],
                })
              }
              onPress={() => router.push(`/restaurant/${item.id}`)}
            />
          );
        }}
      />

      {/* ── Promo Banner ── */}
      <Animated.View style={styles.promoBanner} entering={FadeInDown.duration(400).delay(340)}>
        <Image source={{ uri: DELIVERY_SCOOTER }} style={styles.scooterImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.promoTitle}>Get 20% Off</Text>
          <Text style={styles.promoSub}>On your first order</Text>
        </View>
        <TouchableOpacity style={styles.promoBtn} activeOpacity={0.7}>
          <Text style={styles.promoBtnText}>Order Now</Text>
          <View style={styles.promoArrow}>
            <Ionicons name="arrow-forward" size={13} color="#1B7D3C" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </>
  );

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(300)}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.locationRow} activeOpacity={0.7}>
          <Ionicons name="location" size={20} color="#1B7D3C" />
          <Text style={styles.locationText}>Garowe, Puntland</Text>
          <Ionicons name="chevron-down" size={16} color="#1A1A1A" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bellWrap} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
          <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredFoods}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 12 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: totalItems > 0 ? 150 : 30 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        renderItem={({ item, index }) => {
          const fav = isWishlisted(item.id);
          const safeImage = item?.images?.[0] || item?.image_url || item?.image;
          return (
            <Animated.View style={{ width: "48%" }} entering={FadeInDown.duration(400).delay(240 + (index * 20))}>
              <TouchableOpacity
                style={[styles.foodCardItem, { width: "100%", marginBottom: 0 }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <View style={styles.foodImgWrap}>
                  <Image source={{ uri: safeImage }} style={styles.foodImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  <View style={styles.foodRatingBadge}>
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={styles.foodRatingText}>{item.rating}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.foodHeartBtn}
                    activeOpacity={0.7}
                    onPress={() => toggleWishlist(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={fav ? "heart" : "heart-outline"}
                      size={16}
                      color={fav ? "#EF4444" : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.foodItemTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.foodItemFooter}>
                  <Text style={styles.foodItemPrice}>{item.priceFormatted}</Text>
                  <TouchableOpacity
                    style={styles.foodAddBtn}
                    activeOpacity={0.7}
                    onPress={() => addToCart(item, 1)}
                  >
                    <Ionicons name="add" size={18} color="#1B7D3C" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />

      {/* ── STEP 1: Floating View Cart Action Bar ── */}
      {totalItems > 0 && (
        <View style={[styles.floatingCartBar, { zIndex: 999 }]}>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/cart")}
          >
            <Text style={styles.floatingCartBtnLeft}>View Cart ({totalItems})</Text>
            <Text style={styles.floatingCartBtnRight}>${totalPrice.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      )}
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  /* Safe area & scroll */
  safeArea: { flex: 1, backgroundColor: "#F8F8F8" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 44 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 6,
    paddingBottom: 10,
    backgroundColor: "#F8F8F8",
  },
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationText: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginLeft: 6 },
  bellWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", top: 6, right: 5,
    backgroundColor: "#EF4444", borderRadius: 9,
    minWidth: 18, height: 18,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: "#F8F8F8",
  },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "800" },

  /* Search */
  searchRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 14 },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFF", height: 48, borderRadius: 14,
    paddingHorizontal: 14, marginRight: 10,
    borderWidth: 1, borderColor: "#F3F4F6",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1A1A1A" },
  filterBtn: {
    width: 48, height: 48, backgroundColor: "#FFF", borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#F3F4F6",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },

  /* ── Hero Banner ── */
  heroBannerContainer: {
    backgroundColor: "#054D3B",
    borderRadius: 20,
    height: 180,
    position: "relative",
    overflow: "hidden",
    marginBottom: 16,
  },
  heroScrollView: {
    flex: 1,
  },
  heroBannerSlide: {
    width: width - 40,
    height: 180,
    padding: 16,
    position: "relative",
  },
  heroTextContainer: {
    width: "58%",
    zIndex: 2,
  },
  fastDeliveryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.22)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  fastDeliveryLabel: {
    color: "#34D399", fontSize: 10, fontWeight: "800",
    marginLeft: 4, letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 22,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 11,
    color: "#E5E7EB",
    marginBottom: 10,
  },
  orderNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 8,
    gap: 6,
  },
  orderNowText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "700",
  },
  orderNowArrow: {
    backgroundColor: "#16A34A",
    borderRadius: 10,
    padding: 3,
  },
  leafTop: {
    position: "absolute", top: 14, right: 128,
    opacity: 0.75, zIndex: 3,
    transform: [{ rotate: "-25deg" }],
  },
  leafBottom: {
    position: "absolute", bottom: 38, right: 16,
    opacity: 0.5, zIndex: 3,
    transform: [{ rotate: "40deg" }],
  },
  heroSaladImg: {
    position: "absolute",
    right: -20,
    top: -5,
    width: 175,
    height: 175,
    resizeMode: "contain",
    zIndex: 1,
  },
  heroTaxiImg: {
    position: "absolute",
    right: -10,
    top: 20,
    width: 160,
    height: 110,
    resizeMode: "contain",
    zIndex: 1,
  },
  heroRideImg: {
    position: "absolute",
    right: -10,
    top: 12,
    width: 155,
    height: 135,
    resizeMode: "contain",
    zIndex: 1,
  },
  dots: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    left: 0,
    right: 0,
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    zIndex: 3,
  },
  dot: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 12,
    height: 5,
    borderRadius: 3,
  },

  /* ── Service Cards ── */
  cardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  serviceCard: {
    flex: 1,
    height: 145,
    borderRadius: 18,
    padding: 14,
    position: "relative",
    overflow: "hidden",
  },
  foodCard: { backgroundColor: "#EFFDF4" },
  taxiCard: { backgroundColor: "#FFFBEB" },
  cardTextContent: {
    zIndex: 2,
    flex: 1,
    paddingRight: 55,
  },
  cardTitle: {
    fontSize: 16, fontWeight: "800", color: "#1A1A1A", lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 11, color: "#6B6B6B",
    marginTop: 4, marginBottom: 14, lineHeight: 15,
  },
  cardArrow: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    marginTop: "auto",
  },
  burgerImg: {
    position: "absolute",
    right: -12,
    bottom: -5,
    width: 120,
    height: 120,
    resizeMode: "contain",
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  carImg: {
    position: "absolute",
    right: -10,
    bottom: 2,
    width: 140,
    height: 85,
    resizeMode: "contain",
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  /* ── Section headers ── */
  sectionRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 24, marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  seeAll: { fontSize: 14, fontWeight: "600", color: "#1B7D3C" },

  /* ── Categories ── */
  catItem: { alignItems: "center", marginRight: 18, width: 64 },
  catCard: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: "#FFF", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#F3F4F6",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  catCardActive: { borderColor: "#1B7D3C", borderWidth: 2, backgroundColor: "#EFFDF4" },
  catImg: { width: 38, height: 38 },
  catEmoji: { fontSize: 24 },
  catName: { fontSize: 12, fontWeight: "600", color: "#1A1A1A", marginTop: 6, textAlign: "center" },
  catNameActive: { color: "#1B7D3C", fontWeight: "700" },

  /* ── Food Grid ── */
  foodGridSection: {
    marginTop: 24,
  },
  foodGridHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  foodGridTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  foodGridCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B6B6B",
  },
  foodGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  foodCardItem: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  foodImgWrap: {
    width: "100%",
    height: 110,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  foodImg: {
    width: "100%",
    height: 110,
    borderRadius: 12,
  },
  foodRatingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  foodRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  foodHeartBtn: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  foodItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 10,
  },
  foodItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  foodItemPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  foodAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFFDF4",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Restaurants ── */
  restCard: {
    width: 225, marginRight: 14, backgroundColor: "#FFF",
    borderRadius: 16, borderWidth: 1, borderColor: "#F3F4F6",
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  restImgWrap: { width: "100%", aspectRatio: 16 / 9, position: "relative", backgroundColor: "#F3F4F6" },
  restImg: { width: "100%", height: "100%" },
  heartBtn: {
    position: "absolute", top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center", justifyContent: "center",
  },
  restInfo: { padding: 11 },
  restName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  restTags: { fontSize: 11, color: "#6B6B6B", marginTop: 3 },
  restFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  restMeta: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
  restRating: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },

  /* ── Promo Banner ── */
  promoBanner: {
    marginTop: 24,
    backgroundColor: "#EFFDF4",
    borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  scooterImg: { width: 72, height: 64 },
  promoTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  promoSub: { fontSize: 12, color: "#6B6B6B", marginTop: 2 },
  promoBtn: {
    backgroundColor: "#1B7D3C",
    paddingLeft: 14, paddingRight: 5, paddingVertical: 8,
    borderRadius: 25, flexDirection: "row", alignItems: "center",
  },
  promoBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700", marginRight: 6 },
  promoArrow: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#FFF", alignItems: "center", justifyContent: "center",
  },
  floatingCartBar: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  floatingCartBtn: {
    backgroundColor: "#1B7D3C",
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCartBtnLeft: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  floatingCartBtnRight: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontWeight: "800",
  },
});
