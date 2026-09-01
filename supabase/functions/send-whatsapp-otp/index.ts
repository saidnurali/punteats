import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    // ─── INPUT VALIDATION ───
    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing phone or otp parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SECRETS: Read from Supabase Edge Function secrets (NOT hardcoded) ───
    const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';

    if (!PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in Edge Function secrets');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error — WhatsApp credentials not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure phone has proper international format without '+' or spaces (e.g. 252904678886)
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('252') && cleanPhone.length === 9) {
      cleanPhone = '252' + cleanPhone;
    }

    // Basic phone number validation
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct Text Message Payload
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
