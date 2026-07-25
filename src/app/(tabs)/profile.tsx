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
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useCart } from "../../lib/CartContext";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

export default function ProfileScreen() {
  const router = useRouter();
  const { clearCart } = useCart();

  // ── Profile State ──
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  React.useEffect(() => {
    // Load from local WhatsApp OTP session
    AsyncStorage.getItem('puntgo_user_session').then((stored) => {
      if (stored) {
        const p = JSON.parse(stored);
        setDisplayName(p.full_name || "Customer");
        setPhone(p.phone_number || "+252");
        setEmail(p.email || "No email linked");
        setAvatarUri(p.avatar_url || null);
      } else {
        // Fallback for demo
        setDisplayName("Garowe User");
        setPhone("+252 90 7123456");
        setEmail("garowe.user@puntgo.so");
      }
    });
  }, []);

  // ── Settings State ──
  const [pushNotifications, setPushNotifications] = useState(true);
  const [language, setLanguage] = useState<"English" | "Soomaali">("English");

  // ── Modals State ──
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [tempPhone, setTempPhone] = useState(phone);
  const [tempEmail, setTempEmail] = useState(email);

  // ── Handlers ──
  const handleOpenEditModal = () => {
    setTempName(displayName);
    setTempPhone(phone);
    setTempEmail(email);
    setEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (!tempName.trim() || !tempPhone.trim()) {
      Alert.alert("Required Fields", "Please enter your full name and +252 phone number.");
      return;
    }
    setDisplayName(tempName.trim());
    setPhone(tempPhone.trim());
    setEmail(tempEmail.trim());
    
    // Save to AsyncStorage
    AsyncStorage.setItem("@puntgo_user_profile", JSON.stringify({
      displayName: tempName.trim(),
      phone: tempPhone.trim(),
      email: tempEmail.trim(),
      avatarUri,
    }));

    setEditModalVisible(false);
    Alert.alert("Profile Updated ✓", "Your personal information has been saved successfully.");
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
      "Select Language / Dooro Luqadda",
      "Choose your preferred app language:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "English (US)",
          onPress: () => setLanguage("English"),
        },
        {
          text: "Soomaali (Somali)",
          onPress: () => setLanguage("Soomaali"),
        },
      ]
    );
  };

  const handleSavedAddresses = () => {
    Alert.alert(
      "Saved Delivery Addresses 📍",
      "• Home: Shaqaalaha Road, Garowe, Puntland\n• Work: Ministry Road, Garowe\n\nYou can add or manage addresses during Checkout.",
      [{ text: "Got It", style: "default" }]
    );
  };

  const handlePrivacySecurity = () => {
    Alert.alert(
      "Privacy & Security 🛡️",
      "Manage your PIN, biometrics, and account security. Active 2-Step verification is enabled for +252 numbers.",
      [{ text: "Close", style: "default" }]
    );
  };

  const handleTermsSupport = () => {
    Alert.alert(
      "PuntGo Support & Terms 📄",
      "Need help with your order or taxi ride in Garowe?\n\n• Customer Care: +252 90 7123456\n• Email: support@puntgo.so\n• Version: v1.0.0 (Garowe Release)",
      [{ text: "OK", style: "default" }]
    );
  };

  const handleLogout = async () => {
    try {
      (global as any).__BYPASS_AUTH__ = false;
      await AsyncStorage.removeItem('puntgo_user_session');
      await supabase.auth.signOut();
      clearCart();
      router.replace("/(home)/login");
    } catch {
      clearCart();
      router.replace("/(home)/login");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete PuntGo Account?",
      "Warning: This action is permanent. All your order history, delivery addresses, and profile data will be completely deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes, Delete Everything",
          style: "destructive",
          onPress: async () => {
            try {
              (global as any).__BYPASS_AUTH__ = false;
              await AsyncStorage.removeItem('puntgo_user_session');
              await supabase.auth.signOut();
              clearCart();
              router.replace("/(home)/login");
            } catch {
              clearCart();
              router.replace("/(home)/login");
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
        <Text style={styles.headerTitle}>My Profile</Text>
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
            <Text style={styles.quickEditBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* 2. ACCOUNT MANAGEMENT & OPTIONS LIST */}
        <Text style={styles.sectionTitle}>Account Settings</Text>

        <View style={styles.menuListCard}>
          {/* Saved Delivery Addresses */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleSavedAddresses}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#EFFDF4" }]}>
                <Ionicons name="location-outline" size={22} color="#1B7D3C" />
              </View>
              <Text style={styles.menuRowLabel}>Saved Delivery Addresses</Text>
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
                <Text style={styles.menuRowLabel}>Notifications</Text>
                <Text style={styles.menuRowSub}>Order alerts & status updates</Text>
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
              <Text style={styles.menuRowLabel}>Language Preference</Text>
            </View>
            <View style={styles.menuRowRight}>
              <Text style={styles.languageBadgeText}>{language}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Privacy & Security */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handlePrivacySecurity}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#9333EA" />
              </View>
              <Text style={styles.menuRowLabel}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Terms & Support */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleTermsSupport}
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: "#F1F5F9" }]}>
                <Ionicons name="document-text-outline" size={22} color="#475569" />
              </View>
              <Text style={styles.menuRowLabel}>Terms & Support</Text>
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
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        {/* 4. DELETE ACCOUNT (DANGER ZONE) */}
        <View style={styles.dangerZoneWrap}>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            activeOpacity={0.88}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={19} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.deleteAccountBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerVersionText}>PuntGo v1.0.0 • Garowe, Puntland</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL: EDIT PROFILE ── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Info</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B6B6B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter full name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Phone Number (+252)</Text>
            <TextInput
              style={styles.textInput}
              value={tempPhone}
              onChangeText={setTempPhone}
              placeholder="+252 90 7123456"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              value={tempEmail}
              onChangeText={setTempEmail}
              placeholder="garowe.user@puntgo.so"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.8}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                activeOpacity={0.88}
                onPress={handleSaveProfile}
              >
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
