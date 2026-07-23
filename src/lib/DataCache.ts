import { supabase } from "@/lib/supabase";
import { mapFoodItemToProduct, Product, PRODUCTS_DATA, setProductsData } from "@/lib/products";
import { RestaurantItem } from "@/components/RestaurantCard";

const DEFAULT_COVER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80";

export const CACHE = {
  restaurants: [] as RestaurantItem[],
  restaurantsById: {} as { [id: string]: any },
  dishesByRestaurant: {} as { [restId: string]: Product[] },
  dishesByCategory: {} as { [cat: string]: Product[] },
  lastRestaurantsFetch: 0,
};

export function getCachedRestaurants(): RestaurantItem[] {
  return CACHE.restaurants;
}

export async function fetchRestaurants(forceRefresh = false): Promise<RestaurantItem[]> {
  const now = Date.now();
  // If we have cache and it's not a forced refresh, return immediately while refreshing in background if > 15s old
  if (CACHE.restaurants.length > 0 && !forceRefresh) {
    if (now - CACHE.lastRestaurantsFetch > 15000) {
      // Background revalidate
      revalidateRestaurants();
    }
    return CACHE.restaurants;
  }
  return await revalidateRestaurants();
}

async function revalidateRestaurants(): Promise<RestaurantItem[]> {
  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, category, prep_time, delivery_fee, min_order, rating, reviews_count, cover_image, image_url, logo_image, emoji, description, address, phone, status")
      .eq('status', 'Active');

    if (error || !data) return CACHE.restaurants;

    const mapped: RestaurantItem[] = data.map((r: any) => {
      const item: RestaurantItem = {
        id: String(r.id),
        name: r.name || "Restaurant",
        tags: r.category || "Somali Traditional & Fast Food",
        time: r.prep_time || "20-30m",
        fee: r.delivery_fee
          ? typeof r.delivery_fee === "number"
            ? `$${r.delivery_fee.toFixed(2)}`
            : String(r.delivery_fee).startsWith("$")
            ? String(r.delivery_fee)
            : `$${r.delivery_fee}`
          : "$2.00",
        rating: String(r.rating || "4.8"),
        image: r.cover_image || r.image_url || DEFAULT_COVER,
        coverImage: r.cover_image || r.image_url || DEFAULT_COVER,
        logoImage: r.logo_image || r.emoji || "🏪",
        emoji: r.emoji || r.logo_image || "🏪",
        status: r.status || "Active",
      };
      CACHE.restaurantsById[item.id] = {
        ...r,
        ...item,
        reviews_count: r.reviews_count || "128",
        min_order: r.min_order
          ? typeof r.min_order === "number"
            ? `$${r.min_order}`
            : String(r.min_order).startsWith("$")
            ? String(r.min_order)
            : `$${r.min_order}`
          : "$5",
        address: r.address || "Main Street, Garowe, Puntland",
        phone: r.phone || "+252 90 7000000",
      };
      return item;
    });

    CACHE.restaurants = mapped;
    CACHE.lastRestaurantsFetch = Date.now();
    return mapped;
  } catch (err) {
    console.error("Error revalidating restaurants cache:", err);
    return CACHE.restaurants;
  }
}

export function getCachedRestaurantById(id: string): any | null {
  if (CACHE.restaurantsById[id]) return CACHE.restaurantsById[id];
  const found = CACHE.restaurants.find((r) => r.id === id);
  if (found) return found;
  return null;
}

export async function fetchRestaurantById(id: string): Promise<any | null> {
  const cached = getCachedRestaurantById(id);
  try {
    let query = supabase
      .from("restaurants")
      .select("id, name, category, prep_time, delivery_fee, min_order, rating, reviews_count, cover_image, image_url, logo_image, emoji, description, address, phone, status");

    if (!isNaN(Number(id))) {
      query = query.or(`id.eq.${id},id.eq.${Number(id)}`);
    } else {
      query = query.eq("id", id);
    }

    const { data } = await query.single();
    if (data) {
      const full = {
        id: String(data.id),
        name: data.name || "Restaurant",
        tags: data.category || "Somali Traditional • Fast Food",
        prep_time: data.prep_time || "20-30 min",
        time: data.prep_time || "20-30 min",
        delivery_fee: data.delivery_fee
          ? typeof data.delivery_fee === "number"
            ? `$${data.delivery_fee.toFixed(2)}`
            : String(data.delivery_fee).startsWith("$")
            ? String(data.delivery_fee)
            : `$${data.delivery_fee}`
          : "$1.50",
        fee: data.delivery_fee
          ? typeof data.delivery_fee === "number"
            ? `$${data.delivery_fee.toFixed(2)}`
            : String(data.delivery_fee).startsWith("$")
            ? String(data.delivery_fee)
            : `$${data.delivery_fee}`
          : "$1.50",
        min_order: data.min_order
          ? typeof data.min_order === "number"
            ? `$${data.min_order}`
            : String(data.min_order).startsWith("$")
            ? String(data.min_order)
            : `$${data.min_order}`
          : "$5",
        rating: String(data.rating || "4.6"),
        reviews_count: data.reviews_count || "128",
        cover_image: data.cover_image || data.image_url || DEFAULT_COVER,
        coverImage: data.cover_image || data.image_url || DEFAULT_COVER,
        image: data.cover_image || data.image_url || DEFAULT_COVER,
        logo_image: data.logo_image || data.emoji || "🏪",
        logoImage: data.logo_image || data.emoji || "🏪",
        emoji: data.emoji || data.logo_image || "🏪",
        description: data.description || "Delivering authentic and delicious meals directly to your door across Garowe.",
        address: data.address || "Main Street, Garowe, Puntland",
        phone: data.phone || "+252 90 7000000",
      };
      CACHE.restaurantsById[full.id] = full;
      return full;
    }
  } catch (err) {
    console.error("Error fetching restaurant by id:", err);
  }
  return cached;
}

export function getCachedRestaurantDishes(restId: string): Product[] {
  if (CACHE.dishesByRestaurant[restId]) return CACHE.dishesByRestaurant[restId];
  return PRODUCTS_DATA.filter((p) => p.restaurant_id === restId);
}

export async function fetchRestaurantDishes(restId: string): Promise<Product[]> {
  try {
    let query = supabase
      .from("food_items")
      .select("id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, restaurant_id")
      .eq("availability", "In Stock");

    if (!isNaN(Number(restId))) {
      query = query.or(`restaurant_id.eq.${restId},restaurant_id.eq.${Number(restId)}`);
    } else {
      query = query.eq("restaurant_id", restId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const mapped = data.map(mapFoodItemToProduct);
      CACHE.dishesByRestaurant[restId] = mapped;
      return mapped;
    }
    CACHE.dishesByRestaurant[restId] = [];
    return [];
  } catch (err) {
    console.error("Error fetching restaurant dishes:", err);
    return getCachedRestaurantDishes(restId);
  }
}

export function getCachedCategoryDishes(categoryName: string): Product[] {
  if (CACHE.dishesByCategory[categoryName]) return CACHE.dishesByCategory[categoryName];
  const cleanSelected = categoryName
    .replace(/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF\s]+/g, "")
    .trim()
    .toLowerCase();

  return PRODUCTS_DATA.filter((item) => {
    const cleanItemCat = (item.category || "")
      .replace(/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF\s]+/g, "")
      .trim()
      .toLowerCase();
    return (
      cleanItemCat === cleanSelected ||
      cleanItemCat.includes(cleanSelected) ||
      cleanSelected.includes(cleanItemCat)
    );
  });
}

export async function fetchCategoryDishes(categoryName: string): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from("food_items")
      .select("id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, restaurant_id")
      .eq("availability", "In Stock");

    if (error || !data) return getCachedCategoryDishes(categoryName);

    const cleanSelected = categoryName
      .replace(/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF\s]+/g, "")
      .trim()
      .toLowerCase();

    const matched = data
      .filter((item) => {
        const cleanItemCat = (item.category || "")
          .replace(/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF\s]+/g, "")
          .trim()
          .toLowerCase();
        return (
          cleanItemCat === cleanSelected ||
          cleanItemCat.includes(cleanSelected) ||
          cleanSelected.includes(cleanItemCat)
        );
      })
      .map(mapFoodItemToProduct);

    CACHE.dishesByCategory[categoryName] = matched;
    return matched;
  } catch (err) {
    console.error("Error fetching category dishes:", err);
    return getCachedCategoryDishes(categoryName);
  }
}
