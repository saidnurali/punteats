import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { CartProvider } from "@/lib/CartContext";
import { WishlistProvider } from "@/lib/WishlistContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import { GlobalErrorProvider } from "@/lib/GlobalErrorProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LogBox, DeviceEventEmitter } from "react-native";
import { Image } from "expo-image";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationProvider } from "@/lib/NotificationContext";

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

Sentry.init({
  dsn: "https://0f091efee75d48364fd93e05442fa60d@o4511773028253696.ingest.de.sentry.io/4511773045751888",
  // 5% sample rate — 100% was instrumenting every navigation/fetch/render in production
  tracesSampleRate: 0.05,
});

import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

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
      // Hide splash screen after layout settles
      setTimeout(() => { SplashScreen.hideAsync(); }, 50);
    };

    checkAuth();

    // Pre-warm the data cache in background so Home screen renders instantly
    import('@/lib/DataCache').then(({ fetchRestaurants, fetchAllProducts }) => {
      fetchRestaurants().catch(() => {});
      fetchAllProducts().catch(() => {});  // Also pre-warm products
    }).catch(() => {});

    // Pre-fetch critical local/remote assets to prevent image layout flashing
    Image.prefetch([
      require("../../assets/images/hero-salad.png"),
      "https://wsrv.nl/?url=pngimg.com/uploads/motorcycle/motorcycle_PNG3162.png&output=png"
    ]);

    const authListener = DeviceEventEmitter.addListener('AUTH_STATE_CHANGED', (isAuth: boolean) => {
      setIsAuthenticated(isAuth);
    });

    return () => authListener.remove();
  }, []); // Run once on mount only — not on every tab change

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
    <ErrorBoundary>
      <LanguageProvider>
        <WishlistProvider>
          <CartProvider>
            <GlobalErrorProvider>
              <NotificationProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: "slide_from_right",
                  }}
                >
                  <Stack.Screen name="(home)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="search" />
                  <Stack.Screen name="help" />
                  <Stack.Screen name="saved-addresses" />
                </Stack>
              </NotificationProvider>
            </GlobalErrorProvider>
          </CartProvider>
        </WishlistProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
