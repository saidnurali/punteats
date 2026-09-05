// send-otp
// Generates a 6-digit OTP server-side, hashes it, stores it with a short
// expiry, and sends it via the approved WhatsApp "punteats_otp" Utility
// template. The plain code is NEVER returned to the caller.
//
// Required secrets (supabase secrets set KEY=value):
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID  (already set — reused
//   from the old send-whatsapp-otp function)
//   OTP_HASH_PEPPER   <- new: generate once with `openssl rand -hex 32`

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_REQUESTS_PER_PHONE_PER_HOUR = 5;
const OTP_TTL_MINUTES = 10;

function normalizePhone(raw: string): string {
  let cleaned = raw.replace(/\D/g, '');
  if (!cleaned.startsWith('252') && cleaned.length === 9) cleaned = '252' + cleaned;
  return cleaned;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    if (!phone) throw new Error('Missing phone');

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid phone number format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pepper = Deno.env.get('OTP_HASH_PEPPER') ?? '';
    if (!pepper) {
      console.error('OTP_HASH_PEPPER secret is not set');
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey);

    // Rate limit: max 5 OTP requests per phone per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('otp_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('phone', cleanPhone)
      .gt('created_at', oneHourAgo);

    if ((count ?? 0) >= MAX_REQUESTS_PER_PHONE_PER_HOUR) {
      return new Response(JSON.stringify({ success: false, error: 'Too many code requests. Try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a real 6-digit code — never sent back to the caller
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await sha256Hex(code + pepper);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Invalidate any previous outstanding codes for this phone (single active code at a time)
    await admin.from('otp_verifications').delete().eq('phone', cleanPhone);

    const { error: insertError } = await admin.from('otp_verifications').insert({
      phone: cleanPhone, code_hash: codeHash, expires_at: expiresAt, attempts: 0,
    });
    if (insertError) throw insertError;

    // Send via the approved WhatsApp Utility template "punteats_otp"
    // Body: "Ku soo dhawaaw PuntEats. Lambarkaaga dalabka waa {{1}}. Mahadsanid."
    const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';
    if (!PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error('Missing WhatsApp credentials in Edge Function secrets');
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const waPayload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: 'punteats_otp',
        language: { code: 'en' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
      },
    };

    const waRes = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(waPayload),
    });
    const waData = await waRes.json();

    if (!waRes.ok) {
      console.error('WhatsApp send failed:', waData);
      // Clean up the stored OTP since delivery failed — don't leave an
      // active code the user can never receive.
      await admin.from('otp_verifications').delete().eq('phone', cleanPhone);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send verification code. Please try again.', detail: waData }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deliberately no `code` field anywhere in this response.
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('send-otp error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
