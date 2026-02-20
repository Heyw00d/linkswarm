/**
 * LinkSwarm Waitlist Worker
 * Cloudflare Worker to handle form submissions → Neon
 * 
 * Deploy: wrangler deploy
 * Set secret: wrangler secret put NEON_CONNECTION_STRING
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const { email, source = 'website' } = await request.json();
      
      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert into Neon via HTTP API
      const response = await fetch(`https://${env.NEON_HOST}/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.NEON_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'INSERT INTO waitlist (email, source) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id',
          params: [email, source]
        })
      });

      if (!response.ok) {
        throw new Error('Database error');
      }

      // Post to Discord signups channel
      if (env.DISCORD_SIGNUPS_WEBHOOK) {
        await fetch(env.DISCORD_SIGNUPS_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '📧 New Waitlist Signup',
              color: 0x10B981,
              fields: [
                { name: 'Email', value: email, inline: true },
                { name: 'Source', value: source, inline: true }
              ],
              timestamp: new Date().toISOString()
            }]
          })
        }).catch(() => {}); // Don't fail if Discord is down
      }

      return new Response(JSON.stringify({ success: true, email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
