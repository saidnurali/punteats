import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";

Sentry.init({
  dsn: "https://0f091efee75d48364fd93e05442fa60d@o4511773028253696.ingest.de.sentry.io/4511773045751888",
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  tracesSampleRate: 1.0,
});

function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setInitialized(true);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(home)";
    const inTabsGroup = segments[0] === "(tabs)";
    const isBypass = (global as any).__BYPASS_AUTH__ === true;

    // If session exists (or bypass code 123456 used) while inside auth screens, redirect to tabs
    if ((session || isBypass) && inAuthGroup) {
      router.replace("/(tabs)");
    }
    // If session is null (not authenticated) while inside tabs, keep/redirect to login screen
    else if (!session && !isBypass && inTabsGroup) {
      router.replace("/(home)/login");
    }
  }, [session, initialized, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}

export default Sentry.wrap(RootLayout);
