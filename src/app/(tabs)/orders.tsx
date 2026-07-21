import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="cube-outline" size={64} color="#1B7D3C" />
        <Text style={styles.title}>Active & Past Orders</Text>
        <Text style={styles.subtitle}>Track your food delivery or taxi rides across Puntland.</Text>
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
  },
});
