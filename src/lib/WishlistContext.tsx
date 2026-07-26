import React, { createContext, useContext, useState, useEffect } from "react";
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

  useEffect(() => {
    const loadWishlist = async () => {
      try {
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
                .filter(Boolean);
              
              if (fetchedItems.length > 0) {
                setWishlistItems(fetchedItems);
                setIsLoaded(true);
                return;
              }
            }
          }
        }
        
        // Fallback to local
        const stored = await safeStorage.getItem(WISHLIST_STORAGE_KEY);
        if (stored) setWishlistItems(JSON.parse(stored));
      } catch (error) {} finally {
        setIsLoaded(true);
      }
    };
    loadWishlist();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const saveWishlist = async () => {
      try {
        await safeStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
      } catch (error) {}
    };
    saveWishlist();
  }, [wishlistItems, isLoaded]);

  const isWishlisted = (id: string) => wishlistItems.some((item) => item.id === id);

  const toggleWishlist = async (product: Product) => {
    // Optimistic Update
    setWishlistItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) return prev.filter((item) => item.id !== product.id);
      return [...prev, product];
    });

    // Supabase Sync
    try {
      const storedSession = await safeStorage.getItem("puntgo_user_session");
      if (storedSession) {
        const user = JSON.parse(storedSession);
        if (user?.id) {
          const exists = wishlistItems.some((item) => item.id === product.id);
          if (exists) {
            // It was there, so we are removing it
            await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', product.id);
          } else {
            // It was not there, so we are adding it
            await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
          }
        }
      }
    } catch (err) {
      console.warn("Wishlist sync error:", err);
    }
  };

  const clearWishlist = () => setWishlistItems([]);

  return (
    <WishlistContext.Provider value={{ wishlistItems, isWishlisted, toggleWishlist, clearWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
};
