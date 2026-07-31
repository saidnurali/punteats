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
    const { title, body } = await req.json()

    if (!title || !body) {
      throw new Error("Missing title or body in request payload")
    }

    // Initialize Supabase Client with Admin privileges to read all profiles
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables")
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all profiles with valid expo_push_token
    const { data: profiles, error } = await supabase
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

    // Construct Expo Push payloads
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
    let errors = []

    // Send chunks to Expo Push Service
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
