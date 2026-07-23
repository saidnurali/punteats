import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

const { width } = Dimensions.get("window");

// ─── EXACT IMAGE CONSTANTS (Clean require paths without spaces) ───
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HERO_SALAD_IMG = require("../../../assets/images/hero-salad.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CAB_PREMIUM_IMG = require("../../../assets/images/cab_premium.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RIDE_IMG = require("../../../assets/images/ride.jpg");
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
    tag: "EXPRESS RIDER",
    tagIconType: "ion" as const,
    tagIconName: "bicycle-outline",
    title: "Lightning Fast\nScooter Delivery",
    subtitle: "Get packages and food\ndelivered in minutes",
    buttonText: "Send Express",
    imageSource: RIDE_IMG,
    imageStyleKey: "heroRideImg" as const,
  },
];

// ─── Data ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "1", name: "Pizza",    image: "https://wsrv.nl/?url=pngimg.com/uploads/pizza/pizza_PNG44077.png&output=png" },
  { id: "2", name: "Burger",   image: "https://wsrv.nl/?url=pngimg.com/uploads/burger_sandwich/burger_sandwich_PNG4135.png&output=png" },
  { id: "3", name: "Chicken",  image: "https://wsrv.nl/?url=pngimg.com/uploads/fried_chicken/fried_chicken_PNG14104.png&output=png" },
  { id: "4", name: "Desserts", image: "https://wsrv.nl/?url=pngimg.com/uploads/cake/cake_PNG13115.png&output=png" },
  { id: "5", name: "Drinks",   image: "https://wsrv.nl/?url=pngimg.com/uploads/cocacola/cocacola_PNG22.png&output=png" },
  { id: "6", name: "More",     emoji: "•••" },
];

const RESTAURANTS = [
  { id: "1", name: "Pizza House",    tags: "Italian • Pizza • Fast Food", time: "20-30 min", fee: "$5", rating: "4.6", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80" },
  { id: "2", name: "Burger Point",   tags: "Burgers • Fast Food",         time: "15-25 min", fee: "$5", rating: "4.5", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80" },
  { id: "3", name: "Chicken Center", tags: "Chicken • Rice • Wings",      time: "25-35 min", fee: "$5", rating: "4.3", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80" },
  { id: "4", name: "Food Factory",   tags: "Restaurant • Variety",        time: "30-40 min", fee: "$4", rating: "4.1", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80" },
];

const DELIVERY_SCOOTER = "https://wsrv.nl/?url=pngimg.com/uploads/motorcycle/motorcycle_PNG3162.png&output=png";

// ─── Component ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [searchQuery, setSearchQuery]       = useState("");
  const [activeCategory, setActiveCategory] = useState("Pizza");
  const [favorites, setFavorites]           = useState<Record<string, boolean>>({});
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const toggleFavorite = (id: string) =>
    setFavorites((p) => ({ ...p, [id]: !p[id] }));

  return (
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                {/* Left text column */}
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

                  {/* Order Now button directly inside left column below heroSubtitle without cut-off */}
                  <TouchableOpacity style={styles.orderNowBtn} activeOpacity={0.85}>
                    <Text style={styles.orderNowText}>{slide.buttonText}</Text>
                    <View style={styles.orderNowArrow}>
                      <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Decorative leaves */}
                <Ionicons name="leaf" size={16} color="#34D399" style={styles.leafTop} />
                <Ionicons name="leaf" size={12} color="#10B981" style={styles.leafBottom} />

                {/* Slide image positioned absolute right */}
                <Image source={slide.imageSource} style={styles[slide.imageStyleKey]} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          {/* Pagination dots placed at bottom center */}
          <View style={styles.dots}>
            {HERO_SLIDES.map((_, index) => (
              <View key={index} style={[styles.dot, activeHeroIndex === index && styles.dotActive]} />
            ))}
          </View>
        </Animated.View>

        {/* ── Dual Service Cards ── */}
        <Animated.View style={styles.cardsRow} entering={FadeInDown.duration(400).delay(140)}>
          {/* Food Delivery Card */}
          <TouchableOpacity style={[styles.serviceCard, styles.foodCard]} activeOpacity={0.85}>
            <View style={styles.cardTextContent}>
              <Text style={styles.cardTitle}>Food{"\n"}Delivery</Text>
              <Text style={styles.cardSubtitle}>Order your{"\n"}favorite food</Text>
              <View style={[styles.cardArrow, { backgroundColor: "#1B7D3C" }]}>
                <Ionicons name="arrow-forward" size={15} color="#FFF" />
              </View>
            </View>
            <Image source={BURGER_CARD_IMG} style={styles.burgerImg} resizeMode="contain" />
          </TouchableOpacity>

          {/* Taxi Service Card */}
          <TouchableOpacity style={[styles.serviceCard, styles.taxiCard]} activeOpacity={0.85}>
            <View style={styles.cardTextContent}>
              <Text style={styles.cardTitle}>Taxi{"\n"}Service</Text>
              <Text style={styles.cardSubtitle}>Book a ride{"\n"}anywhere</Text>
              <View style={[styles.cardArrow, { backgroundColor: "#F5A623" }]}>
                <Ionicons name="arrow-forward" size={15} color="#FFF" />
              </View>
            </View>
            <Image source={TAXI_CARD_IMG} style={styles.carImg} resizeMode="contain" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Categories ── */}
        <Animated.View style={styles.sectionRow} entering={FadeInDown.duration(400).delay(180)}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 4 }}
          entering={FadeInRight.duration(400).delay(220)}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.catItem}
                activeOpacity={0.75}
                onPress={() => setActiveCategory(cat.name)}
              >
                <View style={[styles.catCard, active && styles.catCardActive]}>
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={styles.catImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  )}
                </View>
                <Text style={[styles.catName, active && styles.catNameActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>

        {/* ── Popular Restaurants ── */}
        <Animated.View style={styles.sectionRow} entering={FadeInDown.duration(400).delay(260)}>
          <Text style={styles.sectionTitle}>Popular Restaurants</Text>
          <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 6 }}
          entering={FadeInRight.duration(400).delay(300)}
        >
          {RESTAURANTS.map((item) => {
            const fav = favorites[item.id] || false;
            return (
              <TouchableOpacity key={item.id} style={styles.restCard} activeOpacity={0.88}>
                <View style={styles.restImgWrap}>
                  <Image source={{ uri: item.image }} style={styles.restImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.heartBtn} onPress={() => toggleFavorite(item.id)}>
                    <Ionicons name={fav ? "heart" : "heart-outline"} size={17} color={fav ? "#EF4444" : "#FFF"} />
                  </TouchableOpacity>
                </View>
                <View style={styles.restInfo}>
                  <Text style={styles.restName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.restTags} numberOfLines={1}>{item.tags}</Text>
                  <View style={styles.restFooter}>
                    <Text style={styles.restMeta}>{item.time} • {item.fee}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="star" size={12} color="#F5A623" style={{ marginRight: 3 }} />
                      <Text style={styles.restRating}>{item.rating}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>

        {/* ── Promo Banner ── */}
        <Animated.View style={styles.promoBanner} entering={FadeInDown.duration(400).delay(340)}>
          <Image source={{ uri: DELIVERY_SCOOTER }} style={styles.scooterImg} resizeMode="contain" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.promoTitle}>Get 20% Off</Text>
            <Text style={styles.promoSub}>On your first order</Text>
          </View>
          <TouchableOpacity style={styles.promoBtn} activeOpacity={0.85}>
            <Text style={styles.promoBtnText}>Order Now</Text>
            <View style={styles.promoArrow}>
              <Ionicons name="arrow-forward" size={13} color="#1B7D3C" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
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
    top: 10,
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
});
