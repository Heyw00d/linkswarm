#!/usr/bin/env node
/**
 * LinkSwarm Email Verification Automation
 * 
 * Connects to client's email via IMAP, watches for verification emails,
 * extracts verification links, and confirms them.
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const https = require('https');
const http = require('http');

// Common verification email patterns
const VERIFICATION_PATTERNS = [
  // Link patterns in email body
  /href=["'](https?:\/\/[^"']*(?:verify|confirm|activate|validation|email)[^"']*)/gi,
  /href=["'](https?:\/\/[^"']*(?:token|code|key)=[^"']*)/gi,
  /(https?:\/\/[^\s<>"']*(?:verify|confirm|activate|validation)[^\s<>"']*)/gi,
  /(https?:\/\/[^\s<>"']*(?:token|code|key)=[^\s<>"']*)/gi,
];

// Known directory email domains
const DIRECTORY_DOMAINS = [
  'betalist.com', 'producthunt.com', 'saashub.com', 'alternativeto.net',
  'crunchbase.com', 'g2.com', 'capterra.com', 'trustpilot.com',
  'indiehackers.com', 'f6s.com', 'angellist.com', 'wellfound.com',
  'startupstash.com', 'betapage.co', 'slant.co', 'gust.com',
  'launchingnext.com', 'startupbase.io', 'killerstartups.com',
  'startupbuffer.com', 'sideprojectors.com', 'devhunt.org',
  // Add more as we discover them
];

class EmailVerifier {
  constructor(config) {
    this.config = {
      user: config.email,
      password: config.password,
      host: config.imapHost || this.guessImapHost(config.email),
      port: config.imapPort || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };
    this.imap = null;
    this.onVerificationLink = config.onVerificationLink || console.log;
  }

  guessImapHost(email) {
    const domain = email.split('@')[1];
    const hostMap = {
      'gmail.com': 'imap.gmail.com',
      'outlook.com': 'outlook.office365.com',
      'hotmail.com': 'outlook.office365.com',
      'yahoo.com': 'imap.mail.yahoo.com',
      'icloud.com': 'imap.mail.me.com',
      'spacemail.com': 'imap.spacemail.com',
    };
    return hostMap[domain] || `imap.${domain}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.imap = new Imap(this.config);
      
      this.imap.once('ready', () => {
        console.log('✓ IMAP connected');
        resolve();
      });
      
      this.imap.once('error', (err) => {
        console.error('✗ IMAP error:', err.message);
        reject(err);
      });
      
      this.imap.once('end', () => {
        console.log('IMAP connection ended');
      });
      
      this.imap.connect();
    });
  }

  disconnect() {
    if (this.imap) {
      this.imap.end();
    }
  }

  // Check for verification emails in inbox
  async checkForVerificationEmails(since = null, markAsRead = false) {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', !markAsRead, (err, box) => {
        if (err) return reject(err);

        // Search for recent unread emails
        const searchCriteria = ['UNSEEN'];
        if (since) {
          searchCriteria.push(['SINCE', since]);
        }

        this.imap.search(searchCriteria, (err, uids) => {
          if (err) return reject(err);
          if (!uids || uids.length === 0) {
            return resolve([]);
          }

          const results = [];
          const fetch = this.imap.fetch(uids, { bodies: '' });

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
              stream.on('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const fromDomain = this.extractDomain(parsed.from?.text || '');
                  
                  // Check if it's from a known directory
                  const isDirectoryEmail = DIRECTORY_DOMAINS.some(d => 
                    fromDomain.includes(d) || 
                    (parsed.from?.text || '').toLowerCase().includes(d)
                  );

                  // Look for verification keywords in subject
                  const subject = (parsed.subject || '').toLowerCase();
                  const isVerificationEmail = 
                    subject.includes('verify') ||
                    subject.includes('confirm') ||
                    subject.includes('activate') ||
                    subject.includes('welcome') ||
                    subject.includes('email address');

                  if (isDirectoryEmail || isVerificationEmail) {
                    const links = this.extractVerificationLinks(
                      parsed.html || parsed.textAsHtml || parsed.text || ''
                    );
                    
                    if (links.length > 0) {
                      results.push({
                        uid: uids[seqno - 1],
                        from: parsed.from?.text,
                        subject: parsed.subject,
                        date: parsed.date,
                        links: links,
                        isDirectoryEmail,
                      });
                    }
                  }
                } catch (e) {
                  console.error('Parse error:', e.message);
                }
              });
            });
          });

          fetch.once('error', reject);
          fetch.once('end', () => resolve(results));
        });
      });
    });
  }

  extractDomain(email) {
    const match = email.match(/@([^\s>]+)/);
    return match ? match[1].toLowerCase() : '';
  }

  extractVerificationLinks(html) {
    const links = new Set();
    
    for (const pattern of VERIFICATION_PATTERNS) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let link = match[1] || match[0];
        // Clean up the link
        link = link.replace(/&amp;/g, '&');
        // Skip common non-verification links
        if (!link.includes('unsubscribe') && 
            !link.includes('privacy') && 
            !link.includes('terms') &&
            !link.includes('mailto:')) {
          links.add(link);
        }
      }
    }
    
    return Array.from(links);
  }

  // Click a verification link
  async clickVerificationLink(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      console.log(`→ Clicking: ${url.substring(0, 80)}...`);
      
      const req = protocol.get(url, { 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          // Follow redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log(`  ↳ Redirect to: ${res.headers.location.substring(0, 60)}...`);
            this.clickVerificationLink(res.headers.location).then(resolve).catch(reject);
          } else {
            resolve({
              status: res.statusCode,
              success: res.statusCode >= 200 && res.statusCode < 400,
              body: body.substring(0, 500)
            });
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  // Watch inbox for new verification emails
  async watchInbox(callback, pollInterval = 30000) {
    console.log(`👀 Watching inbox (polling every ${pollInterval/1000}s)...`);
    
    const check = async () => {
      try {
        const emails = await this.checkForVerificationEmails();
        for (const email of emails) {
          await callback(email);
        }
      } catch (e) {
        console.error('Watch error:', e.message);
      }
    };

    // Initial check
    await check();

    // Poll periodically
    return setInterval(check, pollInterval);
  }

  // Process all pending verification emails
  async processAllPending(autoClick = false) {
    console.log('📧 Checking for verification emails...\n');
    
    const emails = await this.checkForVerificationEmails();
    
    if (emails.length === 0) {
      console.log('No verification emails found.');
      return [];
    }

    console.log(`Found ${emails.length} verification email(s):\n`);
    
    const results = [];
    
    for (const email of emails) {
      console.log(`From: ${email.from}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Links found: ${email.links.length}`);
      
      for (const link of email.links) {
        console.log(`  • ${link.substring(0, 70)}...`);
        
        if (autoClick) {
          try {
            const result = await this.clickVerificationLink(link);
            console.log(`    ${result.success ? '✓' : '✗'} Status: ${result.status}`);
            results.push({ email, link, result });
          } catch (e) {
            console.log(`    ✗ Error: ${e.message}`);
            results.push({ email, link, error: e.message });
          }
        }
      }
      console.log('');
    }

    return results;
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
LinkSwarm Email Verifier

Usage: node email-verifier.js <email> <password> [options]

Options:
  --check     Check for verification emails (default)
  --click     Auto-click verification links
  --watch     Watch inbox continuously
  --host      IMAP host (auto-detected if not provided)

Example:
  node email-verifier.js listings@company.com password123 --check
  node email-verifier.js listings@company.com password123 --click
`);
    process.exit(1);
  }

  const email = args[0];
  const password = args[1];
  const autoClick = args.includes('--click');
  const watch = args.includes('--watch');
  const hostIdx = args.indexOf('--host');
  const imapHost = hostIdx !== -1 ? args[hostIdx + 1] : null;

  const verifier = new EmailVerifier({
    email,
    password,
    imapHost
  });

  try {
    await verifier.connect();

    if (watch) {
      await verifier.watchInbox(async (email) => {
        console.log(`\n📬 New verification email from: ${email.from}`);
        console.log(`   Subject: ${email.subject}`);
        
        if (autoClick && email.links.length > 0) {
          for (const link of email.links) {
            try {
              const result = await verifier.clickVerificationLink(link);
              console.log(`   ${result.success ? '✓ Verified' : '✗ Failed'}`);
            } catch (e) {
              console.log(`   ✗ Error: ${e.message}`);
            }
          }
        }
      });
      
      // Keep running
      console.log('\nPress Ctrl+C to stop watching.\n');
    } else {
      const results = await verifier.processAllPending(autoClick);
      verifier.disconnect();
      
      console.log(`\nProcessed ${results.length} verification link(s).`);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { EmailVerifier };

// Run CLI if called directly
if (require.main === module) {
  main();
}
