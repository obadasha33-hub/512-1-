import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { vaultId, senderId, title, body, data, imageUrl } = await req.json()

    if (!vaultId || !senderId) {
      return new Response(
        JSON.stringify({ error: 'vaultId and senderId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('DB_URL')!
    const supabaseKey = Deno.env.get('DB_SERVICE_KEY')!
    const fcmProjectId = Deno.env.get('FCM_PROJECT_ID')!
    const fcmClientEmail = Deno.env.get('FCM_CLIENT_EMAIL')!
    const fcmPrivateKey = Deno.env.get('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get device tokens for this vault, excluding sender
    const { data: tokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('fcm_token, user_id, platform')
      .eq('vault_id', vaultId)
      .neq('user_id', senderId)

    if (tokenError || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: 'no recipients' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate FCM access token
    const now = Math.floor(Date.now() / 1000)
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({
      iss: fcmClientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }))
    const signatureBuf = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      await crypto.subtle.importKey(
        'pkcs8',
        pemToBinary(fcmPrivateKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new TextEncoder().encode(`${header}.${payload}`)
    )
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuf)))
    const jwt = `${header}.${payload}.${signature}`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    const { access_token } = await tokenRes.json()

    // Send push to each device
    let sent = 0
    for (const token of tokens) {
      const fcmBody = {
        message: {
          token: token.fcm_token,
          notification: { title, body },
          data: data || {},
          android: {
            priority: 'high',
            notification: {
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              sound: 'default',
              ...(imageUrl && { image: imageUrl }),
            },
          },
          apns: {
            payload: {
              aps: {
                alert: { title, body },
                sound: 'default',
              },
            },
          },
        },
      }

      const pushRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmBody),
        }
      )

      if (pushRes.ok) sent++
      else {
        const errText = await pushRes.text()
        console.error(`FCM push failed for ${token.user_id}:`, errText)
        // Clean up invalid tokens
        if (errText.includes('NOT_FOUND') || errText.includes('UNREGISTERED')) {
          await supabase
            .from('device_tokens')
            .delete()
            .eq('fcm_token', token.fcm_token)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Push notification error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function pemToBinary(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
