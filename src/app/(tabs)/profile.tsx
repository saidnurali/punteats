import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  Platform,
  StatusBar,
  DeviceEventEmitter,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { useCart } from "@/lib/CartContext";
import { clearStoredOrders } from "@/lib/ordersStore";
import { useLanguage } from "../../lib/LanguageContext";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

export default function ProfileScreen() {
  const router = useRouter();
  const { clearCart } = useCart();
  const { t, lang, setLang } = useLanguage();

  // ── Profile State ──
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  React.useEffect(() => {
    getCurrentUser().then((p) => {
      if (p) {
        setUserId(p.id);
        setDisplayName(p.full_name || "Customer");
        setPhone(p.phone_number || "+252");
        setEmail("No email linked");
      } else {
        // Fallback for demo / logged-out preview
        setDisplayName("Garowe User");
        setPhone("+252 90 7123456");
        setEmail("garowe.user@punteats.so");
      }
    });
  }, []);

  // ── Settings State ──
  const [pushNotifications, setPushNotifications] = useState(true);

  // ── Modals State ──
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [tempPhone, setTempPhone] = useState(phone);
  const [tempEmail, setTempEmail] = useState(email);


  // Old addresses state and effect removed

  // ── Handlers ──
  const handleOpenEditModal = () => {
    setTempName(displayName);
    setTempPhone(phone);
    setTempEmail(email);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!tempName.trim() || !tempPhone.trim()) {
      Alert.alert(t("error"), "Please enter your full name and +252 phone number.");
      return;
    }

    // Persist to the real profiles table — a local-only save was silently
    // lost on restart and never reflected in anything else that reads
    // this profile (orders, checkout, etc).
    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: tempName.trim(),
          phone_number: tempPhone.trim(),
        })
        .eq('id', userId);

      if (error) {
        Alert.alert(t("error"), "Failed to save profile changes. Please try again.");
        return;
      }
    }

    setDisplayName(tempName.trim());
    setPhone(tempPhone.trim());
    setEmail(tempEmail.trim());

    setEditModalVisible(false);
    Alert.alert(t("profile_updated"), t("profile_saved"));
  };

  const handleAvatarPress = () => {
    Alert.alert(
      "Update Profile Photo",
      "Choose a profile picture from your device:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take Photo",
          onPress: () => {
            // Simulated camera capture for Garowe User
            setAvatarUri("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80");
          },
        },
        {
          text: "Choose from Library",
          onPress: () => {
            setAvatarUri("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80");
          },
        },
        ...(avatarUri
          ? [
              {
                text: "Remove Photo",
                style: "destructive" as const,
                onPress: () => setAvatarUri(null),
              },
            ]
          : []),
      ]
    );
  };

  const handleLanguageSelect = () => {
    Alert.alert(
      t("select_language"),
      t("choose_language"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("english"),
          onPress: () => setLang("en"),
        },
        {
          text: t("somali"),
          onPress: () => setLang("so"),
        },
      ]
    );
  };



  const handlePrivacyPolicy = () => {
    Linking.openURL('https://punteats.so/privacy').catch(() => {
      Alert.alert("Error", "Could not open Privacy Policy.");
    });
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://punteats.so/terms').catch(() => {
      Alert.alert("Error", "Could not open Terms of Service.");
    });
  };

  const handleSupport = () => {
    Alert.alert(
      "PuntEats Support 📞",
      "Need help with your order or parcel delivery in Garowe?\n\n• Customer Care: +252 90 7123456\n• Email: support@punteats.so\n• Version: v1.0.0",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Support",
          onPress: () => {
            if (Platform.OS !== "web") {
              Linking.openURL('tel:+252907123456').catch(() => {});
            }
          },
        }
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('@puntgo_cart_v2'); // Forcefully clear cart memory immediately
      await clearStoredOrders();
      await supabase.auth.signOut();
      clearCart();
      if (router.canDismiss()) router.dismissAll();
      router.replace("/(home)/login");
    } catch {
      await AsyncStorage.removeItem('@puntgo_cart_v2');
      await clearStoredOrders();
      clearCart();
      DeviceEventEmitter.emit('AUTH_STATE_CHANGED', false);
      if (router.canDismiss()) router.dismissAll();
      router.replace("/(home)/login");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("delete_confirm_title"),
      t("delete_confirm_msg"),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("yes_delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { data, error } = await supabase.functions.invoke('delete-user-account');

              if (error) {
                console.error("Account deletion error:", error);
                Alert.alert("Error", "Failed to delete account. Please try again or contact support.");
                return;
              }

              // Proceed with local cleanup only after successful server deletion
              await supabase.auth.signOut();
              clearCart();
              if (router.canDismiss()) router.dismissAll();
              router.replace("/(home)/login");
            } catch (err) {
              console.error("Account deletion crash:", err);
              Alert.alert("Error", "An unexpected error occurred while deleting your account.");
            }
          },
        },
      ]
    );
  };

  return (
    <Animated.View style={{ flex: 1 }} entering={FadeInDown.duration(400)}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

      {/* TOP HEADER */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t("my_profile")}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. PROFILE HEADER SECTION */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.85}
            onPress={handleAvatarPress}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={46} color="#1B7D3C" />
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.displayName}>{displayName || " "}</Text>
          <Text style={styles.phoneNumber}>{phone}</Text>

          <TouchableOpacity
            style={styles.quickEditBtn}
            activeOpacity={0.85}
            onPress={handleOpenEditModal}
          >
            <Ionicons name="create-outline" size={16} color="#1B7D3C" style={{ marginRight: 6 }} />
            <Text style={styles.quickEditBtnText}>{t("edit_profile")}</Text>
          </TouchableOpacity>
        </View>

        {/* 2. ACCOUNT MANAGEMENT & OPTIONS LIST */}
        <Text style={styles.sectionTitle}>{t("account_settings")}</Text>

        <View style={styles.menuListCard}>
          {/* Saved Delivery Addresses */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => router.push("/saved-addresses")}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#EFFDF4" }]}>
                <Ionicons name="location-outline" size={22} color="#1B7D3C" />
              </View>
              <Text style={styles.menuRowLabel}>{t("saved_addresses")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Notifications Toggle */}
          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="notifications-outline" size={22} color="#F5A623" />
              </View>
              <View>
                <Text style={styles.menuRowLabel}>{t("notifications")}</Text>
                <Text style={styles.menuRowSub}>{t("order_alerts")}</Text>
              </View>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: "#D1D5DB", true: "#1B7D3C" }}
              thumbColor={Platform.OS === "ios" ? "#FFFFFF" : pushNotifications ? "#FFFFFF" : "#F3F4F6"}
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Saved Addresses */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => router.push("/saved-addresses" as any)}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="location-outline" size={22} color="#EF4444" />
              </View>
              <Text style={styles.menuRowLabel}>Saved Delivery Addresses</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Parcel Deliveries */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => router.push("/parcel/history" as any)}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="cube-outline" size={22} color="#F5A623" />
              </View>
              <Text style={styles.menuRowLabel}>Parcel Deliveries</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* PuntGo Rewards (Loyalty) */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert("PuntGo Rewards", "You have 450 points! (Mock)")}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#FEF9C3" }]}>
                <Ionicons name="star" size={22} color="#EAB308" />
              </View>
              <View>
                <Text style={styles.menuRowLabel}>PuntGo Rewards</Text>
                <Text style={styles.menuRowSub}>450 Points available</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Refer & Earn */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert("Refer & Earn", "Share your code: PUNTGO25")}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#ECFEFF" }]}>
                <Ionicons name="gift-outline" size={22} color="#06B6D4" />
              </View>
              <Text style={styles.menuRowLabel}>Refer & Earn</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Language Preference */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleLanguageSelect}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="globe-outline" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.menuRowLabel}>{t("language_preference")}</Text>
            </View>
            <View style={styles.menuRowRight}>
              <Text style={styles.languageBadgeText}>{lang === "so" ? "Soomaali" : "English"}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handlePrivacyPolicy}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#9333EA" />
              </View>
              <Text style={styles.menuRowLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleTermsOfService}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#F1F5F9" }]}>
                <Ionicons name="document-text-outline" size={22} color="#475569" />
              </View>
              <Text style={styles.menuRowLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Customer Support */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleSupport}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="help-circle-outline" size={22} color="#1B7D3C" />
              </View>
              <Text style={styles.menuRowLabel}>Customer Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* 3. LOG OUT ACTION */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.88}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" style={{ marginRight: 10 }} />
          <Text style={styles.logoutBtnText}>{t("log_out")}</Text>
        </TouchableOpacity>

        {/* 4. DELETE ACCOUNT (DANGER ZONE) */}
        <View style={styles.dangerZoneWrap}>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            activeOpacity={0.88}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={19} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.deleteAccountBtnText}>{t("delete_account")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerVersionText}>{t("version")}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("edit_profile")}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{t("full_name")}</Text>
            <TextInput style={styles.textInput} value={tempName} onChangeText={setTempName} placeholder="E.g. Ali Ahmed" placeholderTextColor="#9CA3AF" />

            <Text style={styles.inputLabel}>{t("phone_number")}</Text>
            <TextInput style={styles.textInput} value={tempPhone} onChangeText={setTempPhone} placeholder="+252 90 7000000" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />

            <Text style={styles.inputLabel}>{t("email_address")}</Text>
            <TextInput style={styles.textInput} value={tempEmail} onChangeText={setTempEmail} placeholder="ali@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveProfile}>
                <Text style={styles.modalSaveBtnText}>{t("save_changes")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Address manager moved to saved-addresses.tsx */}
    </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  /* 1. Profile Header Card */
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 14,
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#EFFDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#1B7D3C",
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2.5,
    borderColor: "#1B7D3C",
  },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1B7D3C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  phoneNumber: {
    fontSize: 15,
    color: "#6B6B6B",
    marginTop: 4,
    marginBottom: 16,
  },
  quickEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFFDF4",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  quickEditBtnText: {
    color: "#1B7D3C",
    fontSize: 14.5,
    fontWeight: "700",
  },
  /* 2. Account Settings List */
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
    marginLeft: 4,
  },
  menuListCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 24,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuRowLabel: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  menuRowSub: {
    fontSize: 12,
    color: "#6B6B6B",
    marginTop: 2,
  },
  menuRowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  languageBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B7D3C",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  /* 3. Log Out Action */
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 25,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    marginBottom: 18,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutBtnText: {
    color: "#EF4444",
    fontSize: 16.5,
    fontWeight: "800",
  },
  /* 4. Delete Account Danger Zone */
  dangerZoneWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  deleteAccountBtnText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "700",
  },
  footerVersionText: {
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 10,
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: Platform.OS === "ios" ? 44 : 26,
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
  inputLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#4B5563",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginRight: 10,
  },
  modalCancelBtnText: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "700",
  },
  modalSaveBtn: {
    flex: 1.2,
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
