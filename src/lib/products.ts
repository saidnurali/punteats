import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  name: string;
  category: string;
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
  availability?: string;
  variants?: any[];
  add_ons?: any[];
  selectedVariant?: any;
  selectedAddOns?: any[];
}

export let PRODUCTS_DATA: Product[] = [];

export function setProductsData(data: Product[]) {
  PRODUCTS_DATA = data;
}

export function mapFoodItemToProduct(item: any): Product {
  const priceNum = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
  const imageStr = item.image_url || (Array.isArray(item.images) && item.images[0]) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
  const imagesArr = Array.isArray(item.images) && item.images.length > 0 ? item.images.filter(Boolean) : [imageStr].filter(Boolean);
  return {
    id: String(item.id),
    name: item.name || 'Dish Name',
    category: (item.category || 'Food').replace(/^[^\w\s]+/g, '').trim() || item.category || 'Food',
    price: priceNum,
    priceFormatted: `$${priceNum.toFixed(2)}`,
    rating: String(item.rating || '4.8').replace(/[^\d.]/g, '') || '4.8',
    calories: item.calories || '300kcal',
    deliveryTime: item.prep_time || '20mins',
    description: item.description || '',
    image: imageStr,
    images: imagesArr,
    image_url: item.image_url,
    restaurant_id: item.restaurant_id ? String(item.restaurant_id) : undefined,
    availability: item.availability || 'In Stock',
    variants: Array.isArray(item.variants) ? item.variants : [],
    add_ons: Array.isArray(item.add_ons) ? item.add_ons : []
  };
}

export async function fetchProductsFromSupabase(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('food_items')
      .select('id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, restaurant_id, variants, add_ons');
    if (error || !data) return PRODUCTS_DATA;
    const mapped = data.map(mapFoodItemToProduct);
    PRODUCTS_DATA = mapped;
    return mapped;
  } catch (err) {
    console.error('Error fetching food items:', err);
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
      .select('id, name, price, rating, prep_time, calories, description, image_url, images, availability, category, restaurant_id, variants, add_ons')
      .eq('id', id)
      .single();
    if (error || !data) return local;
    const mapped = mapFoodItemToProduct(data);
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
