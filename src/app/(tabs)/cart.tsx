import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function CartScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="cart-outline" size={64} color="#1B7D3C" />
        <Text style={styles.title}>Your Cart is Active</Text>
        <Text style={styles.subtitle}>You have 2 items ready for checkout from Pizza House.</Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Proceed to Checkout ($14.00)</Text>
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
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B6B6B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#1B7D3C",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
