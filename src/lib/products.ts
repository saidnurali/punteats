import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  name: string;
  category: string;
  category_id?: string;
  price: number;
  priceFormatted: string;
  rating: string;
  calories: string;
  deliveryTime: string;
  description: string;
  image: string;
  images: string[];
  image_url?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  delivery_fee?: number;
  availability?: string;
  variants?: any[];
  add_ons?: any[];
  selectedVariant?: any;
  selectedAddOns?: any[];
  distance?: string;
  reviews_count?: string | number;
}

export let PRODUCTS_DATA: Product[] = [];

export function setProductsData(data: Product[]) {
  PRODUCTS_DATA = data;
}

/** Strip Base64 strings from an array — they can be megabytes large and block the JS thread */
function safeImageUrl(url: string | undefined | null, fallback = ''): string {
  if (!url) return fallback;
  if (url.startsWith('data:')) return fallback; // Base64 — never store this
  return url;
}

export function mapFoodItemToProduct(item: any, restaurantsMap?: Record<string, string>, deliveryMap?: Record<string, number>): Product {
  const priceNum = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

  // Safely pick the first valid (non-Base64) URL
  const rawImageUrl = safeImageUrl(item.image_url, '');
  const rawImages: string[] = Array.isArray(item.images)
    ? item.images.map((img: any) => safeImageUrl(img, '')).filter(Boolean)
    : [];

  const imageStr = rawImageUrl || rawImages[0] || FALLBACK_IMAGE;
  const imagesArr = rawImages.length > 0 ? rawImages : [imageStr];

  return {
    id: String(item.id),
    name: item.name || 'Dish Name',
    category: (item.category || 'Food').replace(/^[^\w\s]+/g, '').trim() || item.category || 'Food',
    category_id: item.category_id,
    price: priceNum,
    priceFormatted: `$${priceNum.toFixed(2)}`,
    rating: item.rating ? String(item.rating).replace(/[^\d.]/g, '') : '0',
    calories: item.calories || '300kcal',
    deliveryTime: item.prep_time || '20mins',
    description: item.description || '',
    image: imageStr,
    images: imagesArr,
    image_url: rawImageUrl || undefined,
    restaurant_id: item.restaurant_id ? String(item.restaurant_id) : undefined,
    restaurant_name: item.restaurant?.name || item.restaurants?.name || item.restaurant_name || (restaurantsMap && item.restaurant_id ? restaurantsMap[String(item.restaurant_id)] : undefined) || undefined,
    delivery_fee: Number(item.restaurant?.delivery_fee ?? item.restaurants?.delivery_fee ?? (deliveryMap && item.restaurant_id ? deliveryMap[String(item.restaurant_id)] : undefined) ?? item.delivery_fee ?? 0),
    availability: item.availability || 'In Stock',
    variants: Array.isArray(item.variants) ? item.variants.map((v: any) => ({ ...v, name: v.name || v.option_name, price: Number(v.price) || 0 })) : [],
    add_ons: Array.isArray(item.add_ons) ? item.add_ons.map((a: any) => ({ ...a, name: a.name || a.option_name, price: Number(a.price) || 0 })) : []
  };
}

/**
 * Fetch all food items from Supabase.
 * CRITICAL FIX: Removed `categories(id, name, image_url)` JOIN — that JOIN was
 * causing 10-25 second load times on Supabase free tier even with only 10 rows.
 * Simple selects complete in <500ms.
 */
export async function fetchProductsFromSupabase(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('food_items')
      .select('id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, category_id, restaurant_id, variants, add_ons, restaurant:restaurants(id, name, delivery_fee)')
      .eq('availability', 'In Stock')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      console.warn('[PuntEats] fetchProductsFromSupabase failed:', error?.message);
      return PRODUCTS_DATA;
    }
    const { data: rData } = await supabase.from('restaurants').select('id, name, delivery_fee');
    const rMap: Record<string, string> = {};
    const dMap: Record<string, number> = {};
    if (rData) {
      rData.forEach(r => {
        rMap[String(r.id)] = r.name;
        dMap[String(r.id)] = Number(r.delivery_fee) || 0;
      });
    }
    const mapped = data.map(item => mapFoodItemToProduct(item, rMap, dMap));
    PRODUCTS_DATA = mapped;
    return mapped;
  } catch (err) {
    console.error('[PuntEats] fetchProductsFromSupabase crashed:', err);
    return PRODUCTS_DATA;
  }
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS_DATA.find((item) => item.id === id);
}

export async function fetchProductById(id: string): Promise<Product | undefined> {
  const local = getProductById(id);
  try {
    const { data, error } = await supabase
      .from('food_items')
      .select('id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, category_id, restaurant_id, variants, add_ons, restaurant:restaurants(id, name, delivery_fee)')
      .eq('id', id)
      .single();
    if (error || !data) return local;
    const { data: rData } = await supabase.from('restaurants').select('id, name, delivery_fee');
    const rMap: Record<string, string> = {};
    const dMap: Record<string, number> = {};
    if (rData) {
      rData.forEach(r => {
        rMap[String(r.id)] = r.name;
        dMap[String(r.id)] = Number(r.delivery_fee) || 0;
      });
    }
    const mapped = mapFoodItemToProduct(data, rMap, dMap);
    const idx = PRODUCTS_DATA.findIndex(p => p.id === mapped.id);
    if (idx !== -1) {
      PRODUCTS_DATA[idx] = mapped;
    } else {
      PRODUCTS_DATA.push(mapped);
    }
    return mapped;
  } catch (err) {
    return local;
  }
}
