import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
type AddressLabel = "Home" | "Office" | "Other";

interface SavedAddress {
  id: string;
  user_id: string;
  label: AddressLabel;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
  created_at: string;
}

interface AddressForm {
  label: AddressLabel;
  address: string;
  latitude: string;
  longitude: string;
}

const LABEL_ICONS: Record<AddressLabel, string> = {
  Home: "home",
  Office: "business",
  Other: "location",
};

const LABEL_COLORS: Record<AddressLabel, string> = {
  Home: "#1B7D3C",
  Office: "#2563EB",
  Other: "#F5A623",
};

const LABEL_BG: Record<AddressLabel, string> = {
  Home: "#F0FDF4",
  Office: "#EFF6FF",
  Other: "#FEF9EE",
};

const EMPTY_FORM: AddressForm = {
  label: "Home",
  address: "",
  latitude: "",
  longitude: "",
};

// ─── Address Card ─────────────────────────────────────────────────────────────
const AddressCard = React.memo(({
  item,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  item: SavedAddress;
  onSetDefault: (id: string) => void;
  onEdit: (item: SavedAddress) => void;
  onDelete: (item: SavedAddress) => void;
}) => {
  const icon = LABEL_ICONS[item.label] || "location";
  const color = LABEL_COLORS[item.label] || "#1B7D3C";
  const bg = LABEL_BG[item.label] || "#F0FDF4";

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
      {/* Icon + Address Info */}
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.labelRow}>
            <Text style={styles.addressLabel}>{item.label}</Text>
            {item.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text style={styles.addressText} numberOfLines={2}>
            {item.address}
          </Text>
        </View>
      </View>

      {/* Action Row */}
      <View style={styles.cardDivider} />
      <View style={styles.cardActions}>
        {!item.is_default && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onSetDefault(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="star-outline" size={16} color="#1B7D3C" />
            <Text style={styles.actionBtnText}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onEdit(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={16} color="#4B5563" />
          <Text style={[styles.actionBtnText, { color: "#4B5563" }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onDelete(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SavedAddressesScreen() {
  const router = useRouter();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ── Get User Session ─────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("puntgo_user_session").then(raw => {
      if (raw) {
        const s = JSON.parse(raw);
        setUserId(s.id ?? null);
      }
    });
  }, []);

  // ── Fetch Addresses ───────────────────────────────────────────────────────
  const fetchAddresses = useCallback(async (uid?: string) => {
    const id = uid || userId;
    if (!id) { setLoading(false); return; }

    try {
      const { data, error } = await supabase
        .from("saved_addresses")
        .select("*")
        .eq("user_id", id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (!error && data) setAddresses(data as SavedAddress[]);
    } catch (_) {}
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) fetchAddresses(userId);
  }, [userId]);

  // ── Set Default ───────────────────────────────────────────────────────────
  const handleSetDefault = useCallback(async (id: string) => {
    if (!userId) return;
    // Optimistic update
    setAddresses(prev =>
      prev.map(a => ({ ...a, is_default: a.id === id }))
    );
    try {
      await supabase
        .from("saved_addresses")
        .update({ is_default: false })
        .eq("user_id", userId);
      await supabase
        .from("saved_addresses")
        .update({ is_default: true })
        .eq("id", id);
      // Persist to home screen local cache
      const addr = addresses.find(a => a.id === id);
      if (addr) {
        await AsyncStorage.setItem(
          "@puntgo_saved_addresses",
          JSON.stringify({ activeId: id, label: addr.label, address: addr.address })
        );
      }
    } catch (_) {
      // Revert on error
      fetchAddresses();
    }
  }, [userId, addresses, fetchAddresses]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((item: SavedAddress) => {
    Alert.alert(
      "Delete Address",
      `Delete "${item.label}" address?${item.is_default ? "\n\nThis is your default address. Another address will be set as default." : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setAddresses(prev => prev.filter(a => a.id !== item.id));
            try {
              await supabase.from("saved_addresses").delete().eq("id", item.id);
              // If deleted was default, set next one as default
              if (item.is_default && addresses.length > 1) {
                const next = addresses.find(a => a.id !== item.id);
                if (next) {
                  await supabase
                    .from("saved_addresses")
                    .update({ is_default: true })
                    .eq("id", next.id);
                  setAddresses(prev =>
                    prev.map(a => ({ ...a, is_default: a.id === next.id }))
                  );
                }
              }
            } catch (_) {
              fetchAddresses();
            }
          },
        },
      ]
    );
  }, [addresses, fetchAddresses]);

  // ── Open Add / Edit Modal ─────────────────────────────────────────────────
  const openAdd = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((item: SavedAddress) => {
    setEditingId(item.id);
    setForm({
      label: item.label,
      address: item.address,
      latitude: item.latitude ? String(item.latitude) : "",
      longitude: item.longitude ? String(item.longitude) : "",
    });
    setFormError("");
    setModalVisible(true);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.address.trim()) {
      setFormError("Please enter an address.");
      return;
    }
    if (!userId) return;

    // Check for duplicates
    const isDuplicate = addresses.some(
      a => a.address.trim().toLowerCase() === form.address.trim().toLowerCase() && a.id !== editingId
    );
    if (isDuplicate) {
      setFormError("This address is already saved.");
      return;
    }

    setFormError("");
    setSaving(true);

    const payload = {
      user_id: userId,
      label: form.label,
      address: form.address.trim(),
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      is_default: addresses.length === 0 && !editingId, // first address = default
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("saved_addresses")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        setAddresses(prev =>
          prev.map(a =>
            a.id === editingId ? { ...a, ...payload } : a
          )
        );
      } else {
        const { data, error } = await supabase
          .from("saved_addresses")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setAddresses(prev => [...prev, data as SavedAddress]);
      }
      setModalVisible(false);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [form, userId, editingId, addresses.length]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity
          style={[styles.headerBtn, styles.addIconBtn]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={24} color="#1B7D3C" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B7D3C" />
        </View>
      ) : addresses.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location-outline" size={52} color="#1B7D3C" />
          </View>
          <Text style={styles.emptyTitle}>No Saved Addresses</Text>
          <Text style={styles.emptySubtitle}>
            Add your home, office, or other delivery locations for faster checkout.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={openAdd}
            activeOpacity={0.88}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Add New Address</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AddressCard
              item={item}
              onSetDefault={handleSetDefault}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addNewBtn}
              onPress={openAdd}
              activeOpacity={0.88}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>+ Add New Address</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>
              {editingId ? "Edit Address" : "Add New Address"}
            </Text>

            {/* Label Selector */}
            <Text style={styles.fieldLabel}>Label</Text>
            <View style={styles.labelRow2}>
              {(["Home", "Office", "Other"] as AddressLabel[]).map(lbl => (
                <TouchableOpacity
                  key={lbl}
                  style={[
                    styles.labelChip,
                    form.label === lbl && styles.labelChipActive,
                  ]}
                  onPress={() => setForm(f => ({ ...f, label: lbl }))}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.labelChipText,
                      form.label === lbl && styles.labelChipTextActive,
                    ]}
                  >
                    {lbl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Address Text */}
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={styles.textInput}
              placeholder="House no, Street, Area, City, State"
              placeholderTextColor="#9CA3AF"
              value={form.address}
              onChangeText={t => setForm(f => ({ ...f, address: t }))}
              multiline
              numberOfLines={2}
            />

            {/* Coordinates */}
            <Text style={styles.fieldLabel}>Coordinates (Optional)</Text>
            <View style={styles.coordRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Latitude"
                placeholderTextColor="#9CA3AF"
                value={form.latitude}
                onChangeText={t => setForm(f => ({ ...f, latitude: t }))}
                keyboardType="decimal-pad"
              />
              <View style={{ width: 10 }} />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Longitude"
                placeholderTextColor="#9CA3AF"
                value={form.longitude}
                onChangeText={t => setForm(f => ({ ...f, longitude: t }))}
                keyboardType="decimal-pad"
              />
            </View>

            {formError ? (
              <Text style={styles.errorText}>{formError}</Text>
            ) : null}

            {/* Save */}
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Save Address</Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  addIconBtn: { backgroundColor: "#F0FDF4" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: "#F0FDF4",
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14, color: "#6B6B6B",
    textAlign: "center", lineHeight: 22, marginBottom: 28,
  },

  // List
  listContent: { padding: 18, paddingBottom: 40 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
  },
  iconCircle: {
    width: 46, height: 46,
    borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  cardContent: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  addressLabel: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  defaultBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10,
  },
  defaultBadgeText: { fontSize: 11, fontWeight: "700", color: "#1B7D3C" },
  addressText: { fontSize: 13, color: "#6B6B6B", lineHeight: 20 },

  cardDivider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 16 },
  cardActions: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
  },
  actionBtnText: {
    fontSize: 12, fontWeight: "600", color: "#1B7D3C",
  },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 15,
    marginTop: 8,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  addNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 15,
    marginTop: 4,
    marginBottom: 30,
  },

  // Modal
  modalOverlay: { flex: 0.3, backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8, marginTop: 14 },
  labelRow2: { flexDirection: "row", gap: 10 },
  labelChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  labelChipActive: { backgroundColor: "#1B7D3C" },
  labelChipText: { fontSize: 14, fontWeight: "600", color: "#6B6B6B" },
  labelChipTextActive: { color: "#FFFFFF" },
  textInput: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1A1A1A",
  },
  coordRow: { flexDirection: "row" },
  errorText: { fontSize: 13, color: "#DC2626", marginTop: 10 },
});
