import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { Product, mapFoodItemToProduct } from "@/lib/products";
import { supabase } from "@/lib/supabase";

interface WishlistContextType {
  wishlistItems: Product[];
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (product: Product) => void;
  clearWishlist: () => void;
}

const WISHLIST_STORAGE_KEY = "@puntgo_wishlist_items";

const memoryStorage = new Map<string, string>();

const safeStorage = {
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
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O(1) lookup set — rebuilt only when wishlistItems changes
  const wishlistSet = useMemo(() => new Set(wishlistItems.map(i => i.id)), [wishlistItems]);

  useEffect(() => {
    const loadWishlist = async () => {
      try {
        // 1. Load local cache FIRST for instant UI — no network wait
        const stored = await safeStorage.getItem(WISHLIST_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.length > 0) setWishlistItems(parsed);
        }

        // 2. Sync from Supabase in background without blocking UI
        const storedSession = await safeStorage.getItem("puntgo_user_session");
        if (storedSession) {
          const user = JSON.parse(storedSession);
          if (user?.id) {
            const { data } = await supabase
              .from('wishlist')
              .select('id, product:food_items(*, restaurant:restaurants(name))')
              .eq('user_id', user.id);

            if (data) {
              const fetchedItems = data
                .map((d: any) => d.product ? mapFoodItemToProduct(d.product) : null)
                .filter(Boolean) as Product[];

              if (fetchedItems.length > 0) {
                setWishlistItems(fetchedItems);
              }
            }
          }
        }
      } catch (error) {
      } finally {
        setIsLoaded(true);
      }
    };
    loadWishlist();
  }, []);

  // Debounced save — avoids hammering AsyncStorage on every rapid toggle
  useEffect(() => {
    if (!isLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await safeStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
      } catch (error) {}
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [wishlistItems, isLoaded]);

  // O(1) via Set — was O(n) .some() called 50+ times per render
  const isWishlisted = useCallback((id: string) => wishlistSet.has(id), [wishlistSet]);

  const toggleWishlist = useCallback(async (product: Product) => {
    // Optimistic update — immediate UI response, no waiting
    setWishlistItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) return prev.filter((item) => item.id !== product.id);
      return [...prev, product];
    });

    // Background Supabase sync — never blocks the UI
    try {
      const storedSession = await safeStorage.getItem("puntgo_user_session");
      if (storedSession) {
        const user = JSON.parse(storedSession);
        if (user?.id) {
          // Use the Set snapshot for the correct pre-toggle state
          const wasInWishlist = wishlistSet.has(product.id);
          if (wasInWishlist) {
            await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', product.id);
          } else {
            await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
          }
        }
      }
    } catch (err) {
      console.warn("Wishlist sync error:", err);
    }
  }, [wishlistSet]);

  const clearWishlist = useCallback(() => setWishlistItems([]), []);

  const value = useMemo(
    () => ({ wishlistItems, isWishlisted, toggleWishlist, clearWishlist }),
    [wishlistItems, isWishlisted, toggleWishlist, clearWishlist]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
};
