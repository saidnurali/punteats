import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { supabase } from "@/lib/supabase";

interface OrderRatingModalProps {
  visible: boolean;
  orderId: string;
  userId: string;
  restaurantId?: string;
  restaurantName: string;
  driverId?: string;
  driverName?: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export function OrderRatingModal({
  visible,
  orderId,
  userId,
  restaurantId,
  restaurantName,
  driverId,
  driverName,
  onClose,
  onSubmitSuccess,
}: OrderRatingModalProps) {
  const [foodRating, setFoodRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (foodRating === 0) {
      setError("Please rate the food & restaurant.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const reviewPayload = {
        order_id: orderId,
        user_id: userId,
        restaurant_id: restaurantId || null,
        driver_id: driverId || null,
        rating: foodRating, // The user snippet used rating
        food_rating: foodRating,
        review_text: comment.trim() || null, // Replaced comment with review_text to fix schema cache
      };

      const { error: dbError } = await supabase.from("order_reviews").insert([reviewPayload]);

      if (dbError) throw dbError;

      // Also mark the order itself as reviewed so the modal doesn't keep popping up
      const { error: updateError } = await supabase
        .from('orders')
        .update({ is_reviewed: true })
        .eq('id', orderId);

      Alert.alert("Success", "Mahadsanid! Faalladaada waa la gudbiyay");
      
      onSubmitSuccess();
    } catch (err: any) {
      // Fallback if the strict insertion failed:
      console.warn("Review insert failed, attempting fallback:", err);
      try {
        const fallbackPayload = {
          order_id: orderId,
          user_id: userId,
          restaurant_id: restaurantId || null,
          rating: foodRating,
          comment: comment.trim() || null,
        };
        const { error: fallbackError } = await supabase.from("order_reviews").insert([fallbackPayload]);
        if (fallbackError) throw fallbackError;
        
        Alert.alert("Success", "Mahadsanid! Faalladaada waa la gudbiyay");
        onSubmitSuccess();
      } catch (fallbackErr: any) {
        setError(fallbackErr?.message || "Failed to submit review. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Star Rating Component ───
  const StarRating = ({ rating, onRate }: { rating: number; onRate: (v: number) => void }) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRate(star)} activeOpacity={0.7} style={styles.starWrap}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={32}
            color={star <= rating ? "#1B7D3C" : "#D1D5DB"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={48} color="#1B7D3C" />
          </View>

          <Text style={styles.title}>How was your order?</Text>
          <Text style={styles.subtitle}>Your feedback helps us improve 💚</Text>

          {/* Rate Restaurant */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rate Food & Restaurant</Text>
            <View style={styles.entityRow}>
              <View style={styles.entityAvatar}>
                <Ionicons name="restaurant" size={16} color="#1B7D3C" />
              </View>
              <Text style={styles.entityName}>{restaurantName || "Restaurant"}</Text>
            </View>
            <StarRating rating={foodRating} onRate={setFoodRating} />
          </View>

          {/* Rate Driver */}
          {driverName && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rate Driver & Delivery</Text>
              <View style={styles.entityRow}>
                <View style={[styles.entityAvatar, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="bicycle" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.entityName}>{driverName}</Text>
              </View>
              <StarRating rating={driverRating} onRate={setDriverRating} />
            </View>
          )}

          {/* Comment */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Add a comment (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell us what you liked or how we can improve..."
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  iconCircle: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B6B6B",
    marginBottom: 24,
  },
  section: {
    width: "100%",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  entityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  entityAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  entityName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  starWrap: {
    padding: 4,
  },
  textInput: {
    width: "100%",
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#1A1A1A",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 12,
  },
  submitBtn: {
    width: "100%",
    backgroundColor: "#1B7D3C",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
