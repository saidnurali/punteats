import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

export interface RestaurantItem {
  id: string;
  name: string;
  tags: string;
  time: string;
  fee: string;
  rating: string;
  image: string;
  coverImage?: string;
  logoImage?: string;
  emoji?: string;
  status?: string;
}

interface RestaurantCardProps {
  item: RestaurantItem;
  isFav: boolean;
  onToggleWishlist: () => void;
  onPress?: () => void;
}

const DEFAULT_COVER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80";

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  item,
  isFav,
  onToggleWishlist,
  onPress,
}) => {
  const coverUri = item.coverImage || item.image || DEFAULT_COVER;
  const logoStr = item.logoImage || item.emoji || "🏪";
  const isLogoUrl = logoStr.startsWith("http://") || logoStr.startsWith("https://") || logoStr.startsWith("data:image/");

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.imgWrap}>
        <Image
          source={{ uri: coverUri }}
          style={styles.coverImg}
          contentFit="cover" cachePolicy="memory-disk" transition={200}
        />

        {/* ── Logo Badge Overlay (Top Left) ── */}
        <View style={styles.logoBadge}>
          {isLogoUrl ? (
            <Image
              source={{ uri: logoStr }}
              style={styles.logoImg}
              contentFit="cover" cachePolicy="memory-disk" transition={200}
            />
          ) : (
            <Text style={styles.logoEmoji}>{logoStr}</Text>
          )}
        </View>

        {/* ── Wishlist Button (Top Right) ── */}
        <TouchableOpacity
          style={styles.heartBtn}
          activeOpacity={0.7}
          onPress={onToggleWishlist}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={17}
            color={isFav ? "#EF4444" : "#FFFFFF"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.tags} numberOfLines={1}>
          {item.tags}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.meta}>
            {item.time} • {item.fee}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons
              name="star"
              size={12}
              color="#F5A623"
              style={{ marginRight: 3 }}
            />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 235,
    marginRight: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imgWrap: {
    width: "100%",
    aspectRatio: 16 / 9.5,
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  coverImg: {
    width: "100%",
    height: "100%",
  },
  logoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  logoImg: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  logoEmoji: {
    fontSize: 18,
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.2,
  },
  tags: {
    fontSize: 12.5,
    color: "#6B6B6B",
    marginTop: 3,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 9,
  },
  meta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1B7D3C",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1A1A1A",
  },
});
