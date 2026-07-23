import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://bftsfgoenlgflhpfrqgf.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdHNmZ29lbmxnZmxocGZycWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTM5NzQsImV4cCI6MjEwMDE4OTk3NH0.2LSDT2ZD_yFtjTWINJa72KKiZSH0fw-hERTUX08YeQ4";

// In-memory fallback if native AsyncStorage module is unavailable or throws in Expo Go
const memoryStorage = new Map<string, string>();

const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined") localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch {
      memoryStorage.delete(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
