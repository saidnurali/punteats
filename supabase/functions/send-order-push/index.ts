// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // This function is expected to be called via a Database Webhook on the `orders` table
    const payload = await req.json();
    
    // Check if it's an UPDATE event and if the status changed
    if (payload.type === 'UPDATE' && payload.table === 'orders') {
      const oldStatus = payload.old_record.status;
      const newStatus = payload.record.status;

      // We only want to send notifications for specific status changes
      if (oldStatus !== newStatus && ['preparing', 'out for delivery', 'delivered'].includes(newStatus?.toLowerCase())) {
        
        const userId = payload.record.user_id;
        if (!userId) {
          throw new Error('No user_id found on the order record');
        }

        // Fetch the user's expo_push_token from the profiles table
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('expo_push_token')
          .eq('id', userId)
          .single();

        if (profileError || !profile?.expo_push_token) {
          console.log(`No push token found for user ${userId}. Skipping notification.`);
          return new Response(JSON.stringify({ success: true, message: 'No token found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        let title = 'Order Update';
        let body = `Your order status changed to ${newStatus}`;

        if (newStatus?.toLowerCase() === 'preparing') {
          title = '👨‍🍳 Preparing your food!';
          body = 'The restaurant has accepted your order and is preparing it now.';
        } else if (newStatus?.toLowerCase() === 'out for delivery') {
          title = '🛵 Order is on the way!';
          body = 'Your driver has picked up your food and is heading your way.';
        } else if (newStatus?.toLowerCase() === 'delivered') {
          title = '✅ Order Delivered!';
          body = 'Your food has arrived. Enjoy your meal from PuntEats!';
        }

        // Send push notification using Expo Push API
        const pushMessage = {
          to: profile.expo_push_token,
          sound: 'default',
          title: title,
          body: body,
          data: { orderId: payload.record.id, status: newStatus },
        };

        const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushMessage),
        });

        const expoResult = await expoResponse.json();
        console.log('Expo Push API Response:', expoResult);

        return new Response(JSON.stringify({ success: true, expoResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        return new Response(JSON.stringify({ success: true, message: 'Status did not change to a notifyable state' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid payload type' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
