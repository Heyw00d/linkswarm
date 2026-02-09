#!/usr/bin/env node
const fs = require('fs');
const { Pool } = require('pg');

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
    // Check all tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('All tables:', tables.rows.map(r => r.table_name));

    // Check columns in listing_submissions if it exists
    const cols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'listing_submissions'
      ORDER BY ordinal_position
    `);
    console.log('\nlisting_submissions columns:', cols.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

run();
