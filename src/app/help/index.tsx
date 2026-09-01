import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  LayoutAnimation,
  UIManager,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Static FAQ Data (fallback when Supabase table doesn't exist yet) ─────────
const STATIC_FAQS = [
  {
    id: "1", category: "General",
    question: "What is PuntGo?",
    answer: "PuntGo is Garowe's premier food delivery and parcel delivery service app, connecting you with the best local restaurants and drivers across Puntland, Somalia.",
  },
  {
    id: "2", category: "Payment",
    question: "How can I make a payment?",
    answer: "We accept EVC Plus, Zaad, Sahal, and Cash on Delivery. Simply select your preferred payment method at checkout.",
  },
  {
    id: "3", category: "Service",
    question: "How do I cancel an order?",
    answer: "You can cancel an order within 2 minutes of placing it by visiting My Orders and tapping 'Cancel Order'. After preparation has started, cancellations are handled by our support team.",
  },
  {
    id: "4", category: "Account",
    question: "How do I delete my account?",
    answer: "Go to Profile → scroll to the bottom → tap 'Delete Account'. This will permanently remove all your data from PuntGo.",
  },
  {
    id: "5", category: "General",
    question: "How do I exit the app?",
    answer: "Simply press the Home button on your device. Your cart and session remain active for your next visit.",
  },
  {
    id: "6", category: "Payment",
    question: "Why did my payment not work?",
    answer: "Ensure your EVC/Zaad/Sahal wallet has sufficient balance and your phone number is correctly entered. If the issue persists, contact our support team.",
  },
  {
    id: "7", category: "Service",
    question: "Why is the delivery fee different?",
    answer: "Each restaurant sets their own delivery fee in PuntGo. Fees vary by restaurant location, distance, and current promotions.",
  },
  {
    id: "8", category: "Account",
    question: "How do I update my profile?",
    answer: "Tap Profile → Edit Profile icon → Update your name, phone, or email → Save Changes.",
  },
];

const CATEGORIES = ["General", "Account", "Service", "Payment"];

// ─── FAQ Accordion Card ───────────────────────────────────────────────────────
const FAQCard = React.memo(({ item }: { item: typeof STATIC_FAQS[0] }) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  return (
    <TouchableOpacity
      style={[styles.faqCard, expanded && styles.faqCardExpanded]}
      activeOpacity={0.8}
      onPress={toggle}
    >
      <View style={styles.faqRow}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#1B7D3C"
        />
      </View>
      {expanded && (
        <Text style={styles.faqAnswer}>{item.answer}</Text>
      )}
    </TouchableOpacity>
  );
});

// ─── Contact Us Item ─────────────────────────────────────────────────────────
const ContactItem = ({
  icon,
  iconBg,
  iconColor,
  label,
  onPress,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.contactCard} activeOpacity={0.75} onPress={onPress}>
    <View style={[styles.contactIconWrap, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={24} color={iconColor} />
    </View>
    <Text style={styles.contactLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
  </TouchableOpacity>
);

// ─── Main HelpCenterScreen ────────────────────────────────────────────────────
export default function HelpCenterScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"faq" | "contact">("faq");
  const [activeCategory, setActiveCategory] = useState("General");
  const [searchQuery, setSearchQuery] = useState("");
  const [faqs, setFaqs] = useState(STATIC_FAQS);

  // Try to load from Supabase; fall back to static if table doesn't exist
  useEffect(() => {
    supabase
      .from("faqs")
      .select("*")
      .then(({ data }) => {
        if (data && data.length > 0) setFaqs(data as any);
      })
      .catch(() => {});
  }, []);

  const filteredFaqs = faqs.filter(f => {
    const matchesCategory = f.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "faq" && styles.tabActive]}
          onPress={() => setActiveTab("faq")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "faq" && styles.tabTextActive]}>
            FAQ
          </Text>
          {activeTab === "faq" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "contact" && styles.tabActive]}
          onPress={() => setActiveTab("contact")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "contact" && styles.tabTextActive]}>
            Contact us
          </Text>
          {activeTab === "contact" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* ── Tab Content ── */}
      {activeTab === "faq" ? (
        /* ── FAQ Tab ── */
        <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1 }}>
          {/* Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, activeCategory === cat && styles.chipActive]}
                activeOpacity={0.75}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search Box */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.filterIcon}>
              <Ionicons name="options-outline" size={20} color="#1B7D3C" />
            </TouchableOpacity>
          </View>

          {/* FAQ List */}
          <ScrollView
            contentContainerStyle={styles.faqListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredFaqs.length === 0 ? (
              <View style={styles.emptyFaq}>
                <Ionicons name="help-circle-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyFaqText}>No results for "{searchQuery}"</Text>
              </View>
            ) : (
              filteredFaqs.map((item, i) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.duration(250).delay(i * 40)}
                >
                  <FAQCard item={item} />
                </Animated.View>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      ) : (
        /* ── Contact Us Tab ── */
        <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.contactListContent}
            showsVerticalScrollIndicator={false}
          >
            <ContactItem
              icon="headset-outline"
              iconBg="#E8F5EE"
              iconColor="#1B7D3C"
              label="Customer Service"
              onPress={() => router.push("/help/chat" as any)}
            />
            <ContactItem
              icon="logo-whatsapp"
              iconBg="#DCFCE7"
              iconColor="#25D366"
              label="WhatsApp"
              onPress={() => openLink("https://wa.me/252907123456")}
            />
            <ContactItem
              icon="globe-outline"
              iconBg="#EFF6FF"
              iconColor="#3B82F6"
              label="Website"
              onPress={() => openLink("https://punteats.so")}
            />
            <ContactItem
              icon="logo-facebook"
              iconBg="#EFF6FF"
              iconColor="#1877F2"
              label="Facebook"
              onPress={() => openLink("https://facebook.com/punteats")}
            />
            <ContactItem
              icon="logo-twitter"
              iconBg="#F0F9FF"
              iconColor="#1DA1F2"
              label="Twitter"
              onPress={() => openLink("https://twitter.com/punteats")}
            />
            <ContactItem
              icon="logo-instagram"
              iconBg="#FFF0F5"
              iconColor="#E1306C"
              label="Instagram"
              onPress={() => openLink("https://instagram.com/punteats")}
            />
          </ScrollView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },

  // Tabs
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginHorizontal: 18,
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 12,
    position: "relative",
  },
  tabActive: {},
  tabText: { fontSize: 15, fontWeight: "500", color: "#9CA3AF" },
  tabTextActive: { color: "#1B7D3C", fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: -1,
    left: "15%",
    right: "15%",
    height: 3,
    backgroundColor: "#1B7D3C",
    borderRadius: 2,
  },

  // Category Chips
  chipsRow: { paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  chipActive: { backgroundColor: "#1B7D3C" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#6B6B6B" },
  chipTextActive: { color: "#FFFFFF" },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1A1A1A", paddingVertical: 0 },
  filterIcon: {
    width: 40, height: 40,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  // FAQ List
  faqListContent: { paddingHorizontal: 18, paddingTop: 4 },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  faqCardExpanded: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
    flex: 1,
    paddingRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#D1FAE5",
  },

  // Empty FAQ
  emptyFaq: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyFaqText: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  // Contact
  contactListContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 12,
    paddingBottom: 60,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 16,
  },
  contactIconWrap: {
    width: 48, height: 48,
    borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  contactLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
});
