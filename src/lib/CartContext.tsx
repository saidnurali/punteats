import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { Product } from "@/lib/products";

export interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = "@puntgo_cart_items";

// In-memory fallback when native AsyncStorage module is null (e.g. in Expo Go / Web without native rebuild)
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

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart on start
  useEffect(() => {
    const loadCart = async () => {
      try {
        const stored = await safeStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          setCartItems(JSON.parse(stored));
        }
      } catch (error) {
        // Fallback silently if parsing fails
      } finally {
        setIsLoaded(true);
      }
    };
    loadCart();
  }, []);

  // Save cart whenever it changes (only after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    const saveCart = async () => {
      try {
        await safeStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      } catch (error) {
        // Safe storage handles all storage errors without logging or throwing
      }
    };
    saveCart();
  }, [cartItems, isLoaded]);

  const addToCart = (product: Product, quantity = 1) => {
    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) =>
          item.id === product.id &&
          JSON.stringify(item.selectedVariant || null) === JSON.stringify(product.selectedVariant || null) &&
          JSON.stringify(item.selectedAddOns || []) === JSON.stringify(product.selectedAddOns || [])
      );
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        // Calculate the base price for this cart item
        let basePrice = product.price;
        if (product.selectedVariant && typeof product.selectedVariant.price === 'number') {
          basePrice = product.selectedVariant.price;
        }
        if (Array.isArray(product.selectedAddOns)) {
          product.selectedAddOns.forEach(addon => {
            if (typeof addon.price === 'number') {
              basePrice += addon.price;
            }
          });
        }
        return [...prevItems, { ...product, price: basePrice, quantity }];
      }
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCartItems((prevItems) =>
      prevItems
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (id: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        totalItems,
        totalPrice,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
