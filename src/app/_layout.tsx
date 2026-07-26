import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { CartProvider } from "@/lib/CartContext";
import { WishlistProvider } from "@/lib/WishlistContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LogBox } from "react-native";

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

Sentry.init({
  dsn: "https://0f091efee75d48364fd93e05442fa60d@o4511773028253696.ingest.de.sentry.io/4511773045751888",
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  tracesSampleRate: 1.0,
});

function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      // Check custom session
      const storedProfile = await AsyncStorage.getItem('puntgo_user_session');
      if (storedProfile) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setInitialized(true);
    };

    checkAuth();
  }, [segments]); // Check auth when navigation segments change

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(home)";
    const inTabsGroup = segments[0] === "(tabs)";
    const isBypass = (globalThis as any).__BYPASS_AUTH__ === true;

    // IF SESSION EXISTS (User logged in)
    if ((isAuthenticated || isBypass) && inAuthGroup) {
      router.replace("/(tabs)");
    }
    // IF NO SESSION (User logged out)
    else if (!isAuthenticated && !isBypass && inTabsGroup) {
      router.replace("/(home)/login");
    }
  }, [isAuthenticated, initialized, segments]);

  return (
    <WishlistProvider>
      <CartProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
      </CartProvider>
    </WishlistProvider>
  );
}

export default Sentry.wrap(RootLayout);
