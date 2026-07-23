import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { Product } from "@/lib/products";

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

  const toggleWishlist = (product: Product) => {
    setWishlistItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) return prev.filter((item) => item.id !== product.id);
      return [...prev, product];
    });
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
