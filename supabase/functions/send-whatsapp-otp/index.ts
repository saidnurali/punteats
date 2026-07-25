import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHONE_NUMBER_ID = '1227157970480424';
const WHATSAPP_ACCESS_TOKEN = 'EAIRwTT7bXSsBSIaYXWGvDJzZACA6yOgvxCqR00hCzZB5KXhQGDbMh4WRRZB6HxoNIrx1tT9PH0g5fY9BrwLwr1xjqdAVcllbPzZAQuYsLd9TlOOyBDicmQ9095hyu1VlIZA7oPnUOKRm419pGJe5szczfv2DZBhTtNre1wMq2YIRoLey3Uh9JmVNZAEvDU3norG85S08GdkDi0PWWntnZBPJMKvu3iGImb6NPeHoUqRHuI61mvf2brj6e2lDvC2FZB9yebxBXZAwMwewjGKZBNkuShW';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    // Ensure phone has proper international format without '+' or spaces (e.g. 252904678886)
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('252') && cleanPhone.length === 9) {
      cleanPhone = '252' + cleanPhone;
    }

    // Direct Text Message Payload (NO TEMPLATE NEEDED!)
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: `🔐 Your PuntGo verification code is: ${otp}. Do not share this code with anyone.`
      }
    };

    // Call Meta WhatsApp Cloud API
    const response = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const metaData = await response.json();

    if (!response.ok) {
      console.error('Meta API Error:', metaData);
      return new Response(
        JSON.stringify({ success: false, error: metaData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: metaData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
