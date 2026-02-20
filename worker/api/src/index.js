/**
 * LinkSwarm API Worker
 * Full API implementation for link exchange network
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { neon } from '@neondatabase/serverless';

const app = new Hono();

// Helper to get SQL client
function getDb(env) {
  return neon(env.DATABASE_URL);
}

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Auth middleware helper
async function requireAuth(c, next) {
  const authHeader = c.req.header('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : c.req.header('X-API-Key');
    
  if (!apiKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const sql = getDb(c.env);
  const [user] = await sql`SELECT * FROM api_keys WHERE api_key = ${apiKey} AND email_verified = true`;
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  c.set('user', user);
  c.set('userEmail', user.email);
  return next();
}

// Admin auth
async function requireAdmin(c, next) {
  const password = c.req.header('X-Admin-Password') || c.req.query('admin_password');
  if (password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Unauthorized - Admin required' }, 401);
  }
  return next();
}

// ============ ROOT / HEALTH ============

app.get('/', (c) => c.json({
  error: 'Not found',
  endpoints: [
    '/registry', '/waitlist', '/dashboard',
    '/v1/sites', '/v1/discover',
    '/v1/pool/contribute', '/v1/pool/request', '/v1/pool/status',
    '/v1/credits', '/v1/webhooks',
    '/v1/listing/intake', '/v1/listing/submit', '/v1/listing/progress',
    '/v1/gsc/connect', '/v1/gsc/sites', '/v1/gsc/performance', '/v1/gsc/backlink-impact'
  ]
}));

app.get('/health', (c) => c.json({ status: 'ok', service: 'linkswarm-api' }));

// ============ PUBLIC: REGISTRY ============

app.get('/registry', async (c) => {
  const sql = getDb(c.env);
  const sites = await sql`
    SELECT domain, name, description, categories, reputation, verified, created_at
    FROM sites 
    WHERE verified = true
    ORDER BY created_at DESC
  `;
  return c.json({ count: sites.length, sites });
});

// ============ ADMIN: WAITLIST ============

app.get('/waitlist', requireAdmin, async (c) => {
  const sql = getDb(c.env);
  const entries = await sql`SELECT * FROM waitlist ORDER BY created_at DESC`;
  return c.json(entries);
});

app.post('/waitlist', async (c) => {
  const { email, source = 'website' } = await c.req.json();
  
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Invalid email' }, 400);
  }
  
  const sql = getDb(c.env);
  await sql`INSERT INTO waitlist (email, source) VALUES (${email}, ${source}) ON CONFLICT (email) DO NOTHING`;
  
  // Discord notification
  if (c.env.DISCORD_SIGNUPS_WEBHOOK) {
    fetch(c.env.DISCORD_SIGNUPS_WEBHOOK, {
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
    }).catch(() => {});
  }
  
  return c.json({ success: true, email });
});

// ============ ADMIN: DASHBOARD ============

app.get('/dashboard', requireAdmin, async (c) => {
  const sql = getDb(c.env);
  
  const [siteCount] = await sql`SELECT COUNT(*) as count FROM sites WHERE verified = true`;
  const [userCount] = await sql`SELECT COUNT(*) as count FROM api_keys WHERE email_verified = true`;
  const [exchangeCount] = await sql`SELECT COUNT(*) as count FROM exchanges`;
  const [pendingCount] = await sql`SELECT COUNT(*) as count FROM exchanges WHERE status = 'pending'`;
  const [completedCount] = await sql`SELECT COUNT(*) as count FROM exchanges WHERE status = 'completed'`;
  const recentSites = await sql`SELECT domain, name, created_at FROM sites ORDER BY created_at DESC LIMIT 5`;
  const recentExchanges = await sql`SELECT * FROM exchanges ORDER BY created_at DESC LIMIT 10`;
  
  return c.json({
    stats: {
      sites: siteCount?.count || 0,
      users: userCount?.count || 0,
      exchanges: exchangeCount?.count || 0,
      pending: pendingCount?.count || 0,
      completed: completedCount?.count || 0
    },
    recentSites,
    recentExchanges
  });
});

// ============ REGISTRATION ============

app.post('/api/register', async (c) => {
  const { email, domain } = await c.req.json();
  
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Invalid email' }, 400);
  }
  
  const sql = getDb(c.env);
  
  // Check if already registered
  const [existing] = await sql`SELECT * FROM api_keys WHERE email = ${email}`;
  if (existing) {
    return c.json({ 
      error: 'Email already registered',
      apiKey: existing.api_key 
    }, 409);
  }
  
  // Generate API key
  const apiKey = 'sk_linkswarm_' + crypto.randomUUID().replace(/-/g, '');
  const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  await sql`
    INSERT INTO api_keys (email, api_key, verification_code, code_expires_at, email_verified)
    VALUES (${email}, ${apiKey}, ${verificationCode}, ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}, false)
  `;
  
  // TODO: Send verification email
  
  return c.json({ 
    success: true,
    apiKey,
    message: 'Check your email for verification code'
  });
});

app.post('/api/verify', async (c) => {
  const { email, code } = await c.req.json();
  const sql = getDb(c.env);
  
  const [user] = await sql`
    SELECT * FROM api_keys 
    WHERE email = ${email} 
    AND verification_code = ${code}
    AND code_expires_at > NOW()
  `;
  
  if (!user) {
    return c.json({ error: 'Invalid or expired code' }, 400);
  }
  
  await sql`UPDATE api_keys SET email_verified = true, verification_code = NULL WHERE email = ${email}`;
  
  return c.json({ success: true, apiKey: user.api_key });
});

// ============ SITES ============

app.get('/v1/sites', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const sites = await sql`
    SELECT * FROM sites WHERE owner_email = ${userEmail} ORDER BY created_at DESC
  `;
  
  return c.json({ sites });
});

app.post('/v1/sites', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const body = await c.req.json();
  const { domain, name, description, categories } = body;
  
  if (!domain) {
    return c.json({ error: 'Domain required' }, 400);
  }
  
  const sql = getDb(c.env);
  
  // Check if domain exists
  const [existing] = await sql`SELECT * FROM sites WHERE domain = ${domain}`;
  if (existing) {
    return c.json({ error: 'Domain already registered' }, 409);
  }
  
  // Generate verification token
  const verificationToken = crypto.randomUUID();
  
  await sql`
    INSERT INTO sites (owner_email, domain, name, description, categories, verification_token, verified)
    VALUES (${userEmail}, ${domain}, ${name || domain}, ${description || ''}, ${categories || []}, ${verificationToken}, false)
  `;
  
  return c.json({ 
    success: true,
    domain,
    verificationToken,
    verifyInstructions: `Add a TXT record with value: linkswarm-verify=${verificationToken}`
  });
});

app.post('/v1/sites/:domain/verify', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const domain = c.req.param('domain');
  const sql = getDb(c.env);
  
  // For now, auto-verify (in production, check DNS)
  await sql`UPDATE sites SET verified = true WHERE domain = ${domain} AND owner_email = ${userEmail}`;
  
  return c.json({ success: true, verified: true });
});

// ============ DISCOVER ============

app.get('/v1/discover', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  // Get user's sites
  const userSites = await sql`SELECT domain, categories FROM sites WHERE owner_email = ${userEmail}`;
  const userDomains = userSites.map(s => s.domain);
  const userCategories = [...new Set(userSites.flatMap(s => s.categories || []))];
  
  // Find matching sites (excluding user's own)
  let matches;
  if (userCategories.length > 0) {
    matches = await sql`
      SELECT domain, name, description, categories, reputation, etv, quality_score
      FROM sites 
      WHERE verified = true 
      AND owner_email != ${userEmail}
      AND categories && ${userCategories}
      ORDER BY quality_score DESC, reputation DESC
      LIMIT 20
    `;
  } else {
    matches = await sql`
      SELECT domain, name, description, categories, reputation, etv, quality_score
      FROM sites 
      WHERE verified = true AND owner_email != ${userEmail}
      ORDER BY quality_score DESC, reputation DESC
      LIMIT 20
    `;
  }
  
  return c.json({ matches, userCategories });
});

// ============ POOL: CONTRIBUTE ============

app.post('/v1/pool/contribute', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const body = await c.req.json();
  const { domain, page, max_links = 1, categories, context } = body;
  
  const sql = getDb(c.env);
  
  // Verify site ownership
  const [site] = await sql`SELECT * FROM sites WHERE domain = ${domain} AND owner_email = ${userEmail}`;
  if (!site) {
    return c.json({ error: 'Site not found or not owned by you' }, 403);
  }
  if (!site.verified) {
    return c.json({ error: 'Site not verified' }, 403);
  }
  
  // Create contribution
  const [contribution] = await sql`
    INSERT INTO link_contributions (site_domain, owner_email, page_url, max_links, categories, context, status)
    VALUES (${domain}, ${userEmail}, ${page || '/'}, ${max_links}, ${categories || site.categories}, ${context || ''}, 'available')
    RETURNING id
  `;
  
  // Award credit
  const [balance] = await sql`
    INSERT INTO credit_balances (user_email, balance, lifetime_earned)
    VALUES (${userEmail}, 1, 1)
    ON CONFLICT (user_email) DO UPDATE 
    SET balance = credit_balances.balance + 1, lifetime_earned = credit_balances.lifetime_earned + 1
    RETURNING balance
  `;
  
  // Log transaction
  await sql`
    INSERT INTO credit_transactions (user_email, amount, type, reference_type, reference_id, description, balance_after)
    VALUES (${userEmail}, 1, 'earn', 'contribution', ${contribution.id}, 'Link contribution', ${balance.balance})
  `;
  
  return c.json({
    success: true,
    contribution_id: contribution.id,
    credits_earned: 1,
    new_balance: balance.balance
  });
});

// ============ POOL: REQUEST ============

app.post('/v1/pool/request', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const body = await c.req.json();
  const { domain, target_page, preferred_anchor, categories } = body;
  
  const sql = getDb(c.env);
  
  // Check balance
  const [balance] = await sql`SELECT balance FROM credit_balances WHERE user_email = ${userEmail}`;
  if (!balance || balance.balance < 1) {
    return c.json({ error: 'Insufficient credits. Contribute a link first.' }, 402);
  }
  
  // Verify site ownership
  const [site] = await sql`SELECT * FROM sites WHERE domain = ${domain} AND owner_email = ${userEmail}`;
  if (!site) {
    return c.json({ error: 'Site not found or not owned by you' }, 403);
  }
  
  // Create request
  const [request] = await sql`
    INSERT INTO link_requests (site_domain, owner_email, target_page, preferred_anchor, categories, status)
    VALUES (${domain}, ${userEmail}, ${target_page || '/'}, ${preferred_anchor || ''}, ${categories || site.categories}, 'pending')
    RETURNING id
  `;
  
  // Try to find a match
  const siteCategories = categories || site.categories || [];
  const [contribution] = await sql`
    SELECT * FROM link_contributions 
    WHERE status = 'available' 
    AND owner_email != ${userEmail}
    AND categories && ${siteCategories}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  
  let match = null;
  if (contribution) {
    // Create placement
    const relevanceScore = 0.8; // Simplified - would calculate based on embeddings
    
    const [placement] = await sql`
      INSERT INTO link_placements (
        contribution_id, request_id, from_domain, from_page, to_domain, to_page, 
        anchor_text, relevance_score, status
      ) VALUES (
        ${contribution.id}, ${request.id}, ${contribution.site_domain}, ${contribution.page_url},
        ${domain}, ${target_page || '/'}, ${preferred_anchor || site.name || domain}, 
        ${relevanceScore}, 'assigned'
      )
      RETURNING id
    `;
    
    // Update contribution
    await sql`UPDATE link_contributions SET status = 'matched', links_placed = links_placed + 1 WHERE id = ${contribution.id}`;
    
    // Update request
    await sql`UPDATE link_requests SET status = 'matched', fulfilled_by = ${placement.id} WHERE id = ${request.id}`;
    
    // Deduct credit
    await sql`UPDATE credit_balances SET balance = balance - 1, lifetime_spent = lifetime_spent + 1 WHERE user_email = ${userEmail}`;
    const [newBalance] = await sql`SELECT balance FROM credit_balances WHERE user_email = ${userEmail}`;
    
    await sql`
      INSERT INTO credit_transactions (user_email, amount, type, reference_type, reference_id, description, balance_after)
      VALUES (${userEmail}, -1, 'spend', 'request', ${request.id}, 'Link request matched', ${newBalance.balance})
    `;
    
    match = {
      placement_id: placement.id,
      from_domain: contribution.site_domain,
      from_page: contribution.page_url,
      relevance_score: relevanceScore
    };
    
    // Send match notification
    await sendMatchNotification(c.env, sql, contribution, site, preferred_anchor, target_page);
  }
  
  return c.json({
    success: true,
    request_id: request.id,
    status: match ? 'matched' : 'pending',
    match
  });
});

// Send match notification email
async function sendMatchNotification(env, sql, contribution, targetSite, anchor, targetPage) {
  const [contributor] = await sql`SELECT email, notify_matches FROM api_keys WHERE email = ${contribution.owner_email}`;
  if (!contributor || !contributor.notify_matches) return;
  
  // Get contributor's site info for the notification
  const [fromSite] = await sql`SELECT name, domain FROM sites WHERE domain = ${contribution.site_domain}`;
  
  // Build email - FIX: Use proper field access
  const fromDomain = fromSite?.domain || contribution.site_domain;
  const fromPage = contribution.page_url || '/';
  const toDomain = targetSite?.domain || 'Unknown';
  const toPage = targetPage || '/';
  const anchorText = anchor || targetSite?.name || toDomain;
  
  const emailBody = `
🔗 New LinkSwarm Match!

You have a new link exchange opportunity:

From: ${fromDomain}
Page: ${fromPage}

To: ${toDomain}${toPage}
Anchor: "${anchorText}"

Action Required:
Please add the following link to your page at ${fromDomain}${fromPage}:

<a href="https://${toDomain}${toPage}">${anchorText}</a>

Once placed, confirm at: https://linkswarm.ai/dashboard

---
LinkSwarm - Fair link exchanges
  `.trim();
  
  // Post to Discord exchanges webhook
  if (env.DISCORD_WEBHOOK_URL) {
    fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🔗 New Link Match',
          color: 0x6366F1,
          fields: [
            { name: 'From', value: `${fromDomain}${fromPage}`, inline: true },
            { name: 'To', value: `${toDomain}${toPage}`, inline: true },
            { name: 'Anchor', value: anchorText, inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {});
  }
  
  // TODO: Send actual email via SMTP
  console.log('Match notification:', { to: contributor.email, body: emailBody });
}

// ============ POOL: STATUS ============

app.get('/v1/pool/status', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const [credits] = await sql`SELECT * FROM credit_balances WHERE user_email = ${userEmail}`;
  const contributions = await sql`SELECT * FROM link_contributions WHERE owner_email = ${userEmail}`;
  const requests = await sql`SELECT * FROM link_requests WHERE owner_email = ${userEmail}`;
  const placements = await sql`
    SELECT p.*, lc.site_domain as contributor_domain
    FROM link_placements p
    JOIN link_contributions lc ON p.contribution_id = lc.id
    WHERE lc.owner_email = ${userEmail}
    ORDER BY p.assigned_at DESC
  `;
  
  return c.json({
    credits: credits || { balance: 0, lifetime_earned: 0, lifetime_spent: 0 },
    contributions: contributions.length,
    requests: requests.length,
    pendingPlacements: placements.filter(p => p.status === 'assigned').length,
    completedPlacements: placements.filter(p => p.status === 'verified').length,
    placements
  });
});

// ============ POOL: CONFIRM ============

app.post('/v1/pool/confirm', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const { placement_id } = await c.req.json();
  const sql = getDb(c.env);
  
  // Get placement
  const [placement] = await sql`
    SELECT p.*, lc.owner_email as contributor_email
    FROM link_placements p
    JOIN link_contributions lc ON p.contribution_id = lc.id
    WHERE p.id = ${placement_id}
  `;
  
  if (!placement) {
    return c.json({ error: 'Placement not found' }, 404);
  }
  
  if (placement.contributor_email !== userEmail) {
    return c.json({ error: 'Not your placement' }, 403);
  }
  
  // Update status
  await sql`UPDATE link_placements SET status = 'placed', placed_at = NOW() WHERE id = ${placement_id}`;
  
  // Block reciprocal for 30 days
  const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO reciprocal_blocks (domain_a, domain_b, blocked_until)
    VALUES (${placement.from_domain}, ${placement.to_domain}, ${blockedUntil.toISOString()})
    ON CONFLICT (domain_a, domain_b) DO UPDATE SET blocked_until = ${blockedUntil.toISOString()}
  `;
  
  return c.json({
    success: true,
    message: 'Placement confirmed. Verification will run within 24 hours.',
    reciprocal_blocked_until: blockedUntil.toISOString()
  });
});

// ============ PLACEMENTS ============

app.get('/v1/placements/pending', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const placements = await sql`
    SELECT 
      p.id as placement_id,
      p.from_domain, p.from_page, p.to_domain, p.to_page,
      p.anchor_text, p.relevance_score, p.status, p.assigned_at,
      lc.owner_email as contributor_email
    FROM link_placements p
    JOIN link_contributions lc ON p.contribution_id = lc.id
    WHERE lc.owner_email = ${userEmail} AND p.status = 'assigned'
    ORDER BY p.assigned_at ASC
  `;
  
  const formattedPlacements = placements.map(p => ({
    placement_id: p.placement_id,
    your_page: `${p.from_domain}${p.from_page}`,
    link_to: `https://${p.to_domain}${p.to_page}`,
    anchor_text: p.anchor_text,
    html_snippet: `<a href="https://${p.to_domain}${p.to_page}">${p.anchor_text}</a>`,
    relevance_score: p.relevance_score,
    confirm_endpoint: `/v1/pool/confirm`
  }));
  
  return c.json({ count: placements.length, placements: formattedPlacements });
});

app.post('/v1/placements/:id/verify', requireAuth, async (c) => {
  const placementId = c.req.param('id');
  const sql = getDb(c.env);
  
  const [placement] = await sql`SELECT * FROM link_placements WHERE id = ${parseInt(placementId)}`;
  if (!placement) {
    return c.json({ error: 'Placement not found' }, 404);
  }
  
  // In production, would fetch the page and check for the link
  // For now, mark as verified if status is 'placed'
  if (placement.status !== 'placed') {
    return c.json({ 
      verified: false, 
      status: placement.status,
      message: 'Placement not yet confirmed as placed'
    });
  }
  
  await sql`UPDATE link_placements SET status = 'verified', verified_at = NOW() WHERE id = ${parseInt(placementId)}`;
  
  return c.json({ verified: true, status: 'verified' });
});

// ============ CREDITS ============

app.get('/v1/credits', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const [balance] = await sql`SELECT * FROM credit_balances WHERE user_email = ${userEmail}`;
  const transactions = await sql`
    SELECT * FROM credit_transactions 
    WHERE user_email = ${userEmail} 
    ORDER BY created_at DESC 
    LIMIT 50
  `;
  
  return c.json({
    balance: balance || { balance: 0, lifetime_earned: 0, lifetime_spent: 0 },
    transactions
  });
});

// ============ WEBHOOKS ============

app.get('/v1/webhooks', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const webhooks = await sql`SELECT * FROM webhooks WHERE owner_email = ${userEmail}`;
  return c.json({ webhooks });
});

app.post('/v1/webhooks', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const body = await c.req.json();
  const { url, events, secret } = body;
  
  if (!url) {
    return c.json({ error: 'URL required' }, 400);
  }
  
  const sql = getDb(c.env);
  const webhookSecret = secret || crypto.randomUUID();
  
  const [webhook] = await sql`
    INSERT INTO webhooks (owner_email, url, secret, events, active)
    VALUES (${userEmail}, ${url}, ${webhookSecret}, ${events || ['link.opportunity', 'link.placed', 'link.verified']}, true)
    RETURNING id
  `;
  
  return c.json({ success: true, id: webhook.id, secret: webhookSecret });
});

// ============ LISTING: INTAKE ============

app.post('/v1/listing/intake', requireAuth, async (c) => {
  const body = await c.req.json();
  const sql = getDb(c.env);
  
  const {
    email, name, url, tagline, description_short, description_medium, description_long,
    category, subcategories, logo_square, logo_icon, screenshots,
    pricing_model, starting_price, launch_date, twitter, github, linkedin,
    alternatives, founders, package: pkg = 'package_1'
  } = body;
  
  if (!email || !name || !url) {
    return c.json({ error: 'Email, name, and URL required' }, 400);
  }
  
  await sql`
    INSERT INTO listing_clients (
      email, name, url, tagline, description_short, description_medium, description_long,
      category, subcategories, logo_square, logo_icon, screenshots,
      pricing_model, starting_price, launch_date, twitter, github, linkedin,
      alternatives, founders, package
    ) VALUES (
      ${email}, ${name}, ${url}, ${tagline || null}, ${description_short || null}, 
      ${description_medium || null}, ${description_long || null}, ${category || null}, 
      ${subcategories || []}, ${logo_square || null}, ${logo_icon || null}, ${screenshots || []},
      ${pricing_model || null}, ${starting_price || null}, ${launch_date || null},
      ${twitter || null}, ${github || null}, ${linkedin || null},
      ${alternatives || []}, ${founders ? JSON.stringify(founders) : null}, ${pkg}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = ${name}, url = ${url}, updated_at = NOW()
  `;
  
  return c.json({ success: true, email, name });
});

// ============ LISTING: SUBMIT ============

app.post('/v1/listing/submit', requireAuth, async (c) => {
  const body = await c.req.json();
  const { client_email, directory } = body;
  const sql = getDb(c.env);
  
  if (!client_email || !directory) {
    return c.json({ error: 'client_email and directory required' }, 400);
  }
  
  // Get client
  const [client] = await sql`SELECT * FROM listing_clients WHERE email = ${client_email}`;
  if (!client) {
    return c.json({ error: 'Client not found. Submit intake first.' }, 404);
  }
  
  // Check for duplicate
  const [existing] = await sql`
    SELECT * FROM listing_submissions 
    WHERE client_email = ${client_email} AND directory_slug = ${directory}
  `;
  if (existing) {
    return c.json({ error: 'Already submitted to this directory', submission_id: existing.id }, 409);
  }
  
  // Create submission
  const [submission] = await sql`
    INSERT INTO listing_submissions (client_email, client_name, directory_slug, status)
    VALUES (${client_email}, ${client.name}, ${directory}, 'pending')
    RETURNING id
  `;
  
  return c.json({ success: true, submission_id: submission.id });
});

// ============ LISTING: PROGRESS ============

app.get('/v1/listing/progress/:email', requireAuth, async (c) => {
  const email = decodeURIComponent(c.req.param('email'));
  const sql = getDb(c.env);
  
  const [client] = await sql`SELECT * FROM listing_clients WHERE email = ${email}`;
  if (!client) {
    return c.json({ error: 'Client not found' }, 404);
  }
  
  const submissions = await sql`
    SELECT * FROM listing_submissions WHERE client_email = ${email} ORDER BY created_at DESC
  `;
  
  const stats = {
    total_submissions: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length
  };
  
  const listing_urls = submissions
    .filter(s => s.listing_url)
    .map(s => ({ directory: s.directory_slug, url: s.listing_url }));
  
  return c.json({
    client: {
      name: client.name,
      website: client.url,
      category: client.category,
      package: client.package
    },
    ...stats,
    submissions,
    listing_urls
  });
});

// ============ LISTING: UPDATE SUBMISSION ============

app.patch('/v1/listing/submission/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const sql = getDb(c.env);
  
  const updates = [];
  const values = [];
  
  if (body.status) {
    updates.push('status');
    values.push(body.status);
  }
  if (body.listing_url) {
    updates.push('listing_url');
    values.push(body.listing_url);
  }
  if (body.notes) {
    updates.push('notes');
    values.push(body.notes);
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }
  
  await sql`
    UPDATE listing_submissions 
    SET status = COALESCE(${body.status}, status),
        listing_url = COALESCE(${body.listing_url}, listing_url),
        notes = COALESCE(${body.notes}, notes),
        updated_at = NOW()
    WHERE id = ${parseInt(id)}
  `;
  
  const [submission] = await sql`SELECT * FROM listing_submissions WHERE id = ${parseInt(id)}`;
  
  return c.json({ success: true, submission });
});

// ============ GSC ENDPOINTS (stubs) ============

app.get('/v1/gsc/connect', requireAuth, (c) => {
  return c.json({ 
    message: 'Redirect to Google OAuth',
    url: 'https://accounts.google.com/o/oauth2/v2/auth?...'
  });
});

app.get('/v1/gsc/sites', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const connections = await sql`SELECT * FROM gsc_connections WHERE user_email = ${userEmail}`;
  return c.json({ sites: connections.map(c => c.site_url) });
});

app.get('/v1/gsc/performance', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const siteUrl = c.req.query('site');
  const sql = getDb(c.env);
  
  const snapshots = await sql`
    SELECT * FROM gsc_snapshots 
    WHERE user_email = ${userEmail} 
    ${siteUrl ? sql`AND site_url = ${siteUrl}` : sql``}
    ORDER BY date_end DESC 
    LIMIT 30
  `;
  
  return c.json({ snapshots });
});

app.get('/v1/gsc/backlink-impact', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  // Get placements with GSC data
  const placements = await sql`
    SELECT 
      p.*, 
      gs_before.clicks as clicks_before,
      gs_after.clicks as clicks_after
    FROM link_placements p
    LEFT JOIN gsc_snapshots gs_before ON p.to_domain = gs_before.site_url 
      AND gs_before.reference_id = p.id::text AND gs_before.snapshot_type = 'before'
    LEFT JOIN gsc_snapshots gs_after ON p.to_domain = gs_after.site_url 
      AND gs_after.reference_id = p.id::text AND gs_after.snapshot_type = 'after'
    JOIN link_requests lr ON p.request_id = lr.id
    WHERE lr.owner_email = ${userEmail}
    AND p.verified_at IS NOT NULL
  `;
  
  return c.json({ placements });
});

export default app;
