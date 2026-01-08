import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface LogEntry {
  timestamp: string
  userId?: string
  userEmail?: string
  action: string
  details?: any
  page?: string
  userAgent?: string
  ipAddress?: string
  sessionId?: string
  environment?: string
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body: LogEntry = await req.json()

    // Validate required fields
    if (!body.action || !body.timestamp) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get client IP
    const clientIP = req.headers.get('x-forwarded-for') ||
                    req.headers.get('cf-connecting-ip') ||
                    'unknown'

    // Insert log into database
    const { error } = await supabase
      .from('user_action_logs')
      .insert({
        user_id: body.userId || null,
        user_email: body.userEmail || null,
        action: body.action,
        details: body.details || {},
        page: body.page || null,
        user_agent: body.userAgent || null,
        ip_address: body.ipAddress || clientIP,
        session_id: body.sessionId || null,
        environment: body.environment || 'production',
        timestamp: body.timestamp
      })

    if (error) {
      console.error('Failed to insert log:', error)
      return new Response(JSON.stringify({ error: 'Failed to save log' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Log endpoint error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
