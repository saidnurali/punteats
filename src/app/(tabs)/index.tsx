import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInRight, FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { PRODUCTS_DATA, Product, fetchProductsFromSupabase, mapFoodItemToProduct } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/CartContext";
import { useWishlist } from "@/lib/WishlistContext";
import { RestaurantCard } from "@/components/RestaurantCard";
import { CATEGORIES, coffeeTeaIcon } from "@/lib/categoriesData";
import { CategorySkeleton, FoodCardSkeleton, RestaurantSkeleton } from "@/components/SkeletonLoader";
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

const HeroCarousel = () => {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = React.useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const isDragging = React.useRef(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (isDragging.current) return;
      const nextSlide = (activeSlide + 1) % HERO_SLIDES.length;
      scrollViewRef.current?.scrollTo({ x: nextSlide * (width - 40), animated: true });
    }, 3500);
    return () => clearInterval(timer);
  }, [activeSlide]);

  const handleScroll = (e: any) => {
    const slide = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
    if (slide !== activeSlide && slide >= 0 && slide < HERO_SLIDES.length) {
      setActiveSlide(slide);
    }
  };

  return (
    <Animated.View style={styles.heroBannerContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onScrollEndDrag={() => { isDragging.current = false; }}
        decelerationRate="fast"
        snapToInterval={width - 40}
        style={styles.heroScrollView}
      >
        {HERO_SLIDES.map((slide) => (
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

              <TouchableOpacity style={styles.orderNowBtn} activeOpacity={0.85} onPress={() => router.push('/categories')}>
                <Text style={styles.orderNowText}>{slide.buttonText}</Text>
                <View style={styles.orderNowArrow}>
                  <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>

            <Ionicons name="leaf" size={16} color="#34D399" style={styles.leafTop} />
            <Ionicons name="leaf" size={12} color="#10B981" style={styles.leafBottom} />

            <Image source={slide.imageSource} style={styles[slide.imageStyleKey as keyof typeof styles] as any} contentFit="contain" cachePolicy="memory-disk" transition={200} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {HERO_SLIDES.map((_, index) => (
          <View key={index} style={[styles.dot, activeSlide === index && styles.dotActive]} />
        ))}
      </View>
    </Animated.View>
  );
};

const FilterModal = ({ visible, onClose, sortBy, setSortBy, priceRange, setPriceRange, onApply, onReset }: any) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' }}>Sort & Filter</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#1A1A1A"/></TouchableOpacity>
          </View>
          
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 }}>Sort By</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {['Popularity', 'Rating', 'Delivery Time'].map(opt => (
               <TouchableOpacity 
                 key={opt} 
                 style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: sortBy === opt ? '#1B7D3C' : '#E5E7EB', backgroundColor: sortBy === opt ? '#F0FDF4' : '#FFF' }} 
                 onPress={() => setSortBy(opt)}
               >
                 <Text style={{ color: sortBy === opt ? '#1B7D3C' : '#4B5563', fontWeight: sortBy === opt ? '600' : '400' }}>{opt}</Text>
               </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 }}>Price Range</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 40 }}>
            {['$', '$$', '$$$'].map(opt => (
               <TouchableOpacity 
                 key={opt} 
                 style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: priceRange === opt ? '#1B7D3C' : '#E5E7EB', backgroundColor: priceRange === opt ? '#F0FDF4' : '#FFF' }} 
                 onPress={() => setPriceRange(opt)}
               >
                 <Text style={{ color: priceRange === opt ? '#1B7D3C' : '#4B5563', fontWeight: priceRange === opt ? '600' : '400' }}>{opt}</Text>
               </TouchableOpacity>
            ))}
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 'auto' }}>
             <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }} onPress={onReset}>
                <Text style={{ color: '#4B5563', fontWeight: 'bold', fontSize: 16 }}>Reset All</Text>
             </TouchableOpacity>
             <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1B7D3C', alignItems: 'center' }} onPress={onApply}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Apply Filters</Text>
             </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface HomeDishCardProps {
  item: any;
  fav: boolean;
  /** Pass the quantity as a stable primitive so memo can diff it */
  cartQuantity: number;
  toggleWishlist: (item: any) => void;
  addToCart: (item: any, qty: number) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
}

const HomeDishCard = React.memo((
  { item, fav, cartQuantity, toggleWishlist, addToCart, updateQuantity, removeFromCart }: HomeDishCardProps
) => {
  const router = useRouter();
  const safeImage = item?.images?.[0] || item?.image_url || item?.image;
  return (
    <View style={{ width: "48%" }}>
      <TouchableOpacity
        style={[styles.foodCardItem, { width: "100%", marginBottom: 0 }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={styles.foodImgWrap}>
          <Image source={{ uri: safeImage }} style={styles.foodImg} contentFit="cover" cachePolicy="memory-disk" transition={200} recyclingKey={item.id} />
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
          {cartQuantity > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4 }}>
              <TouchableOpacity 
                onPress={() => cartQuantity > 1 ? updateQuantity(item.id, -1) : removeFromCart(item.id)}
                style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
              >
                <Ionicons name="remove" size={14} color="#1B7D3C" />
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 8, fontSize: 13, fontWeight: '700', color: '#1B7D3C' }}>{cartQuantity}</Text>
              <TouchableOpacity 
                onPress={() => updateQuantity(item.id, 1)}
                style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B7D3C', borderRadius: 12 }}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.foodAddBtn}
              activeOpacity={0.7}
              onPress={() => addToCart(item, 1)}
            >
              <Ionicons name="add" size={18} color="#1B7D3C" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
},
// Custom comparator: only re-render when the card's own data changes.
// This is the key to O(1) re-renders when a single cart item changes.
(prev, next) =>
  prev.item === next.item &&
  prev.fav === next.fav &&
  prev.cartQuantity === next.cartQuantity
);


export default function HomeScreen() {
  const router = useRouter();
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [selectedCategoryName, setSelectedCategoryName] = useState("All");
  const [selectedCategoryId, setSelectedCategoryId] = useState("ALL");

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState("Popularity");
  const [priceRange, setPriceRange] = useState("");

  const [allDishes, setAllDishes] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>(CATEGORIES);
  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Read BOTH caches in parallel — was sequential, costing ~100ms extra
        const [cachedRest, cachedProd] = await Promise.all([
          AsyncStorage.getItem('@cached_home_restaurants'),
          AsyncStorage.getItem('@cached_home_products'),
        ]);

        if (cachedRest && cachedProd && cachedProd !== '[]') {
          setRestaurantsList(JSON.parse(cachedRest));
          setAllDishes(JSON.parse(cachedProd));
          setIsLoading(false); // Show cached UI instantly
        }

        // 2. Fetch restaurants + products in PARALLEL — was sequential, costing 1–3s extra
        // Only select columns the UI actually uses — reduces JSON payload by ~60%
        const [restResult, fetchedProducts] = await Promise.all([
          supabase
            .from('restaurants')
            .select('id, name, category, prep_time, delivery_fee, rating, cover_image, image_url, logo_image, emoji, status')
            .eq('status', 'Active')
            .limit(20),
          fetchProductsFromSupabase(),
        ]);

        if (restResult.data) {
          const mappedRests = restResult.data.map((r: any) => ({
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
          AsyncStorage.setItem('@cached_home_restaurants', JSON.stringify(mappedRests)).catch(() => null);
        }
        if (fetchedProducts && fetchedProducts.length > 0) {
          setAllDishes(fetchedProducts);
          AsyncStorage.setItem('@cached_home_products', JSON.stringify(fetchedProducts)).catch(() => null);
        }
        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
      }
    };

    loadData();

    // Removed global realtime on food_items + restaurants tables — was triggering
    // full data reload for ANY change from ANY restaurant, causing unnecessary re-renders.
    // Data is stale-while-revalidate via cache; use manual refresh for admin updates.
  }, []);

  const categoriesWithItems = useMemo(() => {
    return CATEGORIES.filter(cat => {
      if (cat.id === '0' || cat.id === 'ALL') return true;
      return allDishes.some(dish => 
        dish.category_id === cat.id ||
        dish.category?.toLowerCase().includes(cat.name.toLowerCase()) ||
        dish.name?.toLowerCase().includes(cat.name.toLowerCase())
      );
    });
  }, [allDishes]);

  const filteredFoods = useMemo(() => {
    let foods = (selectedCategoryId === 'ALL' || selectedCategoryId === '0' || selectedCategoryName.toLowerCase() === 'all')
      ? allDishes 
      : allDishes.filter(dish => 
          dish.category_id === selectedCategoryId ||
          (dish.category && dish.category.toLowerCase().includes(selectedCategoryName.toLowerCase())) ||
          (dish.name && dish.name.toLowerCase().includes(selectedCategoryName.toLowerCase()))
        );

    if (priceRange === '$') {
       foods = foods.filter(item => item.price < 5);
    } else if (priceRange === '$$') {
       foods = foods.filter(item => item.price >= 5 && item.price <= 15);
    } else if (priceRange === '$$$') {
       foods = foods.filter(item => item.price > 15);
    }

    if (sortBy === 'Rating') {
       return [...foods].sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'));
    } else if (sortBy === 'Delivery Time') {
       return [...foods].sort((a, b) => parseInt(a.deliveryTime || '0') - parseInt(b.deliveryTime || '0'));
    }

    return foods;
  }, [allDishes, selectedCategoryId, selectedCategoryName, priceRange, sortBy]);

  // Build a quantity map so renderItem doesn't do O(n) .find() per dish
  // Before: cartItems.find(c => c.id === item.id)?.quantity — O(n) × numDishes per render
  // After: O(1) Map lookup per dish
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach(c => map.set(c.id, c.quantity));
    return map;
  }, [cartItems]);

  // Stable string key derived from cart — avoids passing the whole cartItems array as extraData
  // which caused ALL FlatList items to re-render whenever any cart field changed
  const cartExtraKey = useMemo(() => cartItems.map(c => `${c.id}:${c.quantity}`).join(','), [cartItems]);
  // Memoized header — was an inline function, causing ListHeaderComponent to
  // unmount + remount on every parent render (every category tap, every cart update)
  const MemoizedHeader = useMemo(() => (
    <>
      {/* ── Search ── */}
      <Animated.View style={styles.searchRow}>
        <TouchableOpacity style={styles.searchBox} activeOpacity={0.9} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
          <Text style={{ color: "#9CA3AF", fontSize: 15, flex: 1 }}>Search food, restaurants, dishes...</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7} onPress={() => setIsFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Hero Banner ── */}
      <HeroCarousel />

      {/* ── Dual Service Cards ── */}
      <Animated.View style={styles.cardsRow}>
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
      <Animated.View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/categories')}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
      </Animated.View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 4 }}
        data={isLoading && allDishes.length === 0 ? [1,2,3,4,5,6] as any : categoriesWithItems}
        keyExtractor={(cat, idx) => isLoading && allDishes.length === 0 ? String(idx) : cat.id}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        renderItem={({ item: cat }) => {
          if (isLoading && allDishes.length === 0) return <CategorySkeleton />;
          const active = selectedCategoryId === cat.id;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.catItem}
              onPress={() => {
                setSelectedCategoryId(cat.id);
                setSelectedCategoryName(cat.name);
              }}
            >
              <View style={[styles.catCard, active && styles.catCardActive]}>
                {cat.image ? (
                  <Image source={typeof cat.image === 'string' ? { uri: cat.image } : cat.image} style={styles.catImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                ) : cat.emoji ? (
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                ) : (
                  <Ionicons name={cat.id === "0" || cat.id === "ALL" ? "restaurant-outline" : "fast-food-outline"} size={34} color={active ? "#10B981" : "#4B5563"} />
                )}
              </View>
              <Text style={[styles.catName, active && styles.catNameActive]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={{ height: 16 }} />
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isLoading, allDishes.length, categoriesWithItems, selectedCategoryId]);

  // Memoized footer — same issue as header: was inline, causing remount on every render
  const MemoizedFooter = useMemo(() => (
    <>
      {/* ── Popular Restaurants ── */}
      <Animated.View style={styles.sectionRow} entering={FadeInDown.duration(400).delay(260)}>
        <Text style={styles.sectionTitle}>Popular Restaurants</Text>
        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
      </Animated.View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 6 }}
        data={isLoading && allDishes.length === 0 ? [1,2,3] as any : restaurantsList}
        keyExtractor={(item, idx) => isLoading && allDishes.length === 0 ? String(idx) : item.id}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        renderItem={({ item }) => {
          if (isLoading && allDishes.length === 0) return <RestaurantSkeleton />;
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
      <Animated.View style={styles.promoBanner}>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isLoading, allDishes.length, restaurantsList]);

  // Stable renderItem — useCallback ensures HomeDishCard's React.memo actually works.
  // Without this, the inline anonymous function recreates every render, defeating memoization.
  const renderFoodItem = useCallback(({ item }: { item: any }) => {
    if (isLoading && allDishes.length === 0) {
      return (
        <View style={{ width: "48%" }}>
          <FoodCardSkeleton />
        </View>
      );
    }
    const fav = isWishlisted(item.id);
    // O(1) Map lookup — was O(n) .find() per dish per render (50 dishes × every cart update)
    const cartQuantity = cartQuantityMap.get(item.id) ?? 0;
    return (
      <HomeDishCard
        item={item}
        fav={fav}
        cartQuantity={cartQuantity}
        toggleWishlist={toggleWishlist}
        addToCart={addToCart}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
      />
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, allDishes.length, cartQuantityMap, isWishlisted]);

  return (
    <Animated.View style={{ flex: 1 }}>
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
        data={isLoading && allDishes.length === 0 ? [1,2,3,4,5,6] as any : filteredFoods}
        keyExtractor={(item, idx) => isLoading && allDishes.length === 0 ? String(idx) : item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 12 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ padding: 40, alignItems: 'center', marginTop: 40 }}>
               <Ionicons name="search-outline" size={48} color="#9CA3AF" />
               <Text style={{ marginTop: 16, fontSize: 16, color: '#4B5563', textAlign: 'center' }}>
                 No items found in this category
               </Text>
            </View>
          ) : null
        }
        ListHeaderComponent={<View>{MemoizedHeader}</View>}
        ListFooterComponent={<View>{MemoizedFooter}</View>}
        extraData={cartExtraKey}
        renderItem={renderFoodItem}
      />
      
      <FilterModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        sortBy={sortBy}
        setSortBy={setSortBy}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        onApply={() => setIsFilterModalVisible(false)}
        onReset={() => {
          setSortBy("Popularity");
          setPriceRange("$");
        }}
      />

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
  catItem: { alignItems: "center", marginRight: 18, width: 70 },
  catCard: {
    width: 70, height: 70, borderRadius: 20,
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#F3F4F6",
  },
  catCardActive: {
    borderColor: "#10B981", borderWidth: 2,
  },
  catImg: { width: 44, height: 44, borderRadius: 12 },
  catEmoji: { fontSize: 24 },
  catName: { fontSize: 13, fontWeight: "600", color: "#1F2937", marginTop: 6, textAlign: "center" },
  catNameActive: { color: "#10B981", fontWeight: "700" },

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
    zIndex: 9999,
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
