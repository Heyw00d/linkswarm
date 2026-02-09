#!/usr/bin/env node
/**
 * LinkSwarm Credential Manager
 * 
 * Manages directory site credentials for listing clients:
 * - Generates secure passwords
 * - Handles name fallback (Spendbase → spendbase.cards → Spendbase Cards)
 * - Stores/retrieves credentials
 * - Exports credentials for client handoff
 */

const crypto = require('crypto');
const fs = require('fs');
const { Pool } = require('pg');

// Load database config
const envFile = fs.readFileSync(process.env.HOME + '/clawd/.env.linkswarm', 'utf8');
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

class CredentialManager {
  
  // Generate a secure random password
  static generatePassword(length = 12) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[randomBytes[i] % chars.length];
    }
    return password;
  }

  // Generate name fallbacks for a product
  static generateNameFallbacks(productName, domain) {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return [
      productName,                                    // "Spendbase"
      cleanDomain,                                    // "spendbase.cards"
      `${productName} (${cleanDomain})`,             // "Spendbase (spendbase.cards)"
      productName.replace(/\s+/g, '') + '_official', // "Spendbase_official"
      cleanDomain.replace(/\./g, '_'),               // "spendbase_cards"
    ];
  }

  // Store client's listings email credentials
  static async storeClientEmail(clientEmail, listingsEmail, password, imapHost = null, smtpHost = null) {
    await pool.query(`
      INSERT INTO listing_client_emails (client_email, listings_email, listings_email_password, imap_host, smtp_host)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (client_email) DO UPDATE SET
        listings_email = EXCLUDED.listings_email,
        listings_email_password = EXCLUDED.listings_email_password,
        imap_host = COALESCE(EXCLUDED.imap_host, listing_client_emails.imap_host),
        smtp_host = COALESCE(EXCLUDED.smtp_host, listing_client_emails.smtp_host)
    `, [clientEmail, listingsEmail, password, imapHost, smtpHost]);
  }

  // Get client's listings email credentials
  static async getClientEmail(clientEmail) {
    const result = await pool.query(
      'SELECT * FROM listing_client_emails WHERE client_email = $1',
      [clientEmail]
    );
    return result.rows[0] || null;
  }

  // Store credentials for a specific directory submission
  static async storeSubmissionCredentials(clientEmail, directorySlug, data) {
    await pool.query(`
      UPDATE listing_submissions SET
        site_username = COALESCE($3, site_username),
        site_password = COALESCE($4, site_password),
        account_created_at = COALESCE($5, account_created_at),
        verified_at = COALESCE($6, verified_at),
        product_name_used = COALESCE($7, product_name_used),
        status = COALESCE($8, status)
      WHERE client_email = $1 AND directory_slug = $2
    `, [
      clientEmail,
      directorySlug,
      data.username,
      data.password,
      data.accountCreatedAt,
      data.verifiedAt,
      data.productNameUsed,
      data.status
    ]);
  }

  // Get all credentials for a client
  static async getAllCredentials(clientEmail) {
    const result = await pool.query(`
      SELECT 
        s.directory_slug,
        d.name as directory_name,
        d.url as directory_url,
        s.site_username,
        s.site_password,
        s.product_name_used,
        s.status,
        s.account_created_at,
        s.verified_at,
        s.listing_url
      FROM listing_submissions s
      LEFT JOIN listing_directories d ON s.directory_slug = d.slug
      WHERE s.client_email = $1
      ORDER BY d.estimated_da DESC NULLS LAST
    `, [clientEmail]);
    
    return result.rows;
  }

  // Export credentials as CSV for client
  static async exportCredentialsCSV(clientEmail) {
    const creds = await this.getAllCredentials(clientEmail);
    
    const headers = ['Directory', 'URL', 'Username', 'Password', 'Product Name', 'Status', 'Listing URL'];
    const rows = creds.map(c => [
      c.directory_name || c.directory_slug,
      c.directory_url || '',
      c.site_username || '',
      c.site_password || '',
      c.product_name_used || '',
      c.status || '',
      c.listing_url || ''
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    return csv;
  }

  // Export credentials as JSON
  static async exportCredentialsJSON(clientEmail) {
    const clientCreds = await this.getClientEmail(clientEmail);
    const submissions = await this.getAllCredentials(clientEmail);
    
    return {
      client_email: clientEmail,
      listings_email: clientCreds?.listings_email,
      generated_at: new Date().toISOString(),
      directories: submissions.map(s => ({
        directory: s.directory_name || s.directory_slug,
        url: s.directory_url,
        credentials: {
          username: s.site_username,
          password: s.site_password
        },
        product_name: s.product_name_used,
        status: s.status,
        listing_url: s.listing_url
      }))
    };
  }

  // Generate a credential report summary
  static async generateReport(clientEmail) {
    const creds = await this.getAllCredentials(clientEmail);
    
    const stats = {
      total: creds.length,
      accountsCreated: creds.filter(c => c.site_password).length,
      verified: creds.filter(c => c.verified_at).length,
      live: creds.filter(c => c.status === 'approved' || c.listing_url).length,
      pending: creds.filter(c => c.status === 'pending' || c.status === 'submitted').length,
    };
    
    return {
      clientEmail,
      stats,
      credentials: creds
    };
  }
}

// CLI
async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.log(`
LinkSwarm Credential Manager

Commands:
  generate-password              Generate a random password
  store-email <client> <listings-email> <password>   Store client email creds
  get-email <client>            Get client email creds
  store-creds <client> <directory> <username> <password>  Store directory creds
  get-all <client>              Get all credentials for client
  export-csv <client>           Export credentials as CSV
  export-json <client>          Export credentials as JSON
  report <client>               Generate credential report
  name-fallbacks <name> <domain>  Generate name fallbacks

Example:
  node credential-manager.js generate-password
  node credential-manager.js store-email henry@spendbase.cards listings@spendbase.cards mypassword
  node credential-manager.js export-csv henry@spendbase.cards > creds.csv
`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'generate-password':
        console.log(CredentialManager.generatePassword(args[0] || 12));
        break;

      case 'name-fallbacks':
        const fallbacks = CredentialManager.generateNameFallbacks(args[0], args[1]);
        fallbacks.forEach((f, i) => console.log(`${i + 1}. ${f}`));
        break;

      case 'store-email':
        await CredentialManager.storeClientEmail(args[0], args[1], args[2], args[3], args[4]);
        console.log('✓ Client email credentials stored');
        break;

      case 'get-email':
        const emailCreds = await CredentialManager.getClientEmail(args[0]);
        console.log(JSON.stringify(emailCreds, null, 2));
        break;

      case 'store-creds':
        await CredentialManager.storeSubmissionCredentials(args[0], args[1], {
          username: args[2],
          password: args[3],
          accountCreatedAt: new Date()
        });
        console.log('✓ Directory credentials stored');
        break;

      case 'get-all':
        const allCreds = await CredentialManager.getAllCredentials(args[0]);
        console.log(JSON.stringify(allCreds, null, 2));
        break;

      case 'export-csv':
        const csv = await CredentialManager.exportCredentialsCSV(args[0]);
        console.log(csv);
        break;

      case 'export-json':
        const json = await CredentialManager.exportCredentialsJSON(args[0]);
        console.log(JSON.stringify(json, null, 2));
        break;

      case 'report':
        const report = await CredentialManager.generateReport(args[0]);
        console.log('\n📊 Credential Report for:', report.clientEmail);
        console.log('═'.repeat(50));
        console.log(`Total directories: ${report.stats.total}`);
        console.log(`Accounts created:  ${report.stats.accountsCreated}`);
        console.log(`Verified:          ${report.stats.verified}`);
        console.log(`Live listings:     ${report.stats.live}`);
        console.log(`Pending:           ${report.stats.pending}`);
        break;

      default:
        console.error('Unknown command:', command);
        process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

module.exports = { CredentialManager };

if (require.main === module) {
  main();
}
