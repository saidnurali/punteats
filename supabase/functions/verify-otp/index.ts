// verify-otp
// Verifies a code against the server-stored hash, then creates/logs in
// the corresponding Supabase Auth user with a freshly-generated random
// password (never phone-derived, never reused) and returns a real
// access/refresh token pair. The client calls supabase.auth.setSession()
// with these — no bypass codes, no client-side comparison, ever.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;

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

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'Px_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, code, full_name } = await req.json();
    if (!phone || !code) throw new Error('Missing phone or code');

    const cleanPhone = normalizePhone(phone);
    const pepper = Deno.env.get('OTP_HASH_PEPPER') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: otpRow, error: otpFetchError } = await admin
      .from('otp_verifications')
      .select('*')
      .eq('phone', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpFetchError || !otpRow) {
      return new Response(JSON.stringify({ success: false, error: 'No pending code for this number. Request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      await admin.from('otp_verifications').delete().eq('id', otpRow.id);
      return new Response(JSON.stringify({ success: false, error: 'Code expired. Request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (otpRow.attempts >= MAX_ATTEMPTS) {
      await admin.from('otp_verifications').delete().eq('id', otpRow.id);
      return new Response(JSON.stringify({ success: false, error: 'Too many incorrect attempts. Request a new code.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const submittedHash = await sha256Hex(String(code) + pepper);
    if (submittedHash !== otpRow.code_hash) {
      await admin.from('otp_verifications').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id);
      return new Response(JSON.stringify({ success: false, error: 'Incorrect code.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Code correct — consume it immediately (single use)
    await admin.from('otp_verifications').delete().eq('id', otpRow.id);

    // Find-or-create the Auth user for this phone, using a fresh random
    // password each time — never derived from the phone number.
    const fullPhoneWithPlus = '+' + cleanPhone;
    const fakeEmail = `${cleanPhone}@punteats.com`;
    const freshPassword = randomPassword();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('phone_number', fullPhoneWithPlus)
      .maybeSingle();

    let userId: string;

    if (existingProfile?.id) {
      userId = existingProfile.id;
      const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password: freshPassword });
      if (pwError) throw pwError;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: fakeEmail,
        password: freshPassword,
        email_confirm: true,
      });
      if (createError || !created?.user) throw createError ?? new Error('Failed to create user');
      userId = created.user.id;

      await admin.from('profiles').upsert({
        id: userId,
        phone_number: fullPhoneWithPlus,
        full_name: full_name || 'Customer',
      });
    }

    // Exchange the fresh password for a real session
    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fakeEmail, password: freshPassword }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData?.access_token) {
      console.error('Token exchange failed:', tokenData);
      throw new Error('Failed to establish session');
    }

    return new Response(JSON.stringify({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('verify-otp error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
