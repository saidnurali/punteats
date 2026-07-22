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
import { router } from "expo-router";

const { width } = Dimensions.get("window");

// Reliable CDN-hosted transparent PNGs for categories (wsrv.nl proxies pngimg.com transparently)
const CATEGORIES = [
  { id: "1", name: "Pizza", emoji: "🍕", image: "https://wsrv.nl/?url=pngimg.com/uploads/pizza/pizza_PNG44077.png&output=png" },
  { id: "2", name: "Burger", emoji: "🍔", image: "https://wsrv.nl/?url=pngimg.com/uploads/burger_sandwich/burger_sandwich_PNG4135.png&output=png" },
  { id: "3", name: "Chicken", emoji: "🍗", image: "https://wsrv.nl/?url=pngimg.com/uploads/fried_chicken/fried_chicken_PNG14104.png&output=png" },
  { id: "4", name: "Desserts", emoji: "🧁", image: "https://wsrv.nl/?url=pngimg.com/uploads/cake/cake_PNG13115.png&output=png" },
  { id: "5", name: "Drinks", emoji: "🥤", image: "https://wsrv.nl/?url=pngimg.com/uploads/cocacola/cocacola_PNG22.png&output=png" },
  { id: "6", name: "More", emoji: "•••" },
];

const POPULAR_RESTAURANTS = [
  {
    id: "1",
    name: "Pizza House",
    tags: "Italian • Pizza • Fast Food",
    time: "20-30 min",
    fee: "$5",
    rating: "4.6",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "2",
    name: "Burger Point",
    tags: "Burgers • Fast Food",
    time: "15-25 min",
    fee: "$5",
    rating: "4.5",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "3",
    name: "Chicken Center",
    tags: "Chicken • Rice • Wings",
    time: "25-35 min",
    fee: "$5",
    rating: "4.3",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "4",
    name: "Food Factory",
    tags: "Restaurant • Variety",
    time: "30-40 min",
    fee: "$4",
    rating: "4.1",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
  },
];

// wsrv.nl proxies pngimg.com so hotlinking works in React Native
const BURGER_IMG = "https://wsrv.nl/?url=pngimg.com/uploads/burger_sandwich/burger_sandwich_PNG4135.png&output=png";
const CAR_IMG = "https://wsrv.nl/?url=pngimg.com/uploads/car_sedan/car_sedan_PNG102577.png&output=png";
const DELIVERY_SCOOTER_IMG = "https://wsrv.nl/?url=pngimg.com/uploads/motorcycle/motorcycle_PNG3162.png&output=png";
// Local high-quality hero food bowl image
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HERO_BOWL_LOCAL = require("../../../assets/images/home-image.png");

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Pizza");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.locationSelector} activeOpacity={0.7}>
          <Ionicons name="location" size={20} color="#1B7D3C" />
          <Text style={styles.locationText}>Garowe, Puntland</Text>
          <Ionicons name="chevron-down" size={16} color="#1A1A1A" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.notificationButton} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Section */}
        <Animated.View style={styles.searchSection} entering={FadeInDown.duration(400).delay(50)}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search food, restaurants, dishes..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Featured Hero Banner ── */}
        <Animated.View style={styles.heroBanner} entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.heroLeftContent}>
            <View style={styles.fastDeliveryTag}>
              <MaterialCommunityIcons name="lightning-bolt" size={14} color="#34D399" />
              <Text style={styles.fastDeliveryText}>FAST DELIVERY</Text>
            </View>

            <Text style={styles.heroTitle}>
              Delicious Food{"\n"}Delivered Fast
            </Text>
            <Text style={styles.heroSubtitle}>
              Your favorite meals,{"\n"}delivered to your door
            </Text>

            <TouchableOpacity style={styles.orderNowButton} activeOpacity={0.8}>
              <Text style={styles.orderNowText}>Order Now</Text>
              <View style={styles.orderNowArrowCircle}>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Decorative leaves */}
          <Ionicons name="leaf" size={18} color="#34D399" style={styles.floatingLeafTop} />
          <Ionicons name="leaf" size={14} color="#10B981" style={styles.floatingLeafBottom} />

          {/* Hero food bowl image – absolute positioned right, local asset */}
          <Image
            source={HERO_BOWL_LOCAL}
            style={styles.heroImage}
            resizeMode="contain"
          />

          {/* Pagination Dots */}
          <View style={styles.paginationDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>

        {/* ── Main Dual Services Grid ── */}
        <Animated.View style={styles.servicesGrid} entering={FadeInDown.duration(400).delay(150)}>
          {/* Food Delivery Card */}
          <TouchableOpacity style={[styles.serviceCard, styles.foodServiceCard]} activeOpacity={0.8}>
            <View style={styles.serviceTextContainer}>
              <Text style={styles.serviceTitle}>Food{"\n"}Delivery</Text>
              <Text style={styles.serviceSubtitle}>Order your{"\n"}favorite food</Text>
              <View style={[styles.serviceArrowCircle, { backgroundColor: "#1B7D3C" }]}>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            </View>
            <Image
              source={{ uri: BURGER_IMG }}
              style={styles.serviceImageBurger}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Taxi Service Card */}
          <TouchableOpacity style={[styles.serviceCard, styles.taxiServiceCard]} activeOpacity={0.8}>
            <View style={styles.serviceTextContainer}>
              <Text style={styles.serviceTitle}>Taxi{"\n"}Service</Text>
              <Text style={styles.serviceSubtitle}>Book a ride{"\n"}anywhere</Text>
              <View style={[styles.serviceArrowCircle, { backgroundColor: "#F5A623" }]}>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            </View>
            <Image
              source={{ uri: CAR_IMG }}
              style={styles.serviceImageTaxi}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Categories Section ── */}
        <Animated.View style={styles.sectionHeader} entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContainer}
          entering={FadeInRight.duration(400).delay(250)}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                activeOpacity={0.7}
                onPress={() => setActiveCategory(cat.name)}
              >
                <View
                  style={[
                    styles.categoryIconCard,
                    isSelected && styles.categoryIconCardActive,
                  ]}
                >
                  {cat.image ? (
                    <Image
                      source={{ uri: cat.image }}
                      style={styles.categoryImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  )}
                </View>
                <Text style={[styles.categoryName, isSelected && styles.categoryNameActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>

        {/* ── Popular Restaurants Section ── */}
        <Animated.View style={styles.sectionHeader} entering={FadeInDown.duration(400).delay(300)}>
          <Text style={styles.sectionTitle}>Popular Restaurants</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.restaurantsScrollContainer}
          entering={FadeInRight.duration(400).delay(350)}
        >
          {POPULAR_RESTAURANTS.map((item) => {
            const isFav = favorites[item.id] || false;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.restaurantCard}
                activeOpacity={0.88}
              >
                <View style={styles.restaurantImageContainer}>
                  <Image
                    source={{ uri: item.image }}
                    style={styles.restaurantImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    activeOpacity={0.8}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <Ionicons
                      name={isFav ? "heart" : "heart-outline"}
                      size={18}
                      color={isFav ? "#EF4444" : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.restaurantTags} numberOfLines={1}>{item.tags}</Text>

                  <View style={styles.restaurantFooter}>
                    <Text style={styles.restaurantMeta}>
                      {item.time} • {item.fee}
                    </Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={13} color="#F5A623" style={{ marginRight: 3 }} />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>

        {/* ── Promo Banner Section ── */}
        <Animated.View style={styles.promoBanner} entering={FadeInDown.duration(400).delay(400)}>
          <Image
            source={{ uri: DELIVERY_SCOOTER_IMG }}
            style={styles.promoImage}
            resizeMode="contain"
          />
          <View style={styles.promoContent}>
            <Text style={styles.promoHeadline}>Get 20% Off</Text>
            <Text style={styles.promoSubtitle}>On your first order</Text>
          </View>
          <TouchableOpacity style={styles.promoButton} activeOpacity={0.8}>
            <Text style={styles.promoButtonText}>Order Now</Text>
            <View style={styles.promoArrowCircle}>
              <Ionicons name="arrow-forward" size={14} color="#1B7D3C" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ─── Safe Area & Scroll ─── */
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* ─── Header ─── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: "#F8F8F8",
  },
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 6,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#F8F8F8",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  /* ─── Search ─── */
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },

  /* ─── Hero Banner ─── */
  heroBanner: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    paddingLeft: 20,
    paddingTop: 18,
    paddingBottom: 30,
    height: 180,
    position: "relative",
    overflow: "hidden",
  },
  heroLeftContent: {
    flex: 1,
    zIndex: 2,
    maxWidth: "60%",
  },
  fastDeliveryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  fastDeliveryText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    marginTop: 8,
  },
  heroSubtitle: {
    color: "#E2E8F0",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  orderNowButton: {
    backgroundColor: "#FFFFFF",
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  orderNowText: {
    color: "#1A1A1A",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 6,
  },
  orderNowArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingLeafTop: {
    position: "absolute",
    top: 18,
    right: 130,
    opacity: 0.7,
    zIndex: 3,
    transform: [{ rotate: "-20deg" }],
  },
  floatingLeafBottom: {
    position: "absolute",
    bottom: 45,
    right: 20,
    opacity: 0.5,
    zIndex: 3,
    transform: [{ rotate: "45deg" }],
  },
  heroImage: {
    width: 155,
    height: 155,
    position: "absolute",
    right: -10,
    top: 10,
    zIndex: 1,
  },
  paginationDots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    marginHorizontal: 3,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },

  /* ─── Services Grid ─── */
  servicesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 12,
  },
  serviceCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 155,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  foodServiceCard: {
    backgroundColor: "#EFFDF4",
  },
  taxiServiceCard: {
    backgroundColor: "#FFFBEB",
  },
  serviceTextContainer: {
    zIndex: 2,
    flex: 1,
    paddingRight: 40,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    lineHeight: 20,
  },
  serviceSubtitle: {
    fontSize: 11,
    color: "#6B6B6B",
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 15,
  },
  serviceArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  serviceImageBurger: {
    width: 90,
    height: 90,
    position: "absolute",
    right: -10,
    bottom: -5,
    zIndex: 1,
  },
  serviceImageTaxi: {
    width: 85,
    height: 60,
    position: "absolute",
    right: -5,
    bottom: 5,
    zIndex: 1,
  },

  /* ─── Section Headers ─── */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1B7D3C",
  },

  /* ─── Categories ─── */
  categoriesScrollContainer: {
    paddingBottom: 4,
  },
  categoryItem: {
    alignItems: "center",
    marginRight: 18,
    width: 64,
  },
  categoryIconCard: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIconCardActive: {
    borderColor: "#1B7D3C",
    borderWidth: 2,
    backgroundColor: "#EFFDF4",
  },
  categoryImage: {
    width: 38,
    height: 38,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A1A",
    marginTop: 6,
    textAlign: "center",
  },
  categoryNameActive: {
    color: "#1B7D3C",
    fontWeight: "700",
  },

  /* ─── Restaurants ─── */
  restaurantsScrollContainer: {
    paddingBottom: 6,
  },
  restaurantCard: {
    width: 220,
    marginRight: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  restaurantImageContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantInfo: {
    padding: 12,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  restaurantTags: {
    fontSize: 11,
    color: "#6B6B6B",
    marginTop: 3,
  },
  restaurantFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  restaurantMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A1A1A",
  },

  /* ─── Promo Banner ─── */
  promoBanner: {
    marginTop: 24,
    marginBottom: 10,
    backgroundColor: "#EFFDF4",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  promoImage: {
    width: 70,
    height: 65,
  },
  promoContent: {
    flex: 1,
    marginLeft: 10,
  },
  promoHeadline: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  promoSubtitle: {
    fontSize: 12,
    color: "#6B6B6B",
    marginTop: 2,
  },
  promoButton: {
    backgroundColor: "#1B7D3C",
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 7,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
  },
  promoButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 6,
  },
  promoArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
