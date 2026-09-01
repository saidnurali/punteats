import { supabase } from "@/lib/supabase";
import { mapFoodItemToProduct, Product, PRODUCTS_DATA, setProductsData } from "@/lib/products";
import { RestaurantItem } from "@/components/RestaurantCard";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_COVER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80";
const RESTAURANTS_DISK_CACHE_KEY = "@puntgo_restaurants_cache_v2";
const PRODUCTS_DISK_CACHE_KEY = "@puntgo_products_cache_v2";

// ─── In-memory cache ──────────────────────────────────────────────────────────
export const CACHE = {
  restaurants: [] as RestaurantItem[],
  restaurantsById: {} as { [id: string]: any },
  dishesByRestaurant: {} as { [restId: string]: Product[] },
  dishesByCategory: {} as { [cat: string]: Product[] },
  allProducts: [] as Product[],
  lastRestaurantsFetch: 0,
  lastProductsFetch: 0,
  isFetchingProducts: false,
};

// ─── Safety: strip Base64 from images before caching ─────────────────────────
// Base64 strings can be 1–3MB each. Storing them in AsyncStorage blocks the
// JS thread and makes the cache useless. Replace with empty string so
// mapFoodItemToProduct will use the fallback placeholder instead.
function sanitizeProductsForCache(products: Product[]): Product[] {
  return products.map(p => ({
    ...p,
    image: p.image?.startsWith('data:') ? '' : p.image,
    image_url: p.image_url?.startsWith('data:') ? undefined : p.image_url,
    images: (p.images || []).map(img => img?.startsWith('data:') ? '' : img).filter(Boolean),
  }));
}

// ─── Restaurants ─────────────────────────────────────────────────────────────

export function getCachedRestaurants(): RestaurantItem[] {
  return CACHE.restaurants;
}

/** Load previously persisted restaurants from disk into memory — fast, no network */
async function loadRestaurantsFromDisk(): Promise<void> {
  if (CACHE.restaurants.length > 0) return; // already warm
  try {
    const raw = await AsyncStorage.getItem(RESTAURANTS_DISK_CACHE_KEY);
    if (raw) {
      const parsed: RestaurantItem[] = JSON.parse(raw);
      if (parsed.length > 0 && CACHE.restaurants.length === 0) {
        CACHE.restaurants = parsed;
        parsed.forEach(r => { CACHE.restaurantsById[r.id] = r; });
      }
    }
  } catch {}
}

export async function fetchRestaurants(forceRefresh = false): Promise<RestaurantItem[]> {
  await loadRestaurantsFromDisk();

  const now = Date.now();
  if (CACHE.restaurants.length > 0 && !forceRefresh) {
    // Background revalidate if cache is older than 30 seconds
    if (now - CACHE.lastRestaurantsFetch > 30000) {
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
      .select("id, name, category, prep_time, delivery_fee, min_order, rating, cover_image, logo_image, emoji, status, opening_time, closing_time")
      .eq('status', 'Active');

    if (error || !data) {
      console.warn('[PuntEats] revalidateRestaurants failed:', error?.message);
      return CACHE.restaurants;
    }

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
        rating: r.rating ? String(r.rating) : "0",
        opening_time: r.opening_time || null,
        closing_time: r.closing_time || null,
        image: r.cover_image || DEFAULT_COVER,
        coverImage: r.cover_image || DEFAULT_COVER,
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
    // Persist to disk for instant cold-start
    AsyncStorage.setItem(RESTAURANTS_DISK_CACHE_KEY, JSON.stringify(mapped)).catch(() => {});
    return mapped;
  } catch (err) {
    console.error("[PuntEats] revalidateRestaurants crashed:", err);
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
      .select("id, name, category, prep_time, delivery_fee, min_order, rating, cover_image, logo_image, emoji, status, opening_time, closing_time");

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
        rating: data.rating ? String(data.rating) : "0",
        opening_time: data.opening_time || null,
        closing_time: data.closing_time || null,
        reviews_count: data.reviews_count || "128",
        cover_image: data.cover_image || DEFAULT_COVER,
        coverImage: data.cover_image || DEFAULT_COVER,
        image: data.cover_image || DEFAULT_COVER,
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
    console.error("[PuntEats] fetchRestaurantById crashed:", err);
  }
  return cached;
}

// ─── All Products (shared cache — HomeScreen + CategoriesScreen both use this) ─

/** Load products from disk into memory on cold start */
async function loadProductsFromDisk(): Promise<void> {
  if (CACHE.allProducts.length > 0) return;
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_DISK_CACHE_KEY);
    if (raw) {
      const parsed: Product[] = JSON.parse(raw);
      if (parsed.length > 0) {
        CACHE.allProducts = parsed;
        setProductsData(parsed);
      }
    }
  } catch {}
}

/**
 * Fetch all products with shared in-memory cache.
 * If HomeScreen already fetched, CategoriesScreen gets the result instantly.
 * If a fetch is already in-flight, wait for it instead of firing a duplicate.
 */
let _productsFetchPromise: Promise<Product[]> | null = null;

export async function fetchAllProducts(forceRefresh = false): Promise<Product[]> {
  // 1. Cold-start: load from disk first
  await loadProductsFromDisk();

  const now = Date.now();
  // 2. Return memory cache if fresh (<60s old)
  if (CACHE.allProducts.length > 0 && !forceRefresh) {
    if (now - CACHE.lastProductsFetch < 60000) {
      return CACHE.allProducts;
    }
    // Cache is stale — revalidate in background, return stale immediately
    revalidateAllProducts().catch(() => {});
    return CACHE.allProducts;
  }

  // 3. Deduplicate in-flight requests — if a fetch is already running, return the same promise
  if (_productsFetchPromise) {
    return _productsFetchPromise;
  }

  _productsFetchPromise = revalidateAllProducts().finally(() => {
    _productsFetchPromise = null;
  });
  return _productsFetchPromise;
}

async function resolveRestaurantMaps(): Promise<{ rMap: Record<string, string>, dMap: Record<string, number> }> {
  const rMap: Record<string, string> = {};
  const dMap: Record<string, number> = {};
  if (CACHE.restaurants.length > 0) {
    CACHE.restaurants.forEach(r => {
      rMap[String(r.id)] = r.name;
      dMap[String(r.id)] = Number(r.delivery_fee) || 0;
    });
    return { rMap, dMap };
  }
  const { data } = await supabase.from('restaurants').select('id, name, delivery_fee');
  if (data) {
    data.forEach(r => {
      rMap[String(r.id)] = r.name;
      dMap[String(r.id)] = Number(r.delivery_fee) || 0;
    });
  }
  return { rMap, dMap };
}

async function revalidateAllProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('food_items')
      // Join with restaurants to dynamically extract actual restaurant names and delivery fee
      .select('id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, category_id, restaurant_id, variants, add_ons, restaurant:restaurants(id, name, delivery_fee)')
      .eq('availability', 'In Stock')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[PuntEats] revalidateAllProducts failed:', error?.message);
      return CACHE.allProducts;
    }

    const { rMap, dMap } = await resolveRestaurantMaps();
    const mapped = data.map(item => mapFoodItemToProduct(item, rMap, dMap));
    CACHE.allProducts = mapped;
    CACHE.lastProductsFetch = Date.now();
    setProductsData(mapped);

    // Sanitize before writing to disk — strip Base64 blobs
    const safe = sanitizeProductsForCache(mapped);
    AsyncStorage.setItem(PRODUCTS_DISK_CACHE_KEY, JSON.stringify(safe)).catch(() => {});
    return mapped;
  } catch (err) {
    console.error('[PuntEats] revalidateAllProducts crashed:', err);
    return CACHE.allProducts;
  }
}

export function getCachedAllProducts(): Product[] {
  return CACHE.allProducts.length > 0 ? CACHE.allProducts : PRODUCTS_DATA;
}

// ─── Restaurant Dishes ────────────────────────────────────────────────────────

export function getCachedRestaurantDishes(restId: string): Product[] {
  if (CACHE.dishesByRestaurant[restId]) return CACHE.dishesByRestaurant[restId];
  // Try global product cache as fallback
  return CACHE.allProducts.filter((p) => p.restaurant_id === restId);
}

export async function fetchRestaurantDishes(restId: string): Promise<Product[]> {
  try {
    let query = supabase
      .from("food_items")
      .select("id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, category_id, restaurant_id, variants, add_ons, restaurants(name)")
      .eq("availability", "In Stock");

    if (!isNaN(Number(restId))) {
      query = query.or(`restaurant_id.eq.${restId},restaurant_id.eq.${Number(restId)}`);
    } else {
      query = query.eq("restaurant_id", restId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const { rMap, dMap } = await resolveRestaurantMaps();
      const mapped = data.map(item => mapFoodItemToProduct(item, rMap, dMap));
      CACHE.dishesByRestaurant[restId] = mapped;
      return mapped;
    }
    CACHE.dishesByRestaurant[restId] = [];
    return [];
  } catch (err) {
    console.error("[PuntEats] fetchRestaurantDishes crashed:", err);
    return getCachedRestaurantDishes(restId);
  }
}

// ─── Category Dishes ──────────────────────────────────────────────────────────

export function getCachedCategoryDishes(categoryName: string): Product[] {
  const cat = categoryName.toLowerCase().trim();
  // Check dedicated cache first
  if (CACHE.dishesByCategory[cat]) return CACHE.dishesByCategory[cat];
  // Fall back to filtering in-memory global products (zero network)
  const all = getCachedAllProducts();
  if (all.length > 0) {
    return all.filter(item => {
      const itemCat = (item.category || '').toLowerCase().trim();
      return itemCat === cat || itemCat.includes(cat) || cat.includes(itemCat);
    });
  }
  return [];
}

export async function fetchCategoryDishes(categoryName: string): Promise<Product[]> {
  const cat = categoryName.toLowerCase().trim();

  // If we already have all products in memory, filter immediately — no network call needed
  const allInMemory = getCachedAllProducts();
  if (allInMemory.length > 0) {
    const filtered = allInMemory.filter(item => {
      const itemCat = (item.category || '').toLowerCase().trim();
      return itemCat === cat || itemCat.includes(cat) || cat.includes(itemCat);
    });
    CACHE.dishesByCategory[cat] = filtered;
    return filtered;
  }

  // Otherwise fetch from Supabase with SERVER-SIDE category filter (was fetching ALL then filtering client-side)
  try {
    const { data, error } = await supabase
      .from('food_items')
      .select('id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, category_id, restaurant_id, variants, add_ons, restaurant:restaurants(id, name, delivery_fee)')
      .eq('availability', 'In Stock')
      .ilike('category', `%${categoryName}%`);

    if (error || !data) {
      console.warn('[PuntEats] fetchCategoryDishes failed:', error?.message);
      return getCachedCategoryDishes(categoryName);
    }

    const { rMap, dMap } = await resolveRestaurantMaps();
    const mapped = data.map(item => mapFoodItemToProduct(item, rMap, dMap));
    CACHE.dishesByCategory[cat] = mapped;
    return mapped;
  } catch (err) {
    console.error('[PuntEats] fetchCategoryDishes crashed:', err);
    return getCachedCategoryDishes(categoryName);
  }
}
