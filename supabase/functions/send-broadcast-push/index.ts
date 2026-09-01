import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── AUTHORIZATION: Verify caller is an authenticated admin ───
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables")
    }

    // Create a client using the caller's JWT to verify their identity
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify admin role from the profiles table (server-side — never trust client claims)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin role required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // ─── PAYLOAD VALIDATION ───
    const { title, body } = await req.json()

    if (!title || !body || typeof title !== 'string' || typeof body !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid title/body in request payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Enforce reasonable length limits to prevent abuse
    if (title.length > 200 || body.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Title or body exceeds maximum length' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // ─── FETCH PUSH TOKENS (using service role) ───
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token')
      .not('expo_push_token', 'is', null)

    if (error) {
      throw error
    }

    // Clean and filter tokens
    const tokens = profiles
      .map(p => p.expo_push_token)
      .filter(token => typeof token === 'string' && token.startsWith('ExponentPushToken['))

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No valid push tokens found in profiles table." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // ─── SEND PUSH NOTIFICATIONS ───
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      priority: 'high',
    }))

    // Expo Push API allows up to 100 messages per request. Chunk the array.
    const chunkArray = (arr: any[], size: number) => 
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      )
    
    const chunks = chunkArray(messages, 100)
    let totalSent = 0
    let errors: any[] = []

    for (const chunk of chunks) {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk)
      })
      
      const receipt = await expoRes.json()
      
      if (receipt?.data) {
        totalSent += receipt.data.length
      }
      if (receipt?.errors) {
        errors.push(...receipt.errors)
      }
    }

    // ─── AUDIT LOG: Record the admin action ───
    try {
      await supabaseAdmin.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'broadcast_push',
        metadata: { 
          title,
          devices_targeted: tokens.length,
          total_sent: totalSent 
        },
      })
    } catch (auditErr) {
      // Non-blocking: audit table may not exist yet
      console.warn('Audit log insert failed (table may not exist):', auditErr)
    }

    return new Response(
      JSON.stringify({ 
        message: `Broadcast push sent successfully!`, 
        devices_targeted: tokens.length,
        total_sent: totalSent,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})
