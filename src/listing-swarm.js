#!/usr/bin/env node
/**
 * Listing Swarm - Automated Directory Submission Service
 * Works with existing schema: listing_clients, listing_directories, listing_submissions
 * 
 * Two products:
 * - Link Swarm: Agent-to-agent backlink exchange (network)
 * - Listing Swarm: Done-for-you directory submissions (service)
 */

const fs = require('fs');
const { Pool } = require('pg');
const imap = require('./imap');

// Load env
function loadEnv() {
  const envPath = process.env.HOME + '/clawd/.env.linkswarm';
  if (!fs.existsSync(envPath)) return {};
  const envFile = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key) env[key.trim()] = val.join('=').trim();
  });
  return env;
}

const env = loadEnv();
const pool = new Pool({
  host: env.NEON_HOST,
  database: env.NEON_DB,
  user: env.NEON_USER,
  password: env.NEON_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// Category mapping (PUBLIC - exposed to clients)
const CATEGORIES = {
  crypto: { name: 'Crypto & Web3', description: 'Blockchain, DeFi, NFT, Web3 projects' },
  ai: { name: 'AI & ML', description: 'Artificial intelligence, machine learning tools' },
  startup: { name: 'Startups', description: 'New ventures, indie projects, launches' },
  saas: { name: 'SaaS', description: 'Software as a service products' },
  fintech: { name: 'Fintech', description: 'Financial technology, payments' },
  tech: { name: 'Technology', description: 'Software, apps, developer tools' },
  design: { name: 'Design', description: 'Design tools, UI/UX, creative' },
  dev: { name: 'Developer Tools', description: 'Dev tools, APIs, infrastructure' },
  indie: { name: 'Indie', description: 'Bootstrapped, solo projects' },
  ecommerce: { name: 'E-commerce', description: 'Online stores, marketplaces' }
};

// ============================================================
// PUBLIC API (exposed to clients)
// ============================================================

/**
 * Get available categories (PUBLIC)
 */
function getCategories() {
  return CATEGORIES;
}

/**
 * Preview directory matches for categories (PUBLIC)
 * Shows counts only, not actual directories
 */
async function previewMatch(categories) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE cost = 'free') as free,
      COUNT(*) FILTER (WHERE cost != 'free') as paid,
      ROUND(AVG(estimated_da)) as avg_da
    FROM listing_directories
    WHERE active = true 
      AND category = ANY($1)
  `, [categories]);

  const stats = result.rows[0];
  const total = parseInt(stats.total);
  const free = parseInt(stats.free);
  const paid = parseInt(stats.paid);

  return {
    total,
    free,
    paid,
    avgDR: parseInt(stats.avg_da) || 0,
    estimatedPrice: calculatePrice(free, paid)
  };
}

/**
 * Register a client for Listing Swarm (PUBLIC)
 */
async function registerClient(data) {
  const {
    email,
    name,
    url,
    tagline,
    descriptionShort,
    descriptionMedium,
    descriptionLong,
    category,
    subcategories = [],
    logo,
    screenshots = [],
    imapCredentials,
    package: pkg = 'growth' // starter, growth, scale
  } = data;

  // Validate required fields
  if (!email || !name || !url || !category) {
    throw new Error('Missing required fields: email, name, url, category');
  }

  // Validate IMAP if provided
  if (imapCredentials) {
    const imapTest = await imap.testConnection(imapCredentials);
    if (!imapTest.success) {
      throw new Error(`IMAP connection failed: ${imapTest.error}`);
    }
  }

  // Get matching directories count
  const matchResult = await pool.query(`
    SELECT COUNT(*) FROM listing_directories
    WHERE active = true AND category = ANY($1)
  `, [[category, ...subcategories]]);
  const matchCount = parseInt(matchResult.rows[0].count);

  // Store client
  const result = await pool.query(`
    INSERT INTO listing_clients (
      email, name, url, tagline,
      description_short, description_medium, description_long,
      category, subcategories, logo_square, screenshots,
      package, payment_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
    ON CONFLICT (email) DO UPDATE SET
      name = $2, url = $3, tagline = $4,
      description_short = $5, description_medium = $6, description_long = $7,
      category = $8, subcategories = $9, logo_square = $10, screenshots = $11,
      package = $12, updated_at = NOW()
    RETURNING id, email
  `, [
    email, name, url, tagline,
    descriptionShort, descriptionMedium, descriptionLong,
    category, subcategories, logo, screenshots,
    pkg
  ]);

  // Store IMAP credentials if provided
  if (imapCredentials) {
    await pool.query(`
      INSERT INTO listing_client_emails (
        client_id, email, imap_host, imap_port, imap_user, imap_pass
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (client_id) DO UPDATE SET
        email = $2, imap_host = $3, imap_port = $4, imap_user = $5, imap_pass = $6
    `, [
      result.rows[0].id, email,
      imapCredentials.host, imapCredentials.port || 993,
      imapCredentials.user, imapCredentials.password
    ]);
  }

  const pricing = getPackagePricing(pkg);

  return {
    clientId: result.rows[0].id,
    email: result.rows[0].email,
    matchedDirectories: matchCount,
    package: pkg,
    price: pricing.price,
    directories: pricing.directories,
    status: 'pending_payment'
  };
}

/**
 * Get client status (PUBLIC)
 */
async function getClientStatus(email) {
  const client = await pool.query(`
    SELECT id, email, name, url, package, payment_status, created_at
    FROM listing_clients WHERE email = $1
  `, [email]);

  if (client.rows.length === 0) {
    throw new Error('Client not found');
  }

  const c = client.rows[0];

  // Get submission counts
  const subs = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
      COUNT(*) FILTER (WHERE status = 'verified') as verified,
      COUNT(*) FILTER (WHERE status = 'listed') as listed,
      COUNT(*) FILTER (WHERE status = 'live') as live,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
    FROM listing_submissions
    WHERE client_email = $1
  `, [email]);

  const stats = subs.rows[0];

  return {
    clientId: c.id,
    email: c.email,
    name: c.name,
    url: c.url,
    package: c.package,
    paymentStatus: c.payment_status,
    submissions: {
      submitted: parseInt(stats.submitted) || 0,
      verified: parseInt(stats.verified) || 0,
      listed: parseInt(stats.listed) || 0,
      live: parseInt(stats.live) || 0,
      failed: parseInt(stats.failed) || 0
    },
    createdAt: c.created_at
  };
}

/**
 * Get confirmed backlinks (PUBLIC)
 */
async function getBacklinks(email) {
  const result = await pool.query(`
    SELECT 
      s.listing_url, d.estimated_da as dr, s.status, s.verified_at, d.name as directory_name
    FROM listing_submissions s
    JOIN listing_directories d ON s.directory_slug = d.slug
    WHERE s.client_email = $1 AND s.status IN ('verified', 'listed', 'live')
    ORDER BY d.estimated_da DESC
  `, [email]);

  return {
    email,
    confirmed: result.rows.map(r => ({
      url: r.listing_url,
      dr: r.dr,
      status: r.status,
      verifiedAt: r.verified_at
      // Note: directory_name NOT exposed to protect our list
    })),
    total: result.rows.length
  };
}

/**
 * Get credentials export (PUBLIC)
 */
async function getCredentialsExport(email) {
  const result = await pool.query(`
    SELECT 
      s.directory_slug, s.site_username, s.site_password, d.url as login_url
    FROM listing_submissions s
    JOIN listing_directories d ON s.directory_slug = d.slug
    WHERE s.client_email = $1 AND s.site_username IS NOT NULL
    ORDER BY s.directory_slug
  `, [email]);

  const envLines = [
    '# Listing Swarm Credentials Export',
    `# Client: ${email}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
    '# Change your email password to take full control',
    ''
  ];

  for (const cred of result.rows) {
    if (cred.site_username && cred.site_password) {
      const key = cred.directory_slug.toUpperCase().replace(/-/g, '_');
      envLines.push(`# ${cred.directory_slug}`);
      envLines.push(`${key}_USER="${cred.site_username}"`);
      envLines.push(`${key}_PASS="${cred.site_password}"`);
      envLines.push(`${key}_URL="${cred.login_url}"`);
      envLines.push('');
    }
  }

  return envLines.join('\n');
}

// ============================================================
// INTERNAL (not exposed via API)
// ============================================================

/**
 * Calculate price based on directory counts
 */
function calculatePrice(freeCount, paidCount) {
  const base = (freeCount * 3) + (paidCount * 10);
  const total = freeCount + paidCount;
  
  if (total >= 50) return Math.round(base * 0.6);
  if (total >= 25) return Math.round(base * 0.75);
  if (total >= 10) return Math.round(base * 0.85);
  return base;
}

/**
 * Get package pricing
 */
function getPackagePricing(pkg) {
  const packages = {
    starter: { price: 29, directories: 10, description: '10 free directories' },
    growth: { price: 79, directories: 25, description: '25 directories (free + paid)' },
    scale: { price: 149, directories: 50, description: '50+ directories' },
    enterprise: { price: 299, directories: 100, description: 'All 150+ directories' }
  };
  return packages[pkg] || packages.growth;
}

/**
 * Get matched directories for a client (INTERNAL)
 * This is the secret sauce - never expose full list
 */
async function getMatchedDirectories(email) {
  const client = await pool.query(`
    SELECT category, subcategories, package FROM listing_clients WHERE email = $1
  `, [email]);

  if (client.rows.length === 0) return [];

  const c = client.rows[0];
  const categories = [c.category, ...(c.subcategories || [])];
  const limit = getPackagePricing(c.package).directories;

  const result = await pool.query(`
    SELECT id, slug, name, url, submission_url, estimated_da, cost, requirements
    FROM listing_directories
    WHERE active = true AND category = ANY($1)
    ORDER BY estimated_da DESC
    LIMIT $2
  `, [categories, limit]);

  return result.rows;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Public API
  getCategories,
  previewMatch,
  registerClient,
  getClientStatus,
  getBacklinks,
  getCredentialsExport,
  
  // Internal
  getMatchedDirectories,
  calculatePrice,
  getPackagePricing
};
