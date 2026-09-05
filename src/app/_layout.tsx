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
  // Auth state now comes ONLY from Supabase Auth's real session — never
  // from an AsyncStorage flag. This is the single source of truth used
  // by every RLS policy in the database, so it must be the single source
  // of truth here too.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setInitialized(true);
      setTimeout(() => { SplashScreen.hideAsync(); }, 50);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

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

    // Legacy event kept as a secondary trigger for any screen still
    // emitting it — real state always comes from onAuthStateChange above,
    // this just forces an immediate re-check rather than waiting for the
    // Supabase listener to fire.
    const legacyListener = DeviceEventEmitter.addListener('AUTH_STATE_CHANGED', () => {
      supabase.auth.getSession().then(({ data: { session } }) => setIsAuthenticated(!!session));
    });

    return () => {
      authListener.subscription.unsubscribe();
      legacyListener.remove();
    };
  }, []); // Run once on mount only — not on every tab change

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(home)";
    const inTabsGroup = segments[0] === "(tabs)";
    // NOTE: __BYPASS_AUTH__ has been permanently removed. There is no
    // code path anywhere in this app that skips real authentication.

    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isAuthenticated && inTabsGroup) {
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
