import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform, Alert } from "react-native";
import { useCart } from "@/lib/CartContext";
import { usePushNotifications } from "@/lib/usePushNotifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  
  // Memoize computed values — insets don't change, but without memo these
  // recompute on every parent re-render (cart count badge update, etc.)
  const { androidBottomPadding, androidHeight } = useMemo(() => ({
    androidBottomPadding: Math.max(insets.bottom, 12),
    androidHeight: 65 + Math.max(insets.bottom, 12),
  }), [insets.bottom]);

  const { totalItems } = useCart();
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    async function savePushToken() {
      if (expoPushToken?.data) {
        try {
          const sessionString = await AsyncStorage.getItem('puntgo_user_session');
          if (sessionString) {
            const session = JSON.parse(sessionString);
            if (session?.id) {
              await supabase
                .from('profiles')
                .update({ expo_push_token: expoPushToken.data })
                .eq('id', session.id);
            }
          }
        } catch (error) {
          console.error("Error saving push token to profile", error);
        }
      }
    }
    savePushToken();

    // Frontend Realtime Fallback for Push Notifications
    let subscription: any = null;
    async function setupRealtimeListener() {
      const sessionString = await AsyncStorage.getItem('puntgo_user_session');
      if (!sessionString) return;
      const session = JSON.parse(sessionString);
      const userPhone = session?.phone_number;
      const filter = userPhone ? `customer_phone=eq.${encodeURIComponent(userPhone)}` : undefined;

      subscription = supabase
        .channel('public:orders')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter },
          (payload) => {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            
            // Only notify if status changed AND the order belongs to this user
            if (oldStatus !== newStatus && payload.new?.customer_phone === userPhone) {
              
              let title = 'Order Update';
              let body = `Your order status changed to ${newStatus}`;

              if (newStatus?.toLowerCase() === 'preparing') {
                title = '👨‍🍳 Preparing your food!';
                body = 'The restaurant has accepted your order and is preparing it now.';
              } else if (newStatus?.toLowerCase() === 'out for delivery') {
                title = '🛵 Order is on the way!';
                body = 'Your driver has picked up your food and is heading your way.';
              } else if (newStatus?.toLowerCase() === 'delivered') {
                title = '✅ Order Delivered!';
                body = 'Your food has arrived. Enjoy your meal from PuntEats!';
              }

              // Trigger notification based on platform capability
              if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
                // Fallback for Expo Go on Android since native push is removed in SDK 53
                Alert.alert(title, body, [{ text: "OK" }]);
              } else {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title,
                    body,
                    sound: true,
                  },
                  trigger: null,
                });
              }
            }
          }
        )
        .subscribe();
    }
    
    setupRealtimeListener();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [expoPushToken]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneContainerStyle: { 
          backgroundColor: "#F8F8F8",
          paddingBottom: 0,
        },
        tabBarHideOnKeyboard: false,
        tabBarActiveTintColor: "#1B7D3C",
        tabBarInactiveTintColor: "#6B6B6B",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          height: Platform.OS === 'android' ? androidHeight : 88,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? androidBottomPadding : 28,
          display: 'flex',
          elevation: 8,
          zIndex: 9999,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: "Wishlist",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? "cart" : "cart-outline"} size={24} color={color} />
              {totalItems > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{totalItems > 99 ? "99+" : totalItems}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: "absolute",
    right: -8,
    top: -4,
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
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
