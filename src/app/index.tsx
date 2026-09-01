import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_SEEN_KEY = "punteats_has_seen_onboarding";

const ONBOARDING_SLIDES = [
  {
    id: "1",
    titleLine1: "Delicious food,",
    titleLine2: "Delivered fast",
    title2Color: "#1B7D3C",
    subtitle: "From your favorite restaurants\nto your doorstep.",
    image: require("../../assets/images/onboarding2.png"),
  },
  {
    id: "2",
    titleLine1: "Your everyday,",
    titleLine2: "Everything.",
    title2Color: "#1B7D3C",
    subtitle: "Food, groceries, or a ride\nwe've got you covered.",
    image: require("../../assets/images/onboarding1.png"),
  },
  {
    id: "3",
    titleLine1: "Ride Anywhere",
    titleLine2: "Anytime",
    title2Color: "#1B7D3C",
    subtitle: "Book a ride and get there\nsafely.",
    image: require("../../assets/images/onboarding3.png"),
  },
];

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  // null = still checking AsyncStorage, false = show onboarding
  const [hasChecked, setHasChecked] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isSmallScreen = height < 700;
  const imageSize = Math.min(width * 0.80, height * 0.36);

  // ── First-launch guard ──────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((value) => {
        if (value === "true") {
          // Already seen — skip to login immediately (no flash)
          router.replace("/(home)");
        } else {
          // First launch — show onboarding
          setHasChecked(true);
        }
      })
      .catch(() => {
        // On error, just show onboarding
        setHasChecked(true);
      });
  }, []);

  // Called by Next button — scroll to next slide
  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < ONBOARDING_SLIDES.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      handleFinish();
    }
  };

  // Skip or Get Started both navigate to home — mark seen first
  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    } catch {}
    router.replace("/(home)");
  };

  // Track current visible slide when user swipes manually
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  const renderSlide = ({ item }: { item: (typeof ONBOARDING_SLIDES)[0] }) => (
    <View style={[styles.slide, { width }]}>
      {/* Text Header */}
      <View style={[styles.headerSection, { marginTop: isSmallScreen ? 12 : 28 }]}>
        <Text style={styles.titleLine1} allowFontScaling={true}>
          {item.titleLine1}
        </Text>
        <Text
          style={[styles.titleLine2, { color: item.title2Color }]}
          allowFontScaling={true}
        >
          {item.titleLine2}
        </Text>
        <Text
          style={[styles.subtitle, { marginTop: isSmallScreen ? 8 : 12 }]}
          allowFontScaling={true}
        >
          {item.subtitle}
        </Text>
      </View>

      {/* Illustration */}
      <View style={styles.illustrationSection}>
        <Image
          source={item.image}
          style={{ width: imageSize, height: imageSize, backgroundColor: "transparent" }}
          resizeMode="contain"
        />
      </View>
    </View>
  );

  // Don't render anything while checking storage — prevents white flash then redirect
  if (!hasChecked) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        // Fix getItemLayout so scrollToIndex works reliably
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Pagination Dots */}
      <View style={[styles.pagination, { marginBottom: isSmallScreen ? 14 : 20 }]}>
        {ONBOARDING_SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>

      {/* Bottom Buttons */}
      <View style={[styles.bottomSection, { marginBottom: isSmallScreen ? 8 : 18 }]}>
        {/* Primary button: "Next" on slides 1-2, "Get Started" on slide 3 */}
        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.85}
          onPress={isLastSlide ? handleFinish : handleNext}
        >
          <Text style={styles.nextButtonText} allowFontScaling={true}>
            {isLastSlide ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>

        {/* Skip always visible on all slides */}
        <TouchableOpacity
          style={styles.skipButton}
          activeOpacity={0.6}
          onPress={handleFinish}
        >
          <Text style={styles.skipButtonText} allowFontScaling={true}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  headerSection: {
    alignItems: "center",
  },
  titleLine1: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 36,
  },
  titleLine2: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 36,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "400",
  },
  illustrationSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    borderRadius: 5,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    height: 8,
    backgroundColor: "#1B7D3C",
    borderRadius: 4,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    backgroundColor: "#D9D9D9",
    borderRadius: 4,
  },
  bottomSection: {
    width: "100%",
    paddingHorizontal: 28,
  },
  nextButton: {
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 52,
    shadowColor: "#1B7D3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  skipButtonText: {
    color: "#6B6B6B",
    fontSize: 15,
    fontWeight: "500",
  },
});
