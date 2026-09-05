import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInRight, FadeIn } from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/CartContext";
import { useNotifications } from "@/lib/NotificationContext";
import { useWishlist } from "@/lib/WishlistContext";
import { useLanguage } from "@/lib/LanguageContext";
import { RestaurantCard } from "@/components/RestaurantCard";
import { CATEGORIES, coffeeTeaIcon } from "@/lib/categoriesData";
import { CategorySkeleton, FoodCardSkeleton, RestaurantSkeleton } from "@/components/SkeletonLoader";
import { getCachedRestaurants, fetchRestaurants, fetchAllProducts, getCachedAllProducts } from "@/lib/DataCache";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/getCurrentUser";

const { width } = Dimensions.get("window");

// ─── EXACT IMAGE CONSTANTS (Clean require paths without spaces) ───
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HERO_SALAD_IMG = require("../../../assets/images/hero-salad.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BURGER_CARD_IMG = require("../../../assets/images/burger-food.png");

// ─── Data ────────────────────────────────────────────────────────────────────

const INITIAL_RESTAURANTS: any[] = [];

const DELIVERY_SCOOTER = "https://wsrv.nl/?url=pngimg.com/uploads/motorcycle/motorcycle_PNG3162.png&output=png";

const CATEGORY_PNG_ICONS: Record<string, string> = {
  'All': 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png',
  'Breakfast': 'https://cdn-icons-png.flaticon.com/512/837/837592.png',
  'Somali Dishes': 'https://cdn-icons-png.flaticon.com/512/3480/3480823.png',
  'Chicken': 'https://cdn-icons-png.flaticon.com/512/1046/1046751.png',
  'Pizza': 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png',
  'Burger': 'https://cdn-icons-png.flaticon.com/512/878/878052.png',
  'Coffee & Tea': 'https://cdn-icons-png.flaticon.com/512/2935/2935413.png',
  'Desserts': 'https://cdn-icons-png.flaticon.com/512/2988/2988922.png',
  'Drinks & Juices': 'https://cdn-icons-png.flaticon.com/512/2405/2405479.png',
  'Pasta': 'https://cdn-icons-png.flaticon.com/512/135/137837.png',
  'Sandwich': 'https://cdn-icons-png.flaticon.com/512/6978/6978160.png',
  'Seafood': 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png',
};

// ─── Component ───────────────────────────────────────────────────────────────

const HeroCarousel = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeSlide, setActiveSlide] = React.useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const isDragging = React.useRef(false);
  // Use a ref for slide index so the interval is created once and never re-created.
  // Previously [activeSlide] dep caused the interval to clear+restart every 3.5s — wasted work.
  const activeSlideRef = React.useRef(0);

  const HERO_SLIDES = React.useMemo(() => [
    {
      id: "slide-1",
      tag: "FAST DELIVERY",
      tagIconType: "mci" as const,
      tagIconName: "lightning-bolt",
      title: t("order_your_favorite"),
      subtitle: "Your favorite meals,\ndelivered to your door",
      buttonText: t("order_now"),
      imageSource: HERO_SALAD_IMG,
      imageStyleKey: "heroSaladImg" as const,
    }
  ], [t]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (isDragging.current) return;
      const nextSlide = (activeSlideRef.current + 1) % HERO_SLIDES.length;
      scrollViewRef.current?.scrollTo({ x: nextSlide * (width - 40), animated: true });
    }, 3500);
    return () => clearInterval(timer);
  }, [HERO_SLIDES.length]);

  const handleScroll = useCallback((e: any) => {
    const slide = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
    if (slide !== activeSlideRef.current && slide >= 0 && slide < HERO_SLIDES.length) {
      activeSlideRef.current = slide;
      setActiveSlide(slide);
    }
  }, []);

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
};

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
                toggleWishlist(item);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={fav ? "heart" : "heart-outline"}
                size={22}
                color={fav ? "#EF4444" : "#EF4444"} // always red outline or filled
              />
            </TouchableOpacity>
          </View>
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
  const { t } = useLanguage();
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart();
  const { unreadCount } = useNotifications();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [selectedCategoryName, setSelectedCategoryName] = useState("All");
  const [selectedCategoryId, setSelectedCategoryId] = useState("ALL");

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState("Popularity");
  const [priceRange, setPriceRange] = useState("");
  const [searchQuery, setSearchQuery] = useState('');

  const [allDishes, setAllDishes] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>(CATEGORIES);
  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Saved Addresses ──
  const ADDRESSES_KEY = '@puntgo_saved_addresses';
  const DEFAULT_ADDRESSES = [
    { id: 'custom', label: 'Custom', icon: 'location', address: 'Enter custom address...' },
  ];
  const [savedAddresses, setSavedAddresses] = useState<any[]>(DEFAULT_ADDRESSES);
  const [activeAddressId, setActiveAddressId] = useState('custom');
  const [isAddressSelectorVisible, setIsAddressSelectorVisible] = useState(false);
  const [customAddressText, setCustomAddressText] = useState('');

  const activeAddress = useMemo(() =>
    savedAddresses.find(a => a.id === activeAddressId) || savedAddresses[0],
  [savedAddresses, activeAddressId]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchAddresses = async () => {
        try {
          const profile = await getCurrentUser();
          if (!profile) return;

          const { data, error } = await supabase
            .from("saved_addresses")
            .select("*")
            .eq("user_id", profile.id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true });
            
          if (!error && data && isMounted) {
            const mapped = data.map(a => ({
              id: a.id,
              label: a.label,
              icon: a.label === 'Home' ? 'home' : a.label === 'Office' ? 'business' : 'location',
              address: a.address,
              is_default: a.is_default
            }));
            setSavedAddresses([...mapped, ...DEFAULT_ADDRESSES]);
            
            // if we have addresses and current selection is missing, default to the top one
            const hasActive = mapped.some(m => m.id === activeAddressId);
            if (!hasActive && mapped.length > 0) {
              const defaultAddr = mapped.find(m => m.is_default) || mapped[0];
              setActiveAddressId(defaultAddr.id);
            }
          }
        } catch (e) {}
      };
      
      fetchAddresses();
      
      AsyncStorage.getItem(ADDRESSES_KEY).then(raw => {
        if (raw && isMounted) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.activeId) setActiveAddressId(parsed.activeId);
            if (parsed.customText) setCustomAddressText(parsed.customText);
          } catch {}
        }
      });
      
      return () => { isMounted = false; };
    }, [activeAddressId])
  );

  const selectAddress = useCallback((id: string) => {
    setActiveAddressId(id);
    setIsAddressSelectorVisible(false);
    AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify({ activeId: id, customText: customAddressText }));
  }, [customAddressText]);

  const customText = customAddressText;

  useEffect(() => {
    // ── Step 1: Render instantly from memory cache (zero network) ──
    const memProducts = getCachedAllProducts();
    const memRestaurants = getCachedRestaurants();
    if (memProducts.length > 0) {
      setAllDishes(memProducts);
      setIsLoading(false);
    }
    if (memRestaurants.length > 0) {
      setRestaurantsList(memRestaurants);
    }

    // ── Step 2: Fetch fresh data in background (stale-while-revalidate) ──
    fetchRestaurants().then(result => {
      if (result && result.length > 0) setRestaurantsList(result);
    }).catch(() => {});

    fetchAllProducts().then(result => {
      if (result && result.length > 0) {
        setAllDishes(result);
        setIsLoading(false);
      } else {
        // Network returned nothing — clear loading state so skeletons don't spin forever
        setIsLoading(false);
      }
    }).catch(() => {
    }).catch(() => {
      setIsLoading(false);
    });

    // ── Step 3: Realtime Database Listeners ──
    const refreshData = async () => {
      const freshRestaurants = await fetchRestaurants(true);
      if (freshRestaurants?.length > 0) setRestaurantsList(freshRestaurants);

      const freshProducts = await fetchAllProducts(true);
      if (freshProducts?.length > 0) setAllDishes(freshProducts);
    };

    const realtimeChannel = supabase.channel(`customer_app_index_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_items' }, refreshData)
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, []);


  const categoriesWithItems = useMemo(() => {
    if (!allDishes || allDishes.length === 0) return [];
    
    // Unique list of categories present in DB items
    const rawCategories = Array.from(new Set(allDishes.map((item) => item.category).filter(Boolean)));
    
    const formattedCategories = [
      { id: 'all', name: 'All', emoji: '🍽️' },
      ...rawCategories.map((catName) => {
        const catNameStr = String(catName);
        const normalizedDBName = catNameStr.trim().toLowerCase();
        const found = CATEGORIES.find(c => c.name.toLowerCase() === normalizedDBName || c.name.toLowerCase().includes(normalizedDBName) || normalizedDBName.includes(c.name.toLowerCase()));
        
        return {
          id: found?.id || catNameStr.toLowerCase().replace(/\s+/g, '-'),
          name: catNameStr,
          emoji: found?.emoji,
        };
      })
    ];

    return formattedCategories;
  }, [allDishes]);

  const filteredFoods = useMemo(() => {
    let foods = (selectedCategoryId === 'all' || selectedCategoryName.toLowerCase() === 'all')
      ? allDishes 
      : allDishes.filter(dish => {
          if (dish.category_id === selectedCategoryId) return true;
          const searchCat = selectedCategoryName.toLowerCase();
          const dishCat = dish.category ? dish.category.toLowerCase() : "";
          const dishName = dish.name ? dish.name.toLowerCase() : "";
          return dishCat.includes(searchCat) || dishName.includes(searchCat);
        });

    // ⚡ Instant live search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      foods = foods.filter(dish =>
        dish.name?.toLowerCase().includes(q) ||
        dish.category?.toLowerCase().includes(q) ||
        dish.restaurant_name?.toLowerCase().includes(q) ||
        dish.description?.toLowerCase().includes(q)
      );
    }

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
  }, [allDishes, selectedCategoryId, selectedCategoryName, priceRange, sortBy, searchQuery]);


  // Build a quantity map so renderItem doesn't do O(n) .find() per dish
  // Before: cartItems.find(c => c.id === item.id)?.quantity — O(n) × numDishes per render
  // After: O(1) Map lookup per dish
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach(c => map.set(c.id, (map.get(c.id) || 0) + c.quantity));
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
        <TouchableOpacity
          style={styles.searchBox}
          activeOpacity={0.75}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
          <Text style={styles.searchPlaceholder}>{t('search_placeholder')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Hero Banner ── */}
      <HeroCarousel />

      {/* ── Dual Service Cards ── */}
      <Animated.View style={styles.cardsRow}>
        <TouchableOpacity style={[styles.serviceCard, styles.foodCard]} activeOpacity={0.7}>
          <View style={styles.cardTextContent}>
            <Text style={styles.cardTitle}>{t("food_service").replace(' ', '\n')}</Text>
            <Text style={styles.cardSubtitle}>{t("order_your_favorite")}</Text>
            <View style={[styles.cardArrow, { backgroundColor: "#1B7D3C" }]}>
              <Ionicons name="arrow-forward" size={15} color="#FFF" />
            </View>
          </View>
          <Image source={BURGER_CARD_IMG} style={styles.burgerImg} contentFit="contain" cachePolicy="memory-disk" transition={200} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.serviceCard, styles.parcelCard]} activeOpacity={0.7} onPress={() => router.push('/parcel')}>
          <View style={styles.cardTextContent}>
            <Text style={styles.cardTitle}>{"Parcel\nDelivery"}</Text>
            <Text style={styles.cardSubtitle}>{"Send a package"}</Text>
            <View style={[styles.cardArrow, { backgroundColor: "#F5A623" }]}>
              <Ionicons name="arrow-forward" size={15} color="#FFF" />
            </View>
          </View>
          <Image source={{ uri: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png" }} style={[styles.carImg, { width: 64, height: 64, right: 8, bottom: 8 }]} contentFit="contain" cachePolicy="memory-disk" transition={200} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Categories ── */}
      <Animated.View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{t("categories")}</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/categories')}><Text style={styles.seeAll}>{t("see_all")}</Text></TouchableOpacity>
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
                <Text style={styles.catEmoji}>{cat.emoji || (cat.id === "0" || cat.id === "all" ? "🍽️" : "🍴")}</Text>
              </View>
              <Text style={[styles.catName, active && styles.catNameActive]} numberOfLines={1} ellipsizeMode="tail">
                {cat.name}
              </Text>
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
        <Text style={styles.sectionTitle}>{t("popular_restaurants")}</Text>
        <TouchableOpacity onPress={() => router.push('/all-restaurants')}><Text style={styles.seeAll}>{t("see_all")}</Text></TouchableOpacity>
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
          <Text style={styles.promoTitle}>{t("get_20_off")}</Text>
          <Text style={styles.promoSub}>{t("on_first_order")}</Text>
        </View>
        <TouchableOpacity style={styles.promoBtn} activeOpacity={0.7}>
          <Text style={styles.promoBtnText}>{t("order_now")}</Text>
          <View style={styles.promoArrow}>
            <Ionicons name="arrow-forward" size={13} color="#1B7D3C" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isLoading, allDishes.length, restaurantsList, isWishlisted, toggleWishlist, t]);

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
        <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={() => setIsAddressSelectorVisible(true)}>
          <Ionicons name="location" size={20} color="#1B7D3C" />
          <View style={{ marginLeft: 6 }}>
            <Text style={{ fontSize: 11, color: '#6B6B6B', fontWeight: '600' }}>Delivering to</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {activeAddressId === 'custom' && customAddressText ? customAddressText : activeAddress?.label || t('garowe_puntland')}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#1A1A1A" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bellWrap} 
          activeOpacity={0.7}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
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
            {/* ── Location Selector Modal ── */}
        <Modal
          visible={isAddressSelectorVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsAddressSelectorVisible(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setIsAddressSelectorVisible(false)}
          />
          <View style={styles.addressSheet}>
            <View style={styles.addressSheetHandle} />
            <Text style={styles.addressSheetTitle}>Deliver To</Text>
            {savedAddresses.map(addr => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addressRow, activeAddressId === addr.id && styles.addressRowActive]}
                onPress={() => selectAddress(addr.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.addressIconWrap, activeAddressId === addr.id && styles.addressIconWrapActive]}>
                  <Ionicons name={addr.icon as any} size={20} color={activeAddressId === addr.id ? '#FFFFFF' : '#1B7D3C'} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.addressLabel, activeAddressId === addr.id && styles.addressLabelActive]}>{addr.label}</Text>
                  <Text style={styles.addressValue} numberOfLines={1}>
                    {addr.id === 'custom' && customAddressText ? customAddressText : addr.address}
                  </Text>
                  {addr.id === 'custom' && activeAddressId === 'custom' && (
                    <TextInput
                      style={styles.customAddressInput}
                      value={customAddressText}
                      onChangeText={setCustomAddressText}
                      placeholder="Type your address..."
                      placeholderTextColor="#9CA3AF"
                      onBlur={() => AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify({ activeId: 'custom', customText: customAddressText }))}
                    />
                  )}
                </View>
                {activeAddressId === addr.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#1B7D3C" />
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#1B7D3C', borderRadius: 14, paddingVertical: 14, marginTop: 10
              }}
              activeOpacity={0.85}
              onPress={() => {
                setIsAddressSelectorVisible(false);
                router.push('/saved-addresses');
              }}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Add New Address</Text>
            </TouchableOpacity>
            
            <View style={{ height: 32 }} />
          </View>
        </Modal>

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
  locationText: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  addressSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  addressSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16,
  },
  addressSheetTitle: {
    fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  addressRowActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#1B7D3C',
  },
  addressIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center',
  },
  addressIconWrapActive: { backgroundColor: '#1B7D3C' },
  addressLabel: {
    fontSize: 15, fontWeight: '700', color: '#1A1A1A',
  },
  addressLabelActive: { color: '#1B7D3C' },
  addressValue: {
    fontSize: 12, color: '#6B6B6B', marginTop: 2,
  },
  customAddressInput: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1A1A1A',
  },
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
    paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#F3F4F6",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: "#9CA3AF" },
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
  parcelCard: { backgroundColor: "#FFFBEB" },
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
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "transparent", alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  catCardActive: {
    backgroundColor: "#E8F5E9",
  },
  catImg: { 
    width: 48, height: 48,
},
  catEmoji: { fontSize: 42 },
  catName: { fontSize: 13, fontWeight: "600", color: "#4B5563", textAlign: "center", width: "100%", paddingHorizontal: 4 },
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
  /* ── Modals ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
});
