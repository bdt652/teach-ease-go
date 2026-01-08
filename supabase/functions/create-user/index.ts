import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Log IP address for security monitoring
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown'
  console.log('Create user function called from IP:', clientIP)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Extract the token from Bearer header
    const token = authHeader.replace('Bearer ', '')

    // Create admin client to verify the user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the JWT token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      console.error('Auth error:', userError)
      throw new Error('Unauthorized - Invalid token')
    }

    // Check if user is admin or teacher
    // Check if user is admin or teacher
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    const { data: isTeacher } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'teacher'
    })

    if (!isAdmin && !isTeacher) {
      throw new Error('Only admins and teachers can create users')
    }

    // Parse request body
    const { email, password, fullName, role } = await req.json()

    // Teachers can only create student accounts
    if (!isAdmin && isTeacher && role && role !== 'student') {
      throw new Error('Teachers can only create student accounts')
    }

    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    console.log(`User ${user.email} creating user: ${email}`)

    // Create user with admin client
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null
      }
    })

    if (createError) {
      console.error('Create user error:', createError)
      throw new Error(createError.message)
    }

    console.log(`User created: ${newUser.user.id}`)

    // If role is specified, add it
    if (role && newUser.user) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: role
        })

      if (roleError) {
        console.error('Add role error:', roleError)
        // User created but role failed - still return success
      } else {
        console.log(`Role ${role} added for user ${newUser.user.id}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
