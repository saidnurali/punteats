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

export async function getStoredOrders(): Promise<LiveOrder[]> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      // Fallback to safeStorage or memory if offline or error
      const cached = await safeStorage.getItem(ORDERS_STORAGE_KEY);
      return cached ? JSON.parse(cached) : memoryOrders;
    }

    const mapped = data.map((o: any) => {
      let itemsStr = "";
      if (typeof o.items === "string") itemsStr = o.items;
      else if (Array.isArray(o.items)) itemsStr = o.items.map((i: any) => `${i.quantity || 1}x ${i.name || i}`).join(", ");
      else if (typeof o.items === "object" && o.items !== null) itemsStr = o.items.summary || JSON.stringify(o.items);

      const totalNum = typeof o.total_price === "number" ? o.total_price : parseFloat(o.total_price) || 0;
      return {
        id: o.order_number || o.id,
        dbId: o.id,
        customerName: o.customer_name || "Customer",
        restaurant: o.restaurant_name || "Pizza House",
        items: itemsStr || "Order items",
        address: o.delivery_address || "Garowe, Puntland",
        total: `$${totalNum.toFixed(2)}`,
        status: (o.status as LiveOrder["status"]) || "Pending",
        time: o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
        phone: o.customer_phone || "+252 90 7000000",
        paymentMethod: o.payment_method || "Cash on Delivery",
        createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
        deliveryFee: "$1.50",
        subtotal: `$${Math.max(0, totalNum - 1.5).toFixed(2)}`,
        driver: o.driver || undefined,
        rejectionReason: o.rejection_reason || undefined,
      };
    });

    memoryOrders = mapped;
    await safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(mapped));
    return mapped;
  } catch (error) {
    try {
      const cached = await safeStorage.getItem(ORDERS_STORAGE_KEY);
      return cached ? JSON.parse(cached) : memoryOrders;
    } catch {
      return memoryOrders;
    }
  }
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
