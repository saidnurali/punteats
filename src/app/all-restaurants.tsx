import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { RestaurantCard, RestaurantItem } from "@/components/RestaurantCard";
import { useWishlist } from "@/lib/WishlistContext";
import { useLanguage } from "@/lib/LanguageContext";
import { getCachedRestaurants, fetchRestaurants } from "@/lib/DataCache";

export default function AllRestaurantsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [restaurants, setRestaurants] = useState<RestaurantItem[]>(() => getCachedRestaurants());
  const [loading, setLoading] = useState(() => getCachedRestaurants().length === 0);

  useEffect(() => {
    const loadAllRestaurants = async () => {
      const cached = getCachedRestaurants();
      if (cached.length > 0) {
        setRestaurants(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      
      // Fetch fresh restaurants data
      const fresh = await fetchRestaurants();
      setRestaurants(fresh);
      setLoading(false);
    };
    loadAllRestaurants();
  }, []);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: "#FFFFFF" }} entering={FadeInDown.duration(300)}>
      <SafeAreaView edges={["top"]} style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("top_restaurants") || "Top Restaurants"}</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => {
          const fav = isWishlisted(`rest_${item.id}`);
          return (
            <View style={styles.cardWrapper}>
              <RestaurantCard
                item={item}
                isFav={fav}
                onToggleWishlist={() =>
                  toggleWishlist({
                    id: `rest_${item.id}`,
                    name: item.name,
                    category: item.tags,
                    price: 0,
                    priceFormatted: "",
                    rating: item.rating,
                    calories: "",
                    deliveryTime: item.time,
                    description: "",
                    image: item.coverImage || (item as any).image_url || item.image,
                    images: [],
                  })
                }
                onPress={() => router.push(`/restaurant/${item.id}`)}
                style={styles.fullWidthCard}
              />
            </View>
          );
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardWrapper: {
    width: "48%",
  },
  fullWidthCard: {
    width: "100%",
    marginRight: 0,
  },
});
