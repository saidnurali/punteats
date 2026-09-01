import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LiveOrder {
  id: string; // e.g. "#PG123456" or "#ORD-9501"
  dbId?: string;
  customerName: string; // e.g. "Ahmed Ali"
  restaurant: string; // e.g. "Pizza House"
  items: string; // e.g. "2x Pepperoni Cheese Pizza, 1x Classic Burger"
  address: string; // e.g. "Home • Garowe, Puntland, Somalia"
  total: string; // e.g. "$14.50"
  status: "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
  time: string; // e.g. "Just now"
  phone: string; // e.g. "+252 90 7112233"
  paymentMethod: string; // e.g. "Cash on Delivery" or "EVC Plus (+252...)"
  createdAt: number;
  deliveryFee: string;
  subtotal: string;
  driver?: string;
  driverPhone?: string;
  rejectionReason?: string;
}

const ORDERS_STORAGE_KEY = "@puntgo_live_orders";
let memoryOrders: any[] = [];

const safeStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
};

/**
 * Returns the locally cached orders (memory or disk).
 * NEVER hits the network without a user filter — the Orders screen
 * does its own user-scoped Supabase query. An unfiltered select("*")
 * here would download every order from every user (security + perf issue).
 */
export async function getStoredOrders(): Promise<LiveOrder[]> {
  if (memoryOrders.length > 0) return memoryOrders;
  try {
    const cached = await safeStorage.getItem(ORDERS_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryOrders = parsed;
      return parsed;
    }
  } catch {}
  return [];
}

/** Called by Orders screen after a successful filtered network fetch to update the shared cache. */
export function setMemoryOrders(orders: LiveOrder[]): void {
  memoryOrders = orders;
  safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders)).catch(() => {});
}

/** Called on logout to completely wipe the current user's orders from memory and disk. */
export async function clearStoredOrders(): Promise<void> {
  memoryOrders = [];
  try {
    await AsyncStorage.removeItem(ORDERS_STORAGE_KEY);
    await AsyncStorage.removeItem('@cached_my_orders'); // Wipe legacy cache as well just in case
  } catch {}
}

export async function saveNewOrder(order: LiveOrder): Promise<LiveOrder[]> {
  try {
    const totalNum = parseFloat(order.total.replace(/[^0-9.]/g, "")) || 0;
    const { error } = await supabase.from("orders").insert([
      {
        order_number: order.id,
        customer_name: order.customerName,
        customer_phone: order.phone,
        restaurant_name: order.restaurant,
        items: order.items,
        total_price: totalNum,
        delivery_address: order.address,
        status: order.status || "Pending",
        payment_method: order.paymentMethod,
        driver: order.driver || null,
      },
    ]);
    if (error) {
      console.error("Error inserting order to Supabase:", error);
    }
  } catch (err) {
    console.error("Error saving new order:", err);
  }
  return await getStoredOrders();
}

export async function updateOrderStatus(
  orderId: string,
  status: LiveOrder["status"],
  driver?: string,
  driverPhone?: string
): Promise<LiveOrder[]> {
  try {
    const updatePayload: any = { status };
    if (driver) updatePayload.driver = driver;

    if (orderId.startsWith("#")) {
      await supabase.from("orders").update(updatePayload).eq("order_number", orderId);
    } else {
      const { error } = await supabase.from("orders").update(updatePayload).eq("id", orderId);
      if (error) {
        await supabase.from("orders").update(updatePayload).eq("order_number", orderId);
      }
    }
  } catch (err) {
    console.error("Error updating order status:", err);
  }
  return await getStoredOrders();
}
