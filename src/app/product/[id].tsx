import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import { getProductById, fetchProductById, Product } from "@/lib/products";
import { useCart } from "@/lib/CartContext";
import { useWishlist } from "@/lib/WishlistContext";
import { ProductDetailSkeleton } from "@/components/SkeletonLoader";

const { width } = Dimensions.get("window");

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, totalItems, totalPrice, cartItems, updateQuantity, removeFromCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | undefined>(() => getProductById(id || "2") || getProductById("2"));
  const [isLoading, setIsLoading] = useState<boolean>(!getProductById(id || "2") && !getProductById("2"));

  React.useEffect(() => {
    let isMounted = true;
    if (id) {
      fetchProductById(id).then((p) => {
        if (isMounted) {
          if (p) setProduct(p);
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [id]);

  const [activeSlide, setActiveSlide] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<any[]>([]);



  if (isLoading && !product) {
    return <ProductDetailSkeleton />;
  }

  if (!product && !isLoading) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const existingCartItem = React.useMemo(() => {
    if (!product) return undefined;
    return cartItems.find((c: any) => 
      c.id === product.id && 
      JSON.stringify(c.selectedVariant || null) === JSON.stringify(selectedVariant || null) &&
      JSON.stringify(c.selectedAddOns || []) === JSON.stringify(selectedAddOns || [])
    );
  }, [cartItems, product, selectedVariant, selectedAddOns]);

  const handleIncrement = () => {
    if (existingCartItem) {
      updateQuantity(product.id, 1);
    } else {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (existingCartItem) {
      if (existingCartItem.quantity > 1) {
        updateQuantity(product.id, -1);
      } else {
        removeFromCart(product.id);
      }
    } else {
      setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
    }
  };

  const handleAddToCart = () => {
    if (product?.variants && product.variants.length > 0 && !selectedVariant) {
      Alert.alert("Selection Required", "Please choose a size/option before adding to cart.");
      return;
    }

    const productPayload = {
      ...product,
      selectedVariant,
      selectedAddOns
    };
    addToCart(productPayload, quantity);
    setToastMessage(`Added ${quantity}x ${product.name} to cart`);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  const basePrice = selectedVariant && typeof selectedVariant.price === 'number' 
    ? selectedVariant.price 
    : product?.price || 0;
  const addOnsTotal = selectedAddOns.reduce((sum, addon) => sum + (addon.price || 0), 0);
  const calculatedTotal = ((basePrice + addOnsTotal) * quantity).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Header Navigation ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => {
              // Share action placeholder / feedback
            }}
          >
            <Ionicons name="share-outline" size={22} color="#1A1A1A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 8 }]}
            activeOpacity={0.7}
            onPress={() => product && toggleWishlist(product)}
          >
            <Ionicons
              name={product && isWishlisted(product.id) ? "heart" : "heart-outline"}
              size={24}
              color={product && isWishlisted(product.id) ? "#EF4444" : "#1A1A1A"}
            />
          </TouchableOpacity>

          {/* Optional Cart Quick Link Badge in Top Right */}
          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 8 }]}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/cart", params: { returnTo: `/product/${product?.id}` } })}
          >
            <Ionicons name="cart-outline" size={24} color="#1A1A1A" />
            {totalItems > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {totalItems > 99 ? "99+" : totalItems}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Smooth Toast Notification Badge ── */}
      {showToast && (
        <Animated.View
          style={styles.toastContainer}
          entering={FadeInDown.duration(300)}
          exiting={FadeOut.duration(300)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: "/cart", params: { returnTo: `/product/${product?.id}` } })}>
            <Text style={styles.toastLink}>View Cart</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Main Content Scroll ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Product Image Carousel ── */}
        {(() => {
          const imageUrls = Array.isArray(product.images) && product.images.length > 0
            ? product.images.filter(Boolean)
            : [product.image_url || product.image].filter(Boolean);
          return (
            <Animated.View
              style={styles.carouselSection}
              entering={FadeInDown.duration(400).delay(50)}
            >
              <View style={styles.imageCard}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const slide = Math.round(
                      e.nativeEvent.contentOffset.x / (width - 40)
                    );
                    setActiveSlide(slide);
                  }}
                  scrollEventThrottle={16}
                >
                  {imageUrls.map((imgUri, idx) => (
                    <View key={idx} style={{ width: width - 40, height: width * 0.82 }}>
                      <Image
                        source={{ uri: imgUri }}
                        style={styles.heroImage}
                        contentFit="cover" cachePolicy="memory-disk" transition={200}
                      />
                    </View>
                  ))}
                </ScrollView>

                {/* ── Pagination Dots Overlay (Bottom Center) ── */}
                {imageUrls.length > 1 && (
                  <View style={styles.paginationDotsOverlay}>
                    {imageUrls.map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          activeSlide === idx ? styles.dotActiveOverlay : styles.dotInactiveOverlay,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })()}

        {/* ── Product Info Badges Row ── */}
        <Animated.View
          style={styles.badgesRow}
          entering={FadeInDown.duration(400).delay(100)}
        >
          <View style={styles.badgeItem}>
            <Ionicons name="star" size={16} color="#F5A623" style={{ marginRight: 6 }} />
            <Text style={styles.badgeTextDark}>{product.rating}</Text>
          </View>

          <View style={styles.badgeSeparator} />

          <View style={styles.badgeItem}>
            <Ionicons name="flame" size={16} color="#F5A623" style={{ marginRight: 6 }} />
            <Text style={styles.badgeTextSecondary}>{product.calories}</Text>
          </View>

          <View style={styles.badgeSeparator} />

          <View style={styles.badgeItem}>
            <Ionicons name="time" size={16} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.badgeTextSecondary}>{product.deliveryTime}</Text>
          </View>
        </Animated.View>

        {/* ── Title & Quantity Selector ── */}
        <Animated.View
          style={styles.titleRow}
          entering={FadeInDown.duration(400).delay(150)}
        >
          <View style={styles.titleWrap}>
            <Text style={styles.productTitle}>{product.name}</Text>
          </View>

          {/* Interactive Quantity Counter */}
          {(!product.variants || product.variants.length === 0) && (
            <View style={styles.quantityCounter}>
              <TouchableOpacity
                style={styles.qtyBtnMinus}
                activeOpacity={0.7}
                onPress={handleDecrement}
              >
                <Ionicons name="remove" size={18} color="#1A1A1A" />
              </TouchableOpacity>

              <Text style={styles.qtyCount}>{existingCartItem ? existingCartItem.quantity : quantity}</Text>

              <TouchableOpacity
                style={styles.qtyBtnPlus}
                activeOpacity={0.7}
                onPress={handleIncrement}
              >
                <Ionicons name="add" size={18} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* ── Dynamic Variants Selector ── */}
        {product.variants && product.variants.length > 0 && (
          <Animated.View style={styles.optionsSection} entering={FadeInDown.duration(400).delay(180)}>
            <Text style={styles.sectionTitle}>Choose Option</Text>
            {product.variants.map((variant, idx) => {
              const isSelected = selectedVariant?.name === variant.name;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.variantRow, isSelected && styles.variantRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedVariant(variant)}
                >
                  <Ionicons 
                    name={isSelected ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={isSelected ? "#10B981" : "#9CA3AF"} 
                  />
                  <Text style={[styles.variantName, isSelected && styles.variantNameSelected]}>{variant.name}</Text>
                  <Text style={styles.variantPrice}>${(variant.price || 0).toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* ── Add-Ons / Extras ── */}
        {product.add_ons && product.add_ons.length > 0 && (
          <Animated.View style={styles.optionsSection} entering={FadeInDown.duration(400).delay(190)}>
            <Text style={styles.sectionTitle}>Add Extras</Text>
            {product.add_ons.slice(0, 10).map((addon, idx) => {
              const isSelected = selectedAddOns.some(a => a.name === addon.name);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.addonRow, isSelected && styles.addonRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isSelected) {
                      setSelectedAddOns(prev => prev.filter(a => a.name !== addon.name));
                    } else {
                      setSelectedAddOns(prev => [...prev, addon]);
                    }
                  }}
                >
                  {addon.image && (
                    <Image source={{ uri: addon.image }} style={styles.addonImage} contentFit="cover" cachePolicy="memory-disk" />
                  )}
                  <View style={styles.addonInfo}>
                    <Text style={styles.addonName}>{addon.name}</Text>
                  </View>
                  <View style={styles.addonAction}>
                    <Text style={styles.addonPrice}>
                      {addon.price > 0 ? `+$${addon.price.toFixed(2)}` : "Included"}
                    </Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* ── Description & Read More Expander ── */}
        <Animated.View
          style={styles.descriptionSection}
          entering={FadeInDown.duration(400).delay(200)}
        >
          <Text
            style={styles.descriptionText}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {product.description}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.readMoreWrap}
          >
            <Text style={styles.readMoreLink}>
              {isExpanded ? "Show less" : "Read more..."}
            </Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* FIXED BOTTOM ADD TO CART FOOTER */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity 
          style={{ flex: 1, height: 52, backgroundColor: '#1B7D3C', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }} 
          onPress={existingCartItem ? () => router.push({ pathname: "/cart", params: { returnTo: `/product/${product?.id}` } }) : handleAddToCart}
        >
          <Ionicons name="cart-outline" size={22} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
            {existingCartItem 
              ? `View Cart (${totalItems}) • $${totalPrice.toFixed(2)}` 
              : (product.variants && product.variants.length > 0 && !selectedVariant)
                ? "Select Option"
                : `Add ${(!product.variants || product.variants.length === 0) ? quantity : 1} to Cart • $${Number(calculatedTotal).toFixed(2)}`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: "#6B6B6B",
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: "#1B7D3C",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  headerBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  toastContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 20,
    left: 20,
    right: 20,
    backgroundColor: "#1B7D3C",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginLeft: 10,
  },
  toastLink: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  carouselSection: {
    alignItems: "center",
  },
  imageCard: {
    width: width - 40,
    height: width * 0.82,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#F8F8F8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  paginationDotsOverlay: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dotActiveOverlay: {
    width: 22,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#1B7D3C",
    marginHorizontal: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInactiveOverlay: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    marginHorizontal: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  paginationDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  dot: {
    marginHorizontal: 4,
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1B7D3C",
  },
  dotInactive: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#E2E8F0",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeTextDark: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  badgeTextSecondary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B6B6B",
  },
  badgeSeparator: {
    width: 1,
    height: 18,
    backgroundColor: "#E5E7EB",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 24,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  productTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A1A",
    lineHeight: 30,
  },
  quantityCounter: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  qtyBtnMinus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnPlus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8F8F8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  qtyCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginHorizontal: 16,
  },
  descriptionSection: {
    marginHorizontal: 20,
    marginTop: 18,
  },
  descriptionText: {
    fontSize: 14.5,
    color: "#6B6B6B",
    lineHeight: 22,
  },
  readMoreWrap: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  readMoreLink: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#1A1A1A",
    textDecorationLine: "underline",
  },
  bottomActionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 16,
  },
  priceContainer: {
    justifyContent: "center",
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  addToCartButton: {
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  addToCartButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  optionsSection: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  variantRowSelected: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: "#1B7D3C",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1B7D3C",
  },
  variantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563",
  },
  variantNameSelected: {
    color: "#1B7D3C",
    fontWeight: "700",
  },
  variantPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  addonRowSelected: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  addonImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#E5E7EB",
  },
  addonInfo: {
    flex: 1,
  },
  addonName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  addonAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  addonPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#1B7D3C",
    borderColor: "#1B7D3C",
  },
});
