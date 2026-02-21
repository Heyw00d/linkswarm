/**
 * LinkSwarm API Worker
 * Full API implementation for link exchange network
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const app = new Hono();

// Blocked categories for spam filtering
const BLOCKED_CATEGORIES = [
  'gambling', 'casino', 'betting', 'adult', 'porn', 'xxx',
  'pharma', 'payday-loans', 'kratom', 'cbd', 'vape',
  'replica', 'counterfeit', 'illegal'
];

// Get domain authority score using DataForSEO
async function getDomainAuthority(domain, env) {
  if (!env || !env.DATAFORSEO_AUTH) {
    return { score: null, error: 'DataForSEO not configured' };
  }
  
  try {
    // DataForSEO Labs Domain Rank Overview
    const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${env.DATAFORSEO_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        target: domain,
        location_code: 2840,  // United States
        language_code: 'en'
      }])
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('DataForSEO error:', errText);
      return { score: null, error: `API error: ${res.status}` };
    }
    
    const data = await res.json();
    
    if (data.tasks && data.tasks[0] && data.tasks[0].result && data.tasks[0].result[0]) {
      const result = data.tasks[0].result[0];
      const items = result.items && result.items[0];
      
      if (items && items.metrics && items.metrics.organic) {
        const organic = items.metrics.organic;
        
        // Calculate authority score based on keyword rankings
        // Weighted: pos_1 keywords worth most, declining from there
        const totalKeywords = organic.count || 0;
        const pos1 = organic.pos_1 || 0;
        const pos2_3 = organic.pos_2_3 || 0;
        const pos4_10 = organic.pos_4_10 || 0;
        const etv = organic.etv || 0;
        
        // Authority score: log scale of total ranking keywords, capped at 100
        // Sites with 10k+ keywords = 50+, 100k+ = 70+, 1M+ = 90+
        let authorityScore = 0;
        if (totalKeywords > 0) {
          authorityScore = Math.min(100, Math.round(Math.log10(totalKeywords) * 15));
        }
        
        return {
          score: authorityScore,
          keywords: totalKeywords,
          pos1Keywords: pos1,
          pos2_3Keywords: pos2_3,
          pos4_10Keywords: pos4_10,
          topKeywords: pos1 + pos2_3 + pos4_10,
          etv: Math.round(etv),
          etvFormatted: etv > 1000000 ? `$${(etv/1000000).toFixed(1)}M` : etv > 1000 ? `$${(etv/1000).toFixed(0)}K` : `$${Math.round(etv)}`
        };
      }
    }
    
    // Domain not found in DataForSEO (too new or no rankings)
    return { score: 0, keywords: 0, topKeywords: 0, etv: 0, notIndexed: true };
  } catch (err) {
    console.error('Authority check error:', err);
    return { score: null, error: err.message };
  }
}

// Scan site content and classify categories
async function scanSiteContent(domain, env) {
  try {
    // Fetch the homepage
    const response = await fetch(`https://${domain}`, {
      headers: { 'User-Agent': 'LinkSwarm-Bot/1.0 (site-verification)' },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      return { success: false, error: `Failed to fetch: ${response.status}` };
    }
    
    const html = await response.text();
    
    // Extract text content (strip HTML)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000); // Limit to ~4k chars for API
    
    // Extract title and meta description
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Use OpenAI to classify
    if (!env.OPENAI_API_KEY) {
      // Fallback: keyword-based detection
      const lowerContent = (title + ' ' + description + ' ' + textContent).toLowerCase();
      const detectedBlocked = BLOCKED_CATEGORIES.filter(cat => 
        lowerContent.includes(cat) || 
        (cat === 'gambling' && (lowerContent.includes('bet ') || lowerContent.includes('slots'))) ||
        (cat === 'casino' && lowerContent.includes('jackpot')) ||
        (cat === 'adult' && (lowerContent.includes('18+') || lowerContent.includes('nsfw')))
      );
      
      return {
        success: true,
        title,
        description,
        suggestedCategories: [],
        blockedCategories: detectedBlocked,
        isBlocked: detectedBlocked.length > 0,
        method: 'keyword'
      };
    }
    
    // OpenAI classification
    const prompt = `Analyze this website and classify it.

Title: ${title}
Description: ${description}
Content excerpt: ${textContent.substring(0, 2000)}

Return JSON only:
{
  "categories": ["category1", "category2"], // e.g. "saas", "fintech", "crypto", "ai", "ecommerce", "blog", "news"
  "blockedCategories": [], // ONLY if site contains: gambling, casino, betting, adult, porn, pharma, payday-loans, illegal content
  "isBlocked": false, // true if blockedCategories is not empty
  "confidence": 0.9, // 0-1 how confident you are
  "reason": "brief explanation"
}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 200
      })
    });
    
    if (!aiResponse.ok) {
      console.error('OpenAI error:', await aiResponse.text());
      return { success: false, error: 'AI classification failed' };
    }
    
    const aiData = await aiResponse.json();
    const classification = JSON.parse(aiData.choices[0].message.content);
    
    return {
      success: true,
      title,
      description,
      suggestedCategories: classification.categories || [],
      blockedCategories: classification.blockedCategories || [],
      isBlocked: classification.isBlocked || false,
      confidence: classification.confidence || 0.5,
      reason: classification.reason || '',
      method: 'ai'
    };
    
  } catch (err) {
    console.error('Site scan error:', err);
    return { success: false, error: err.message };
  }
}

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

// ============ MAGIC LINK AUTH ============

// Send magic link email for passwordless login
app.post('/v1/auth/magic-link', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { email } = await c.req.json();
  
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Invalid email' }, 400);
  }
  
  // Check if user exists
  const [user] = await sql`SELECT * FROM api_keys WHERE email = ${email.toLowerCase()} AND email_verified = true`;
  
  if (!user) {
    return c.json({ error: 'Email not found. Have you signed up?' }, 404);
  }
  
  // Generate a secure token
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store token in database (reusing verification_code field)
  await sql`
    UPDATE api_keys 
    SET verification_code = ${token}, 
        code_expires_at = ${expiresAt.toISOString()}
    WHERE email = ${email.toLowerCase()}
  `;
  
  // Send magic link email
  const magicLink = `https://linkswarm.ai/dashboard/?token=${token}&email=${encodeURIComponent(email)}`;
  
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'LinkSwarm <noreply@linkswarm.ai>',
        to: email,
        subject: '🐝 Your LinkSwarm Login Link',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b;">🐝 LinkSwarm</h1>
            <p>Click the button below to log in to your dashboard:</p>
            <p style="margin: 30px 0;">
              <a href="${magicLink}" style="background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Log In to Dashboard
              </a>
            </p>
            <div style="margin: 30px 0; padding: 20px; background: rgba(251,191,36,0.1); border-radius: 8px;">
              <p style="margin: 0 0 10px 0; font-weight: bold;">Want to set a password?</p>
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">You can use the same link to set a password for faster future logins:</p>
              <a href="https://linkswarm.ai/set-password?token=${token}&email=${encodeURIComponent(email)}" style="color: #f59e0b; text-decoration: none;">Set Password →</a>
            </div>
            <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
          </div>
        `
      })
    });
    
    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return c.json({ error: 'Failed to send email' }, 500);
    }
  } catch (err) {
    console.error('Email error:', err);
    return c.json({ error: 'Failed to send email' }, 500);
  }
  
  return c.json({ success: true, message: 'Check your email for a login link' });
});

// Verify magic link token and return API key
app.get('/v1/auth/verify-token', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const token = c.req.query('token');
  const email = c.req.query('email');
  
  if (!token || !email) {
    return c.json({ error: 'Token and email required' }, 400);
  }
  
  // Look up the token
  const [user] = await sql`
    SELECT * FROM api_keys 
    WHERE email = ${email.toLowerCase()} 
      AND verification_code = ${token}
      AND code_expires_at > NOW()
  `;
  
  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  
  // Clear the token (one-time use)
  await sql`
    UPDATE api_keys 
    SET verification_code = NULL, code_expires_at = NULL 
    WHERE email = ${email.toLowerCase()}
  `;
  
  return c.json({ 
    success: true, 
    api_key: user.api_key,
    email: user.email
  });
});

// ============ PASSWORD AUTH ============

// Set password for existing user (from magic link)
app.post('/v1/auth/set-password', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { email, token, password } = await c.req.json();
  
  if (!email || !token || !password) {
    return c.json({ error: 'Email, token, and password required' }, 400);
  }
  
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  
  // Verify token (same logic as magic link)
  const [user] = await sql`
    SELECT * FROM api_keys 
    WHERE email = ${email.toLowerCase()} 
      AND verification_code = ${token}
      AND code_expires_at > NOW()
  `;
  
  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  
  // Hash password and store it
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  await sql`
    UPDATE api_keys 
    SET password_hash = ${passwordHash}, 
        email_verified = true,
        verification_code = NULL, 
        code_expires_at = NULL 
    WHERE email = ${email.toLowerCase()}
  `;
  
  // Send confirmation email
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'LinkSwarm <noreply@linkswarm.ai>',
        to: email,
        subject: '🐝 Password set successfully',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b;">🐝 LinkSwarm</h1>
            <p>Your password has been set successfully!</p>
            <p>You can now log in using your email and password at:</p>
            <p style="margin: 30px 0;">
              <a href="https://linkswarm.ai/dashboard" style="background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Go to Dashboard
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">If you didn't set this password, please contact support immediately.</p>
          </div>
        `
      })
    });
    
    if (!res.ok) {
      console.error('Resend error:', await res.text());
    }
  } catch (err) {
    console.error('Email error:', err);
  }
  
  return c.json({ 
    success: true, 
    api_key: user.api_key,
    email: user.email,
    message: 'Password set successfully'
  });
});

// Login with email and password
app.post('/v1/auth/login', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { email, password } = await c.req.json();
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  
  // Find user
  const [user] = await sql`SELECT * FROM api_keys WHERE email = ${email.toLowerCase()} AND email_verified = true`;
  
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }
  
  if (!user.password_hash) {
    return c.json({ error: 'No password set. Please use magic link or set a password first.' }, 401);
  }
  
  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }
  
  return c.json({ 
    success: true, 
    api_key: user.api_key,
    email: user.email
  });
});

// Forgot password - send reset email
app.post('/v1/auth/forgot-password', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { email } = await c.req.json();
  
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Invalid email' }, 400);
  }
  
  // Check if user exists
  const [user] = await sql`SELECT * FROM api_keys WHERE email = ${email.toLowerCase()} AND email_verified = true`;
  
  if (!user) {
    // Don't reveal if email exists or not for security
    return c.json({ success: true, message: 'If that email exists, we sent you a reset link.' });
  }
  
  // Generate reset token
  const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Store reset token
  await sql`
    UPDATE api_keys 
    SET password_reset_token = ${resetToken}, 
        password_reset_expires = ${expiresAt.toISOString()}
    WHERE email = ${email.toLowerCase()}
  `;
  
  // Send reset email
  const resetLink = `https://linkswarm.ai/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'LinkSwarm <noreply@linkswarm.ai>',
        to: email,
        subject: '🐝 Reset your LinkSwarm password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b;">🐝 LinkSwarm</h1>
            <p>You requested a password reset for your LinkSwarm account.</p>
            <p style="margin: 30px 0;">
              <a href="${resetLink}" style="background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
          </div>
        `
      })
    });
    
    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return c.json({ error: 'Failed to send reset email' }, 500);
    }
  } catch (err) {
    console.error('Email error:', err);
    return c.json({ error: 'Failed to send reset email' }, 500);
  }
  
  return c.json({ success: true, message: 'If that email exists, we sent you a reset link.' });
});

// Reset password with token
app.post('/v1/auth/reset-password', async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const { email, token, newPassword } = await c.req.json();
  
  if (!email || !token || !newPassword) {
    return c.json({ error: 'Email, token, and new password required' }, 400);
  }
  
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  
  // Verify reset token
  const [user] = await sql`
    SELECT * FROM api_keys 
    WHERE email = ${email.toLowerCase()} 
      AND password_reset_token = ${token}
      AND password_reset_expires > NOW()
  `;
  
  if (!user) {
    return c.json({ error: 'Invalid or expired reset token' }, 401);
  }
  
  // Hash new password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password and clear reset token
  await sql`
    UPDATE api_keys 
    SET password_hash = ${passwordHash}, 
        password_reset_token = NULL, 
        password_reset_expires = NULL 
    WHERE email = ${email.toLowerCase()}
  `;
  
  return c.json({ 
    success: true, 
    message: 'Password reset successfully'
  });
});

// ============ DATABASE MIGRATION ============

// Run database migration to add password fields
app.post('/admin/migrate-passwords', requireAdmin, async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  
  try {
    // Add password fields to api_keys table
    await sql`
      ALTER TABLE api_keys 
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
      ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP
    `;
    
    return c.json({ 
      success: true, 
      message: 'Password fields added to api_keys table'
    });
  } catch (err) {
    console.error('Migration error:', err);
    return c.json({ 
      error: 'Migration failed', 
      details: err.message 
    }, 500);
  }
});

// ============ LLM READINESS ANALYZER ============

app.post('/api/analyze', async (c) => {
  const body = await c.req.json();
  const { domain } = body;
  
  if (!domain) {
    return c.json({ error: 'Domain required' }, 400);
  }
  
  const sql = getDb(c.env);
  
  // Check for authenticated user (optional but enables higher limits)
  const authHeader = c.req.header('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  let userEmail = null;
  let userPlan = 'free';
  
  if (apiKey) {
    const [user] = await sql`SELECT email, plan FROM api_keys WHERE api_key = ${apiKey} AND email_verified = true`;
    if (user) {
      userEmail = user.email;
      userPlan = user.plan || 'free';
    }
  }
  
  // Plan limits for LLM checks per month
  const llmLimits = { free: 1, basic: 5, pro: 20 };
  const limit = llmLimits[userPlan] || 1;
  
  // Check usage this month
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const trackingKey = userEmail || c.req.header('CF-Connecting-IP') || 'anonymous';
  
  const [usage] = await sql`
    SELECT count FROM usage_tracking 
    WHERE user_email = ${trackingKey} AND feature = 'llm_check' AND month = ${currentMonth}
  `;
  
  const currentUsage = usage?.count || 0;
  
  if (currentUsage >= limit) {
    return c.json({ 
      error: 'Monthly limit reached',
      usage: currentUsage,
      limit: limit,
      plan: userPlan,
      upgrade_url: userPlan === 'free' ? 'https://linkswarm.ai/upgrade/basic' : 
                   userPlan === 'basic' ? 'https://linkswarm.ai/upgrade/pro' : null,
      message: `You've used ${currentUsage}/${limit} LLM checks this month. ${userPlan === 'pro' ? 'Contact us for higher limits.' : 'Upgrade for more checks.'}`
    }, 429);
  }
  
  // Increment usage
  await sql`
    INSERT INTO usage_tracking (user_email, feature, month, count)
    VALUES (${trackingKey}, 'llm_check', ${currentMonth}, 1)
    ON CONFLICT (user_email, feature, month) 
    DO UPDATE SET count = usage_tracking.count + 1
  `;
  
  // Clean domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  
  // Get authority score in parallel with other checks
  const authorityPromise = getDomainAuthority(cleanDomain, c.env);
  
  const scores = {
    llm: 0,
    agent: 0,
    authority: 0,
    total: 0
  };
  
  const breakdown = {
    llm: { items: {}, suggestions: [] },
    agent: { items: {}, suggestions: [] }
  };
  
  try {
    // Parallel fetch for speed
    const [
      homepageRes,
      robotsRes,
      llmsTxtRes,
      aiTxtRes,
      wellKnownAgentRes,
      sitemapRes
    ] = await Promise.allSettled([
      fetch(`https://${cleanDomain}/`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' }, redirect: 'follow' }),
      fetch(`https://${cleanDomain}/robots.txt`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' } }),
      fetch(`https://${cleanDomain}/llms.txt`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' } }),
      fetch(`https://${cleanDomain}/ai.txt`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' } }),
      fetch(`https://${cleanDomain}/.well-known/agent.json`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' } }),
      fetch(`https://${cleanDomain}/sitemap.xml`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' } })
    ]);
    
    // LLM Scoring
    // 1. llms.txt (2 points)
    const hasLlmsTxt = llmsTxtRes.status === 'fulfilled' && llmsTxtRes.value.ok;
    breakdown.llm.items['llms.txt'] = { score: hasLlmsTxt ? 2 : 0, max: 2, found: hasLlmsTxt };
    scores.llm += hasLlmsTxt ? 2 : 0;
    if (!hasLlmsTxt) breakdown.llm.suggestions.push('Add /llms.txt with context about your site for LLMs');
    
    // 2. ai.txt (1 point)
    const hasAiTxt = aiTxtRes.status === 'fulfilled' && aiTxtRes.value.ok;
    breakdown.llm.items['ai.txt'] = { score: hasAiTxt ? 1 : 0, max: 1, found: hasAiTxt };
    scores.llm += hasAiTxt ? 1 : 0;
    if (!hasAiTxt) breakdown.llm.suggestions.push('Add /ai.txt with AI-specific instructions');
    
    // 3. robots.txt (1 point, check for AI bot allowance)
    let robotsScore = 0;
    let robotsContent = '';
    if (robotsRes.status === 'fulfilled' && robotsRes.value.ok) {
      robotsContent = await robotsRes.value.text();
      const allowsAI = !robotsContent.toLowerCase().includes('user-agent: gptbot') || 
                       !robotsContent.toLowerCase().includes('disallow: /');
      robotsScore = 1;
      if (robotsContent.toLowerCase().includes('gptbot') && robotsContent.toLowerCase().includes('disallow')) {
        robotsScore = 0.5;
        breakdown.llm.suggestions.push('Consider allowing GPTBot and other AI crawlers in robots.txt');
      }
    }
    breakdown.llm.items['robots.txt'] = { score: robotsScore, max: 1, found: robotsRes.status === 'fulfilled' && robotsRes.value.ok };
    scores.llm += robotsScore;
    
    // 4. Schema.org markup (2 points)
    let schemaScore = 0;
    let hasSchema = false;
    if (homepageRes.status === 'fulfilled' && homepageRes.value.ok) {
      const html = await homepageRes.value.text();
      hasSchema = html.includes('application/ld+json') || html.includes('itemtype="http://schema.org');
      schemaScore = hasSchema ? 2 : 0;
      
      // Check meta description
      const hasMetaDesc = html.includes('name="description"') || html.includes("name='description'");
      breakdown.llm.items['Meta Description'] = { score: hasMetaDesc ? 1 : 0, max: 1, found: hasMetaDesc };
      scores.llm += hasMetaDesc ? 1 : 0;
      if (!hasMetaDesc) breakdown.llm.suggestions.push('Add a meta description tag');
      
      // Check Open Graph
      const hasOG = html.includes('og:title') || html.includes('og:description');
      breakdown.llm.items['Open Graph'] = { score: hasOG ? 0.5 : 0, max: 0.5, found: hasOG };
      scores.llm += hasOG ? 0.5 : 0;
    }
    breakdown.llm.items['Schema.org'] = { score: schemaScore, max: 2, found: hasSchema };
    scores.llm += schemaScore;
    if (!hasSchema) breakdown.llm.suggestions.push('Add Schema.org JSON-LD structured data');
    
    // 5. Sitemap (1 point)
    const hasSitemap = sitemapRes.status === 'fulfilled' && sitemapRes.value.ok;
    breakdown.llm.items['Sitemap'] = { score: hasSitemap ? 1 : 0, max: 1, found: hasSitemap };
    scores.llm += hasSitemap ? 1 : 0;
    if (!hasSitemap) breakdown.llm.suggestions.push('Add /sitemap.xml for better crawlability');
    
    // Agent Scoring
    // 1. .well-known/agent.json (2 points)
    const hasAgentJson = wellKnownAgentRes.status === 'fulfilled' && wellKnownAgentRes.value.ok;
    breakdown.agent.items['agent.json'] = { score: hasAgentJson ? 2 : 0, max: 2, found: hasAgentJson };
    scores.agent += hasAgentJson ? 2 : 0;
    if (!hasAgentJson) breakdown.agent.suggestions.push('Add /.well-known/agent.json for agent discovery');
    
    // 2. API documentation indicators (1.5 points)
    let hasApiDocs = false;
    if (homepageRes.status === 'fulfilled' && homepageRes.value.ok) {
      // Already have HTML from above, but need to re-fetch for this check
      const homepage = await (await fetch(`https://${cleanDomain}/`, { headers: { 'User-Agent': 'LinkSwarm-Analyzer/1.0' } })).text();
      hasApiDocs = homepage.toLowerCase().includes('/api') || 
                   homepage.toLowerCase().includes('developer') ||
                   homepage.toLowerCase().includes('documentation');
    }
    breakdown.agent.items['API/Docs'] = { score: hasApiDocs ? 1.5 : 0, max: 1.5, found: hasApiDocs };
    scores.agent += hasApiDocs ? 1.5 : 0;
    if (!hasApiDocs) breakdown.agent.suggestions.push('Consider exposing an API or documentation for agents');
    
    // 3. HTTPS (1 point - implicit since we're fetching via https)
    breakdown.agent.items['HTTPS'] = { score: 1, max: 1, found: true };
    scores.agent += 1;
    
    // 4. Fast response (1 point - if we got here quickly)
    breakdown.agent.items['Accessible'] = { score: 1, max: 1, found: true };
    scores.agent += 1;
    
    // 5. No blocking (0.5 points)
    const noBlocking = robotsScore > 0;
    breakdown.agent.items['No Blocking'] = { score: noBlocking ? 0.5 : 0, max: 0.5, found: noBlocking };
    scores.agent += noBlocking ? 0.5 : 0;
    
    // Get authority result
    const authorityResult = await authorityPromise;
    scores.authority = authorityResult.score !== null ? authorityResult.score / 10 : null;
    
    // Calculate totals (scale to 10)
    const llmMax = 8.5;
    const agentMax = 6;
    scores.llm = Math.min(10, (scores.llm / llmMax) * 10);
    scores.agent = Math.min(10, (scores.agent / agentMax) * 10);
    
    // Total = weighted average (readiness 50%, authority 50%)
    // If authority unavailable, just use readiness
    if (scores.authority !== null) {
      const readinessScore = (scores.llm + scores.agent) / 2;
      scores.total = (readinessScore * 0.5) + (scores.authority * 0.5);
    } else {
      scores.total = (scores.llm + scores.agent) / 2;
    }
    
    // Add authority to breakdown
    breakdown.authority = {
      score: authorityResult.score,
      keywords: authorityResult.keywords,
      topKeywords: authorityResult.topKeywords,
      pos1Keywords: authorityResult.pos1Keywords,
      etv: authorityResult.etv,
      etvFormatted: authorityResult.etvFormatted,
      notIndexed: authorityResult.notIndexed,
      items: {
        'Authority Score': { 
          score: authorityResult.score || 0, 
          max: 100, 
          found: authorityResult.score !== null 
        },
        'Ranking Keywords': {
          score: Math.min(100, Math.round(Math.log10((authorityResult.keywords || 1)) * 15)),
          max: 100,
          value: authorityResult.keywords || 0,
          found: !authorityResult.notIndexed
        },
        'Top 10 Keywords': {
          score: Math.min(100, Math.round(Math.log10((authorityResult.topKeywords || 1)) * 20)),
          max: 100,
          value: authorityResult.topKeywords || 0,
          found: !authorityResult.notIndexed
        },
        'Est. Traffic Value': {
          score: authorityResult.etv > 0 ? Math.min(100, Math.round(Math.log10(authorityResult.etv) * 10)) : 0,
          max: 100,
          value: authorityResult.etvFormatted || '$0',
          found: !authorityResult.notIndexed
        }
      },
      suggestions: []
    };
    
    if (authorityResult.notIndexed) {
      breakdown.authority.suggestions.push('Site not indexed in search engines yet — build content and backlinks to get ranked');
    } else if (authorityResult.score !== null && authorityResult.score < 30) {
      breakdown.authority.suggestions.push('Low authority score — build quality backlinks to improve LLM visibility');
    }
    if (authorityResult.topKeywords !== undefined && authorityResult.topKeywords < 100) {
      breakdown.authority.suggestions.push('Few top 10 rankings — optimize content for target keywords');
    }
    
    // Determine grade
    let grade;
    if (scores.total >= 9) grade = { letter: 'A+', label: 'Excellent', color: '#10b981' };
    else if (scores.total >= 8) grade = { letter: 'A', label: 'Great', color: '#22c55e' };
    else if (scores.total >= 7) grade = { letter: 'B+', label: 'Good', color: '#84cc16' };
    else if (scores.total >= 6) grade = { letter: 'B', label: 'Above Average', color: '#eab308' };
    else if (scores.total >= 5) grade = { letter: 'C', label: 'Average', color: '#f97316' };
    else if (scores.total >= 4) grade = { letter: 'D', label: 'Below Average', color: '#ef4444' };
    else grade = { letter: 'F', label: 'Needs Work', color: '#dc2626' };
    
    // Build recommendations array from suggestions
    const recommendations = [];
    
    // LLM recommendations
    if (!hasLlmsTxt) {
      recommendations.push({
        title: 'Add llms.txt',
        description: 'Create a /llms.txt file to help LLMs understand your site. Include key information about your product, services, and how AI should interpret your content.',
        priority: 'high',
        category: 'llm',
        link: 'https://llmstxt.org/'
      });
    }
    if (!hasSchema) {
      recommendations.push({
        title: 'Add Schema.org Markup',
        description: 'Implement JSON-LD structured data to help search engines and AI understand your content better.',
        priority: 'high',
        category: 'llm',
        link: 'https://schema.org/docs/gs.html'
      });
    }
    if (!hasSitemap) {
      recommendations.push({
        title: 'Create a Sitemap',
        description: 'Add a /sitemap.xml file to help crawlers discover all your pages efficiently.',
        priority: 'medium',
        category: 'llm',
        link: 'https://www.sitemaps.org/'
      });
    }
    if (!hasAiTxt) {
      recommendations.push({
        title: 'Add ai.txt',
        description: 'Create an /ai.txt file with AI-specific instructions and permissions.',
        priority: 'low',
        category: 'llm'
      });
    }
    
    // Agent recommendations
    if (!hasAgentJson) {
      recommendations.push({
        title: 'Add agent.json',
        description: 'Create /.well-known/agent.json to enable AI agent discovery and integration with your site.',
        priority: 'medium',
        category: 'agent',
        link: 'https://linkswarm.ai/docs/agent-json'
      });
    }
    if (!hasApiDocs) {
      recommendations.push({
        title: 'Expose API Documentation',
        description: 'Consider adding developer documentation or API access points for programmatic interaction.',
        priority: 'low',
        category: 'agent'
      });
    }
    
    // Authority recommendations
    if (authorityResult.notIndexed) {
      recommendations.push({
        title: 'Get Indexed in Search Engines',
        description: 'Your site has no search rankings yet. Build content, get backlinks, and submit to Google Search Console.',
        priority: 'high',
        category: 'authority',
        link: 'https://search.google.com/search-console'
      });
    } else if (authorityResult.score !== null && authorityResult.score < 30) {
      recommendations.push({
        title: 'Build Domain Authority',
        description: `Authority score ${authorityResult.score}/100 (${authorityResult.keywords?.toLocaleString() || 0} ranking keywords). LLMs cite high-authority sources. Build quality backlinks to improve.`,
        priority: 'high',
        category: 'authority',
        link: 'https://linkswarm.ai/register'
      });
    }
    
    // Build howToImprove array
    const howToImprove = [];
    if (!hasLlmsTxt) {
      howToImprove.push({
        title: 'Create /llms.txt',
        steps: [
          'Create a file called llms.txt in your root directory',
          'Add a brief description of your site/product',
          'Include key facts, features, and use cases',
          'Specify how AI should interpret your content'
        ]
      });
    }
    if (!hasAgentJson) {
      howToImprove.push({
        title: 'Create /.well-known/agent.json',
        steps: [
          'Create a .well-known directory if it doesn\'t exist',
          'Add agent.json with your site capabilities',
          'Include API endpoints agents can use',
          'Specify authentication requirements'
        ]
      });
    }
    if (!hasSchema) {
      howToImprove.push({
        title: 'Add JSON-LD Schema',
        steps: [
          'Choose appropriate schema types for your content',
          'Add <script type="application/ld+json"> to your HTML head',
          'Include Organization, WebSite, and Product schemas',
          'Validate with Google\'s Rich Results Test'
        ]
      });
    }
    
    return c.json({
      domain: cleanDomain,
      scores,
      grade,
      breakdown,
      recommendations,
      howToImprove
    });
    
  } catch (err) {
    console.error('Analyze error:', err);
    return c.json({ error: 'Failed to analyze domain', details: err.message }, 500);
  }
});

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

app.get('/dashboard', requireAuth, async (c) => {
  const sql = getDb(c.env);
  const user = c.get('user');
  
  // Get user's sites count
  const [userSites] = await sql`SELECT COUNT(*) as count FROM sites WHERE owner_email = ${user.email}`;
  
  // Plan limits
  // Plan limits: Pro = 4X Basic
  const planLimits = {
    free: { sites: 1, llm_checks: 1, exchanges: 3, requests: 10 },
    basic: { sites: 5, llm_checks: 5, exchanges: 20, requests: 50 },
    pro: { sites: 20, llm_checks: 20, exchanges: 80, requests: 200 }
  };
  const plan = user.plan || 'free';
  const limits = planLimits[plan] || planLimits.free;
  
  // Get user's exchanges
  const userExchanges = await sql`
    SELECT e.* FROM exchanges e
    JOIN sites s ON (e.from_domain = s.domain OR e.to_domain = s.domain)
    WHERE s.owner_email = ${user.email}
    ORDER BY e.created_at DESC LIMIT 10
  `;
  
  // Get user's sites
  const userSitesList = await sql`
    SELECT domain, name, verified, created_at FROM sites 
    WHERE owner_email = ${user.email}
    ORDER BY created_at DESC LIMIT 10
  `;
  
  return c.json({
    user: {
      email: user.email,
      api_key: user.api_key,
      plan: plan
    },
    limits: {
      sites: limits.sites,
      sites_used: parseInt(userSites?.count || 0),
      requests: limits.requests
    },
    upgrade_urls: plan === 'free' ? {
      pro: 'https://linkswarm.ai/upgrade/pro',
      agency: 'https://linkswarm.ai/upgrade/agency'
    } : null,
    recentSites: userSitesList,
    recentExchanges: userExchanges
  });
});

// ============ REGISTRATION ============

app.post('/api/register', async (c) => {
  const { email, domain, ref } = await c.req.json();
  
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
  
  // Check referral code if provided
  let referrerEmail = null;
  if (ref) {
    const [referrer] = await sql`SELECT email FROM api_keys WHERE referral_code = ${ref.toUpperCase()}`;
    if (referrer) {
      referrerEmail = referrer.email;
    }
  }
  
  // Generate API key and referral code
  const apiKey = 'sk_linkswarm_' + crypto.randomUUID().replace(/-/g, '');
  const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  await sql`
    INSERT INTO api_keys (email, api_key, verification_code, code_expires_at, email_verified, referral_code, referred_by)
    VALUES (${email}, ${apiKey}, ${verificationCode}, ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}, false, ${referralCode}, ${referrerEmail})
  `;
  
  // Send verification email via Resend
  if (c.env.RESEND_API_KEY) {
    await sendVerificationEmail(c.env, email, verificationCode);
  }
  
  return c.json({ 
    success: true,
    apiKey,
    message: 'Check your email for verification code',
    referredBy: referrerEmail ? true : false
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
  
  // Credit referrer if this user was referred
  if (user.referred_by) {
    // Add 3 credits to referrer
    await sql`
      INSERT INTO credit_balances (user_email, balance, lifetime_earned)
      VALUES (${user.referred_by}, 3, 3)
      ON CONFLICT (user_email) DO UPDATE 
      SET balance = credit_balances.balance + 3, lifetime_earned = credit_balances.lifetime_earned + 3
    `;
    
    // Log the transaction
    const [referrerBalance] = await sql`SELECT balance FROM credit_balances WHERE user_email = ${user.referred_by}`;
    await sql`
      INSERT INTO credit_transactions (user_email, amount, type, reference_type, description, balance_after)
      VALUES (${user.referred_by}, 3, 'earned', 'referral', ${'Referral: ' + email}, ${referrerBalance?.balance || 3})
    `;
    
    // Increment referral count
    await sql`UPDATE api_keys SET referral_count = referral_count + 1 WHERE email = ${user.referred_by}`;
    
    // Create dashboard notification
    await sql`
      INSERT INTO notifications (user_email, type, title, message, link)
      VALUES (${user.referred_by}, 'referral', '🎉 You earned 3 credits!', ${'Someone signed up using your referral link: ' + email}, '/dashboard')
    `;
    
    // Send notification email to referrer
    if (c.env.RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'LinkSwarm <hello@linkswarm.ai>',
          to: user.referred_by,
          subject: '🎉 You earned 3 credits from a referral!',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0f0f23; color: #fff;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px;">🎉</div>
                <h1 style="color: #fbbf24;">You earned 3 credits!</h1>
              </div>
              <p>Someone signed up using your referral link and just verified their account.</p>
              <p style="font-size: 24px; text-align: center; color: #10b981; font-weight: bold;">+3 Credits</p>
              <p>Keep sharing your link to earn more credits!</p>
              <p style="margin-top: 30px;">
                <a href="https://linkswarm.ai/dashboard" style="background: #fbbf24; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Dashboard →</a>
              </p>
            </div>
          `
        })
      }).catch(() => {});
    }
  }
  
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
  
  // Check site ownership
  const [site] = await sql`SELECT * FROM sites WHERE domain = ${domain} AND owner_email = ${userEmail}`;
  if (!site) {
    return c.json({ error: 'Site not found or not owned by you' }, 404);
  }
  
  // Scan site content for classification and spam detection
  const scan = await scanSiteContent(domain, c.env);
  
  if (!scan.success) {
    return c.json({ 
      error: 'Could not verify site', 
      details: scan.error,
      tip: 'Make sure your site is accessible at https://' + domain
    }, 400);
  }
  
  // Block sites with prohibited content
  if (scan.isBlocked) {
    await sql`UPDATE sites SET verified = false, flagged = true, flag_reason = ${scan.blockedCategories.join(', ')} WHERE domain = ${domain}`;
    
    return c.json({ 
      verified: false,
      blocked: true,
      reason: `Site contains prohibited content: ${scan.blockedCategories.join(', ')}`,
      details: scan.reason || 'Sites in these categories are not allowed in the network.'
    }, 403);
  }
  
  // Auto-update categories if user didn't provide any
  const existingCategories = site.categories || [];
  const newCategories = existingCategories.length > 0 
    ? existingCategories 
    : scan.suggestedCategories;
  
  // Update site with verification and scanned data
  await sql`
    UPDATE sites 
    SET verified = true, 
        categories = ${newCategories},
        description = COALESCE(NULLIF(description, ''), ${scan.description || ''}),
        name = COALESCE(NULLIF(name, domain), ${scan.title || domain}),
        scanned_at = NOW(),
        scan_confidence = ${scan.confidence || 0}
    WHERE domain = ${domain} AND owner_email = ${userEmail}
  `;
  
  // Discord notification - new site joined
  if (c.env.DISCORD_WEBHOOK_URL) {
    const siteName = scan.title || site.name || domain;
    fetch(c.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🌐 New Site Joined',
          color: 0x10B981,
          fields: [
            { name: 'Domain', value: domain, inline: true },
            { name: 'Name', value: siteName, inline: true },
            { name: 'Categories', value: (newCategories || []).join(', ') || 'None', inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {});
  }
  
  return c.json({ 
    success: true, 
    verified: true,
    categories: newCategories,
    scanResult: {
      method: scan.method,
      confidence: scan.confidence,
      suggestedCategories: scan.suggestedCategories
    }
  });
});

// ============ SITE ANALYZE ============

app.post('/v1/sites/analyze', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const body = await c.req.json();
  const { domain } = body;
  
  if (!domain) {
    return c.json({ error: 'Domain required' }, 400);
  }
  
  const sql = getDb(c.env);
  
  // Check site ownership (unless external flag is set)
  if (!body.external) {
    const [site] = await sql`SELECT * FROM sites WHERE domain = ${domain} AND owner_email = ${userEmail}`;
    if (!site) {
      return c.json({ error: 'Site not found or not owned by you' }, 404);
    }
  }
  
  // Get domain authority/quality metrics
  const authorityResult = await getDomainAuthority(domain, c.env);
  
  // Build quality response
  const quality = {
    score: authorityResult.score || 0,
    keywords: authorityResult.keywords || 0,
    topKeywords: authorityResult.topKeywords || 0,
    top10: authorityResult.topKeywords || 0,
    pos1Keywords: authorityResult.pos1Keywords || 0,
    etv: authorityResult.etv || 0,
    etvFormatted: authorityResult.etvFormatted || '$0',
    notIndexed: authorityResult.notIndexed || false
  };
  
  // Update site record with quality data if it's the user's site
  if (!body.external) {
    await sql`
      UPDATE sites 
      SET quality_score = ${quality.score},
          keywords = ${quality.keywords},
          etv = ${quality.etv},
          analyzed = true,
          analyzed_at = NOW()
      WHERE domain = ${domain} AND owner_email = ${userEmail}
    `;
  }
  
  return c.json({
    success: true,
    domain,
    quality,
    message: quality.notIndexed 
      ? 'Site not yet indexed in search engines' 
      : `Quality score: ${quality.score}/100`
  });
});

// Verify endpoint without auth (for quick checks)
app.post('/v1/sites/verify', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const body = await c.req.json();
  const { domain } = body;
  
  if (!domain) {
    return c.json({ error: 'Domain required' }, 400);
  }
  
  const sql = getDb(c.env);
  
  // Check site ownership
  const [site] = await sql`SELECT * FROM sites WHERE domain = ${domain} AND owner_email = ${userEmail}`;
  if (!site) {
    return c.json({ error: 'Site not found or not owned by you' }, 404);
  }
  
  // Scan site content for classification and spam detection
  const scan = await scanSiteContent(domain, c.env);
  
  if (!scan.success) {
    return c.json({ 
      error: 'Could not verify site', 
      details: scan.error,
      tip: 'Make sure your site is accessible at https://' + domain
    }, 400);
  }
  
  // Block sites with prohibited content
  if (scan.isBlocked) {
    await sql`UPDATE sites SET verified = false, flagged = true, flag_reason = ${scan.blockedCategories.join(', ')} WHERE domain = ${domain}`;
    
    return c.json({ 
      verified: false,
      blocked: true,
      reason: `Site contains prohibited content: ${scan.blockedCategories.join(', ')}`,
      details: scan.reason || 'Sites in these categories are not allowed in the network.'
    }, 403);
  }
  
  // Auto-update categories if user didn't provide any
  const existingCategories = site.categories || [];
  const newCategories = existingCategories.length > 0 
    ? existingCategories 
    : scan.suggestedCategories;
  
  // Update site with verification and scanned data
  await sql`
    UPDATE sites 
    SET verified = true, 
        categories = ${newCategories},
        description = COALESCE(NULLIF(description, ''), ${scan.description || ''}),
        name = COALESCE(NULLIF(name, domain), ${scan.title || domain}),
        scanned_at = NOW(),
        scan_confidence = ${scan.confidence || 0}
    WHERE domain = ${domain} AND owner_email = ${userEmail}
  `;
  
  return c.json({ 
    success: true, 
    verified: true,
    categories: newCategories
  });
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
    VALUES (${userEmail}, 1, 'earned', 'contribution', ${contribution.id}, 'Link contribution', ${balance.balance})
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
  
  // Try to find a match (excluding blocked categories)
  const siteCategories = categories || site.categories || [];
  const [contribution] = await sql`
    SELECT * FROM link_contributions 
    WHERE status = 'available' 
    AND owner_email != ${userEmail}
    AND categories && ${siteCategories}
    AND NOT (categories && ${BLOCKED_CATEGORIES})
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
      VALUES (${userEmail}, -1, 'spent', 'request', ${request.id}, 'Link request matched', ${newBalance.balance})
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

// ============ POOL: AUTO-MATCH (Cron endpoint) ============

app.post('/v1/pool/auto-match', requireAdmin, async (c) => {
  const sql = getDb(c.env);
  const matches = [];
  
  // Get all pending requests
  const pendingRequests = await sql`
    SELECT lr.*, s.name as site_name, s.categories as site_categories
    FROM link_requests lr
    JOIN sites s ON lr.site_domain = s.domain
    WHERE lr.status = 'pending'
    ORDER BY lr.created_at ASC
  `;
  
  for (const request of pendingRequests) {
    const requestCategories = request.categories || request.site_categories || [];
    
    // Find a matching contribution (excluding blocked categories)
    const [contribution] = await sql`
      SELECT * FROM link_contributions 
      WHERE status = 'available' 
      AND owner_email != ${request.owner_email}
      AND categories && ${requestCategories}
      AND NOT (categories && ${BLOCKED_CATEGORIES})
      ORDER BY created_at ASC
      LIMIT 1
    `;
    
    if (!contribution) continue;
    
    // Check requester has credits
    const [balance] = await sql`SELECT balance FROM credit_balances WHERE user_email = ${request.owner_email}`;
    if (!balance || balance.balance < 1) continue;
    
    // Create placement
    const relevanceScore = 0.8;
    const [placement] = await sql`
      INSERT INTO link_placements (
        contribution_id, request_id, from_domain, from_page, to_domain, to_page, 
        anchor_text, relevance_score, status
      ) VALUES (
        ${contribution.id}, ${request.id}, ${contribution.site_domain}, ${contribution.page_url},
        ${request.site_domain}, ${request.target_page || '/'}, 
        ${request.preferred_anchor || request.site_name || request.site_domain}, 
        ${relevanceScore}, 'assigned'
      )
      RETURNING id
    `;
    
    // Update contribution & request
    await sql`UPDATE link_contributions SET status = 'matched', links_placed = links_placed + 1 WHERE id = ${contribution.id}`;
    await sql`UPDATE link_requests SET status = 'matched', fulfilled_by = ${placement.id} WHERE id = ${request.id}`;
    
    // Deduct credit
    await sql`UPDATE credit_balances SET balance = balance - 1, lifetime_spent = lifetime_spent + 1 WHERE user_email = ${request.owner_email}`;
    const [newBalance] = await sql`SELECT balance FROM credit_balances WHERE user_email = ${request.owner_email}`;
    
    await sql`
      INSERT INTO credit_transactions (user_email, amount, type, reference_type, reference_id, description, balance_after)
      VALUES (${request.owner_email}, -1, 'spent', 'request', ${request.id}, 'Auto-matched link request', ${newBalance.balance})
    `;
    
    // Get site info for notification
    const [targetSite] = await sql`SELECT * FROM sites WHERE domain = ${request.site_domain}`;
    
    // Send notification
    await sendMatchNotification(c.env, sql, contribution, targetSite, request.preferred_anchor, request.target_page);
    
    matches.push({
      request_id: request.id,
      placement_id: placement.id,
      from: contribution.site_domain,
      to: request.site_domain
    });
  }
  
  // Post summary to Discord if any matches
  if (matches.length > 0 && c.env.DISCORD_WEBHOOK_URL) {
    fetch(c.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🤖 Auto-Match Complete',
          color: 0x10B981,
          description: `Matched ${matches.length} pending request(s)`,
          fields: matches.slice(0, 5).map(m => ({
            name: `${m.from} → ${m.to}`,
            value: `Placement #${m.placement_id}`,
            inline: true
          })),
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {});
  }
  
  return c.json({
    success: true,
    matches_created: matches.length,
    matches
  });
});

// Send verification email via Resend
async function sendVerificationEmail(env, email, code) {
  const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f23; color: #fff; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 32px; margin-bottom: 10px; }
    .brand { color: #fbbf24; font-size: 24px; font-weight: bold; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #fbbf24; font-family: monospace; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
    a { color: #fbbf24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🐝</div>
      <div class="brand">LinkSwarm</div>
      <p style="color: #9ca3af;">Welcome! Verify your email to get started.</p>
    </div>
    
    <div class="card">
      <p style="color: #9ca3af; margin-bottom: 16px;">Your verification code:</p>
      <div class="code">${code}</div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This code expires in 24 hours.</p>
    </div>
    
    <p style="text-align: center; color: #9ca3af;">Enter this code in the CLI or API to verify your account.</p>
    
    <div class="footer">
      <p>LinkSwarm — Fair link exchanges for the AI era</p>
      <p><a href="https://linkswarm.ai">linkswarm.ai</a></p>
    </div>
  </div>
</body>
</html>`.trim();

  const textEmail = `
🐝 LinkSwarm

Welcome! Your verification code is: ${code}

Enter this code in the CLI or API to verify your account.
This code expires in 24 hours.

---
LinkSwarm - Fair link exchanges
https://linkswarm.ai
  `.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'LinkSwarm <hello@linkswarm.ai>',
        to: email,
        subject: '🐝 Verify your LinkSwarm account',
        html: htmlEmail,
        text: textEmail
      })
    });
    if (!res.ok) {
      console.error('Resend verification error:', await res.text());
    }
  } catch (err) {
    console.error('Failed to send verification email:', err);
  }
}

// Send match notification email
async function sendMatchNotification(env, sql, contribution, targetSite, anchor, targetPage) {
  const [contributor] = await sql`SELECT email, notify_matches FROM api_keys WHERE email = ${contribution.owner_email}`;
  if (!contributor || !contributor.notify_matches) return;
  
  // Get contributor's site info for the notification
  const [fromSite] = await sql`SELECT name, domain FROM sites WHERE domain = ${contribution.site_domain}`;
  
  // Build email data - properly extract all fields
  const fromDomain = fromSite?.domain || contribution.site_domain;
  const fromPage = contribution.page_url || '/';
  const toDomain = targetSite?.domain || 'Unknown';
  const toPage = targetPage || '/';
  const anchorText = anchor || targetSite?.name || toDomain;
  
  // HTML email template
  const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f23; color: #fff; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 32px; margin-bottom: 10px; }
    .brand { color: #fbbf24; font-size: 24px; font-weight: bold; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin: 20px 0; }
    .label { color: #9ca3af; font-size: 14px; margin-bottom: 4px; }
    .value { color: #fbbf24; font-size: 16px; font-weight: 500; }
    .value-secondary { color: #fff; font-size: 16px; }
    .cta { display: inline-block; background: #fbbf24; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
    a { color: #fbbf24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🐝</div>
      <div class="brand">LinkSwarm</div>
      <p style="color: #9ca3af;">Great news! Your link request was matched.</p>
    </div>
    
    <div class="card">
      <div class="label">Match details:</div>
      <p><span class="label">From:</span> <span class="value">${fromDomain}</span></p>
      <p><span class="label">Page:</span> <span class="value-secondary">${fromPage}</span></p>
      <p><span class="label">To:</span> <span class="value">${toDomain}${toPage}</span></p>
      <p><span class="label">Anchor:</span> <span class="value-secondary">"${anchorText}"</span></p>
    </div>
    
    <p>The contributing site will place your link soon. You'll be notified when it's live.</p>
    
    <center>
      <a href="https://linkswarm.ai/dashboard" class="cta">View in dashboard →</a>
    </center>
    
    <div class="footer">
      <p>LinkSwarm — Fair link exchanges for the AI era</p>
      <p><a href="https://linkswarm.ai">linkswarm.ai</a></p>
    </div>
  </div>
</body>
</html>`.trim();

  // Plain text version
  const textEmail = `
🐝 LinkSwarm

Great news! Your link request was matched.

Match details:
From: ${fromDomain}
Page: ${fromPage}
To: ${toDomain}${toPage}
Anchor: "${anchorText}"

The contributing site will place your link soon. You'll be notified when it's live.

View in dashboard → https://linkswarm.ai/dashboard

---
LinkSwarm - Fair link exchanges
https://linkswarm.ai
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
  
  // Send email via Resend
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'LinkSwarm <hello@linkswarm.ai>',
          to: contributor.email,
          subject: '🔗 Your link request was matched!',
          html: htmlEmail,
          text: textEmail
        })
      });
      if (!res.ok) {
        console.error('Resend error:', await res.text());
      }
    } catch (err) {
      console.error('Failed to send email:', err);
    }
  } else {
    console.log('RESEND_API_KEY not set, skipping email. Match:', { to: contributor.email, from: fromDomain, to: toDomain });
  }
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

// ============ REFERRAL ============

app.get('/v1/referral', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  const [user] = await sql`SELECT referral_code, referral_count FROM api_keys WHERE email = ${userEmail}`;
  
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  // Generate referral code if user doesn't have one
  let referralCode = user.referral_code;
  if (!referralCode) {
    referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await sql`UPDATE api_keys SET referral_code = ${referralCode} WHERE email = ${userEmail}`;
  }
  
  // Get referral transactions (credits earned from referrals)
  const referralCredits = await sql`
    SELECT SUM(amount) as total FROM credit_transactions 
    WHERE user_email = ${userEmail} AND reference_type = 'referral'
  `;
  
  return c.json({
    referral_code: referralCode,
    referral_url: `https://linkswarm.ai/register?ref=${referralCode}`,
    referral_count: user.referral_count || 0,
    credits_earned: parseInt(referralCredits[0]?.total || 0),
    credits_per_referral: 3
  });
});

// ============ NOTIFICATIONS ============

// Get user notifications
app.get('/v1/notifications', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  const limit = parseInt(c.req.query('limit')) || 20;
  const unreadOnly = c.req.query('unread') === 'true';
  
  let notifications;
  if (unreadOnly) {
    notifications = await sql`
      SELECT * FROM notifications 
      WHERE user_email = ${userEmail} AND read = false
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
  } else {
    notifications = await sql`
      SELECT * FROM notifications 
      WHERE user_email = ${userEmail}
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
  }
  
  // Get unread count
  const [unreadCount] = await sql`
    SELECT COUNT(*) as count FROM notifications 
    WHERE user_email = ${userEmail} AND read = false
  `;
  
  return c.json({
    notifications,
    unread_count: parseInt(unreadCount?.count || 0)
  });
});

// Mark notification as read
app.patch('/v1/notifications/:id/read', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const notificationId = c.req.param('id');
  const sql = getDb(c.env);
  
  await sql`
    UPDATE notifications 
    SET read = true 
    WHERE id = ${parseInt(notificationId)} AND user_email = ${userEmail}
  `;
  
  return c.json({ success: true });
});

// Mark all notifications as read
app.post('/v1/notifications/read-all', requireAuth, async (c) => {
  const userEmail = c.get('userEmail');
  const sql = getDb(c.env);
  
  await sql`UPDATE notifications SET read = true WHERE user_email = ${userEmail}`;
  
  return c.json({ success: true });
});

// Helper function to create notification (used internally)
async function createNotification(sql, userEmail, type, title, message, link = null) {
  await sql`
    INSERT INTO notifications (user_email, type, title, message, link)
    VALUES (${userEmail}, ${type}, ${title}, ${message}, ${link})
  `;
}

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

// ============ STRIPE WEBHOOK ============

app.post('/webhook/stripe', async (c) => {
  const sql = getDb(c.env);
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature');
  
  // Verify webhook signature (optional but recommended)
  // For now, we'll trust the payload
  
  let event;
  try {
    event = JSON.parse(body);
  } catch (err) {
    return c.json({ error: 'Invalid payload' }, 400);
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_email || session.customer_details?.email;
    const amount = session.amount_total / 100;
    
    // Determine plan based on amount ($10 = basic, $29 = pro)
    const plan = amount >= 29 ? 'pro' : amount >= 10 ? 'basic' : 'free';
    
    if (customerEmail) {
      // Update user plan
      await sql`
        UPDATE api_keys 
        SET plan = ${plan}, upgraded_at = NOW()
        WHERE email = ${customerEmail.toLowerCase()}
      `;
      
      // Send thank you email
      if (c.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'LinkSwarm <hello@linkswarm.ai>',
            to: customerEmail,
            subject: '🐝 Welcome to LinkSwarm ' + plan.charAt(0).toUpperCase() + plan.slice(1) + '!',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0f0f23; color: #fff;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="font-size: 48px;">🐝</div>
                  <h1 style="color: #fbbf24; margin: 10px 0;">Welcome to LinkSwarm ${plan.charAt(0).toUpperCase() + plan.slice(1)}!</h1>
                </div>
                <p>Thanks for upgrading! You now have access to:</p>
                <ul style="color: #9ca3af;">
                  ${plan === 'agency' ? '<li>Unlimited sites</li><li>Unlimited exchanges</li><li>White-label options</li><li>Priority support</li>' : 
                    '<li>25 sites</li><li>50 exchanges/month</li><li>Priority matching</li><li>Analytics dashboard</li>'}
                </ul>
                <p style="margin-top: 30px;">
                  <a href="https://linkswarm.ai/dashboard" style="background: #fbbf24; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Dashboard →</a>
                </p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 40px;">
                  Questions? Reply to this email or join our <a href="https://discord.gg/linkswarm" style="color: #fbbf24;">Discord</a>.
                </p>
              </div>
            `
          })
        });
      }
      
      // Post to Discord - general webhook
      if (c.env.DISCORD_WEBHOOK_URL) {
        await fetch(c.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '💰 New ' + plan.charAt(0).toUpperCase() + plan.slice(1) + ' Subscriber!',
              color: plan === 'agency' ? 0xF59E0B : 0x8B5CF6,
              fields: [
                { name: 'Email', value: customerEmail, inline: true },
                { name: 'Plan', value: plan.toUpperCase(), inline: true },
                { name: 'Amount', value: '$' + amount, inline: true }
              ],
              timestamp: new Date().toISOString()
            }]
          })
        }).catch(() => {});
      }
      
      // Post to Discord - paying-customers channel
      if (c.env.DISCORD_CUSTOMERS_WEBHOOK) {
        const planEmoji = plan === 'pro' ? '⭐' : '🔵';
        const planColor = plan === 'pro' ? 0x8B5CF6 : 0x3B82F6;
        await fetch(c.env.DISCORD_CUSTOMERS_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `${planEmoji} **New ${plan.toUpperCase()} customer!**`,
            embeds: [{
              title: `💳 ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - $${amount}`,
              color: planColor,
              fields: [
                { name: '📧 Email', value: `\`${customerEmail}\``, inline: true },
                { name: '💰 Amount', value: `$${amount}`, inline: true },
                { name: '📅 Date', value: new Date().toLocaleDateString(), inline: true }
              ],
              footer: { text: 'LinkSwarm 🐝' },
              timestamp: new Date().toISOString()
            }]
          })
        }).catch(() => {});
      }
    }
  }
  
  return c.json({ received: true });
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
  
  let snapshots;
  if (siteUrl) {
    snapshots = await sql`
      SELECT * FROM gsc_snapshots 
      WHERE user_email = ${userEmail} AND site_url = ${siteUrl}
      ORDER BY date_end DESC 
      LIMIT 30
    `;
  } else {
    snapshots = await sql`
      SELECT * FROM gsc_snapshots 
      WHERE user_email = ${userEmail}
      ORDER BY date_end DESC 
      LIMIT 30
    `;
  }
  
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
