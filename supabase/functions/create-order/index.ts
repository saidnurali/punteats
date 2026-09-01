import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderPayload, cartItems } = await req.json()

    if (!orderPayload || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload: empty cart' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── 1. Validations (Address & Restaurant) ───
    if (!orderPayload.delivery_address || orderPayload.delivery_address.length < 5 || orderPayload.delivery_address.includes("Home • Garowe, Puntland, Somalia")) {
      return new Response(JSON.stringify({ error: 'Please enter a valid, specific delivery address.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const restaurantId = orderPayload.restaurant_id;
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: 'Restaurant ID is missing.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: dbRestaurant, error: restError } = await supabaseClient
      .from('restaurants')
      .select('name, delivery_fee, min_order')
      .eq('id', restaurantId)
      .single()

    if (restError || !dbRestaurant) {
      return new Response(JSON.stringify({ error: 'Restaurant not found or is unavailable.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── 2. Server-Side Price Verification ───
    let calculatedTotal = 0;
    let serverItems = [];

    for (const item of cartItems) {
      const foodId = item.id || item.food_id || item.food_item_id;
      if (!foodId) continue;

      const { data: dbItem, error: fetchError } = await supabaseClient
        .from('food_items')
        .select('price, name')
        .eq('id', foodId)
        .eq('availability', 'In Stock')
        .single();

      if (fetchError || !dbItem) {
        return new Response(JSON.stringify({ error: `Item '${item.name}' is no longer available.` }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate extras if any (in a full production system, variant IDs should be fetched and verified too)
      let extrasCost = 0;
      if (item.selectedVariant) extrasCost += (Number(item.selectedVariant.price) || 0);
      if (item.selectedAddOns && Array.isArray(item.selectedAddOns)) {
        item.selectedAddOns.forEach((a: any) => extrasCost += (Number(a.price) || 0));
      }

      const itemTruePrice = dbItem.price + extrasCost;
      const quantity = item.quantity || 1;
      calculatedTotal += (itemTruePrice * quantity);

      serverItems.push({
        ...item,
        price: itemTruePrice, // Overwrite with server truth
        name: dbItem.name     // Overwrite with server truth
      });
    }

    // ─── 3. Minimum Order Enforcement ───
    if (dbRestaurant.min_order && calculatedTotal < dbRestaurant.min_order) {
      return new Response(JSON.stringify({ error: `Order subtotal does not meet the restaurant minimum of $${dbRestaurant.min_order.toFixed(2)}.` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── 4. Construct Final Payload ───
    const deliveryFee = dbRestaurant.delivery_fee || 1.5;

    // Completely overwrite client payload with trusted server calculations
    orderPayload.total_price = calculatedTotal + deliveryFee;
    orderPayload.delivery_fee = deliveryFee;
    orderPayload.restaurant_name = dbRestaurant.name;
    orderPayload.items = serverItems;

    // ─── 4.5 Mobile Money Payment Intent ───
    if (["EVC Plus", "Zaad", "Sahal"].includes(orderPayload.payment_method)) {
      orderPayload.status = 'Pending'; // Simulated Payment Success since we don't have API keys
      // TODO: In production, trigger HTTP request to telecom carrier here
    } else {
      orderPayload.status = 'Pending'; // Cash on Delivery
    }

    // ─── 5. Insert Validated Order ───
    const { data: newOrder, error: insertError } = await supabaseClient
      .from('orders')
      .insert([orderPayload])
      .select()
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Failed to insert order into database: ' + insertError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── 6. Insert Order Items (Normalization) ───
    const orderItemsPayload = serverItems.map(item => ({
      order_id: newOrder.id,
      food_item_id: String(item.id || item.food_id || item.food_item_id),
      name: item.name,
      quantity: item.quantity || 1,
      price: item.price,
      options: {
        variant: item.selectedVariant || null,
        addons: item.selectedAddOns || []
      }
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      console.warn("Failed to insert order items:", itemsError);
      // We still return success since the main order exists with 'items' JSON payload.
    }

    return new Response(JSON.stringify({ data: newOrder }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
