/* ============================================================
   wear.TAM — Delete Account Netlify Function
   POST /.netlify/functions/delete-account
   Authorization: Bearer <supabase_access_token>

   Verifies the caller's JWT, deletes all their data from
   profiles / measurements / orders, then removes the auth user.
   SUPABASE_SERVICE_ROLE_KEY must be set as a Netlify env var.
   It must NEVER be in any frontend JS file.
============================================================ */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL             = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  // Extract Bearer token from Authorization header
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No token provided' }) }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars')
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) }
  }

  // Admin client — has full access, used only server-side
  const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Verify the token and get the user
  const { data: { user }, error: userError } = await adminDb.auth.getUser(token)

  if (userError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) }
  }

  const userId = user.id

  try {
    // Delete user data in order (child rows first)
    await adminDb.from('measurements').delete().eq('user_id', userId)
    await adminDb.from('orders').delete().eq('user_id', userId)
    await adminDb.from('profiles').delete().eq('id', userId)

    // Delete the auth user last
    const { error: deleteError } = await adminDb.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    }
  } catch (err) {
    console.error('Delete account error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete account. Please try again.' })
    }
  }
}
