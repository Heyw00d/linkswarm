#!/usr/bin/env node
const fs = require('fs');
const { Pool } = require('pg');

// Load env
const envPath = process.env.HOME + '/clawd/.env.linkswarm';
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const pool = new Pool({
  host: env.NEON_HOST,
  database: env.NEON_DB,
  user: env.NEON_USER,
  password: env.NEON_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Create tables explicitly
    console.log('Creating listing_sites...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_sites (
        site_id VARCHAR(32) PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        categories TEXT[] NOT NULL,
        email TEXT NOT NULL,
        imap_host TEXT NOT NULL,
        imap_port INTEGER DEFAULT 993,
        imap_user TEXT NOT NULL,
        imap_pass TEXT NOT NULL,
        name TEXT,
        tagline TEXT,
        description TEXT,
        logo TEXT,
        screenshots TEXT[],
        matched_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('Creating listing_submissions...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_submissions (
        id SERIAL PRIMARY KEY,
        site_id VARCHAR(32) REFERENCES listing_sites(site_id),
        directory_slug VARCHAR(64) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        listing_url TEXT,
        estimated_dr INTEGER,
        submitted_at TIMESTAMPTZ,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(site_id, directory_slug)
      )
    `);

    console.log('Creating listing_credentials...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_credentials (
        id SERIAL PRIMARY KEY,
        site_id VARCHAR(32) REFERENCES listing_sites(site_id),
        directory_slug VARCHAR(64) NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        login_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(site_id, directory_slug)
      )
    `);

    console.log('Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_sites_status ON listing_sites(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_submissions_site ON listing_submissions(site_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_submissions_status ON listing_submissions(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_listing_credentials_site ON listing_credentials(site_id)`);

    console.log('✅ Listing Swarm schema created successfully');
    
    // Verify tables
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'listing_%'
    `);
    console.log('Tables created:', result.rows.map(r => r.table_name).join(', '));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

run();
