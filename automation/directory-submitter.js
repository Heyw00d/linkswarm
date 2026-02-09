#!/usr/bin/env node
/**
 * Directory Submitter - Full automation flow
 * 
 * 1. Navigate to directory signup
 * 2. Fill form with client info
 * 3. Solve CAPTCHA via 2Captcha
 * 4. Submit and verify email via IMAP
 * 5. Submit listing
 * 6. Store credentials
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Load modules from parent
const captchaSolver = require('../captcha-solver');
const imapModule = require('../src/imap');

// Load env
const envPath = process.env.HOME + '/clawd/.env.linkswarm';
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const { Pool } = require('pg');
const pool = new Pool({
  host: env.NEON_HOST,
  database: env.NEON_DB,
  user: env.NEON_USER,
  password: env.NEON_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

/**
 * Generate a secure password
 */
function generatePassword() {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = 'Ls';
  for (let i = 0; i < 10; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass + '!';
}

/**
 * Detect CAPTCHA type on page
 */
async function detectCaptcha(page) {
  const captchaInfo = await page.evaluate(() => {
    // reCAPTCHA v2
    const recaptchaV2 = document.querySelector('.g-recaptcha, [data-sitekey]');
    if (recaptchaV2) {
      return {
        type: 'recaptcha_v2',
        siteKey: recaptchaV2.getAttribute('data-sitekey'),
        invisible: recaptchaV2.getAttribute('data-size') === 'invisible'
      };
    }

    // reCAPTCHA v3 (check for grecaptcha.execute in scripts)
    const scripts = Array.from(document.scripts).map(s => s.innerHTML).join('');
    const v3Match = scripts.match(/grecaptcha\.execute\s*\(\s*['"]([^'"]+)['"]/);
    if (v3Match) {
      return { type: 'recaptcha_v3', siteKey: v3Match[1] };
    }

    // hCaptcha
    const hcaptcha = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
    if (hcaptcha) {
      return {
        type: 'hcaptcha',
        siteKey: hcaptcha.getAttribute('data-sitekey') || hcaptcha.getAttribute('data-hcaptcha-sitekey')
      };
    }

    // Cloudflare Turnstile
    const turnstile = document.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
    if (turnstile) {
      return {
        type: 'turnstile',
        siteKey: turnstile.getAttribute('data-sitekey') || turnstile.getAttribute('data-turnstile-sitekey')
      };
    }

    // Image captcha (look for common patterns)
    const captchaImg = document.querySelector('img[src*="captcha"], img[alt*="captcha"], .captcha-image');
    if (captchaImg) {
      return { type: 'image', imageUrl: captchaImg.src };
    }

    return null;
  });

  return captchaInfo;
}

/**
 * Solve CAPTCHA and inject token
 */
async function solveCaptcha(page, captchaInfo) {
  const pageUrl = page.url();
  console.log(`[CAPTCHA] Detected ${captchaInfo.type} on ${pageUrl}`);

  let token;

  switch (captchaInfo.type) {
    case 'recaptcha_v2':
      token = await captchaSolver.solveRecaptchaV2(
        captchaInfo.siteKey, 
        pageUrl,
        { invisible: captchaInfo.invisible }
      );
      // Inject token
      await page.evaluate((t) => {
        document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]').value = t;
        // Also set in textarea if hidden
        const textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (textarea) {
          textarea.innerHTML = t;
          textarea.value = t;
        }
        // Trigger callback if exists
        if (typeof ___grecaptcha_cfg !== 'undefined') {
          const clientKey = Object.keys(___grecaptcha_cfg.clients)[0];
          const callback = ___grecaptcha_cfg.clients[clientKey]?.callback;
          if (callback) callback(t);
        }
      }, token);
      break;

    case 'recaptcha_v3':
      token = await captchaSolver.solveRecaptchaV3(captchaInfo.siteKey, pageUrl);
      await page.evaluate((t) => {
        const input = document.querySelector('[name="g-recaptcha-response"]');
        if (input) input.value = t;
      }, token);
      break;

    case 'hcaptcha':
      token = await captchaSolver.solveHCaptcha(captchaInfo.siteKey, pageUrl);
      await page.evaluate((t) => {
        const input = document.querySelector('[name="h-captcha-response"], [name="g-recaptcha-response"]');
        if (input) input.value = t;
        // hCaptcha iframe response
        const iframe = document.querySelector('iframe[src*="hcaptcha"]');
        if (iframe) {
          iframe.setAttribute('data-hcaptcha-response', t);
        }
      }, token);
      break;

    case 'turnstile':
      token = await captchaSolver.solveTurnstile(captchaInfo.siteKey, pageUrl);
      await page.evaluate((t) => {
        const input = document.querySelector('[name="cf-turnstile-response"]');
        if (input) input.value = t;
      }, token);
      break;

    case 'image':
      // Screenshot the captcha image and solve
      const imgElement = await page.$('img[src*="captcha"], img[alt*="captcha"], .captcha-image');
      const imgBuffer = await imgElement.screenshot();
      token = await captchaSolver.solveImage(imgBuffer);
      // Find the input field near the captcha
      await page.evaluate((t) => {
        const input = document.querySelector('input[name*="captcha"], input[placeholder*="captcha"], .captcha-input');
        if (input) input.value = t;
      }, token);
      break;
  }

  console.log(`[CAPTCHA] Solved, token length: ${token?.length || 0}`);
  return token;
}

/**
 * Fill common signup form fields
 */
async function fillSignupForm(page, client, directory) {
  const password = generatePassword();
  
  // Common field mappings
  const fieldMappings = {
    // Email fields
    'input[name="email"], input[type="email"], #email': client.email,
    // Password fields
    'input[name="password"], input[type="password"], #password': password,
    'input[name="password_confirmation"], input[name="confirm_password"], #password-confirm': password,
    // Name fields
    'input[name="name"], input[name="full_name"], #name': client.name,
    'input[name="username"], #username': client.email.split('@')[0],
    // URL fields
    'input[name="url"], input[name="website"], input[type="url"], #url, #website': client.url,
    // Company/Product name
    'input[name="company"], input[name="product_name"], input[name="tool_name"], #company': client.name,
    // Tagline
    'input[name="tagline"], input[name="short_description"], #tagline': client.tagline,
    // Description
    'textarea[name="description"], textarea[name="about"], #description': client.description_short || client.tagline
  };

  for (const [selector, value] of Object.entries(fieldMappings)) {
    if (!value) continue;
    try {
      const field = await page.$(selector);
      if (field) {
        await field.fill(value);
        console.log(`[FORM] Filled ${selector.slice(0, 30)}...`);
      }
    } catch (e) {
      // Field not found, continue
    }
  }

  return password;
}

/**
 * Submit a single directory
 */
async function submitToDirectory(client, directory, imapCredentials) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[START] Submitting ${client.name} to ${directory.name}`);
  console.log(`${'='.repeat(60)}`);

  const browser = await chromium.launch({ 
    headless: false, // Set to true for production
    slowMo: 100 
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  let password = null;
  let success = false;
  let listingUrl = null;
  let errorMessage = null;

  try {
    // Step 1: Navigate to signup/submit page
    console.log(`[NAV] Going to ${directory.submission_url}`);
    await page.goto(directory.submission_url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Screenshot for debugging
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', `${directory.slug}-01-initial.png`) 
    });

    // Step 2: Fill signup form
    console.log('[FORM] Filling form fields...');
    password = await fillSignupForm(page, client, directory);

    // Step 3: Check for CAPTCHA
    const captchaInfo = await detectCaptcha(page);
    if (captchaInfo) {
      await solveCaptcha(page, captchaInfo);
    }

    // Screenshot before submit
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', `${directory.slug}-02-filled.png`) 
    });

    // Step 4: Submit form
    console.log('[SUBMIT] Looking for submit button...');
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign Up"), button:has-text("Submit"), button:has-text("Register"), button:has-text("Create")');
    
    if (submitButton) {
      await submitButton.click();
      await page.waitForTimeout(5000);
      
      // Screenshot after submit
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', `${directory.slug}-03-submitted.png`) 
      });
    }

    // Step 5: Check for email verification
    if (imapCredentials) {
      console.log('[EMAIL] Waiting for verification email...');
      const verification = await imapModule.waitForVerification(imapCredentials, {
        since: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        maxWait: 120000 // 2 minutes
      });

      if (verification.success && verification.verificationLink) {
        console.log(`[EMAIL] Found verification link: ${verification.verificationLink.slice(0, 50)}...`);
        await page.goto(verification.verificationLink, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        await page.screenshot({ 
          path: path.join(__dirname, 'screenshots', `${directory.slug}-04-verified.png`) 
        });
      }
    }

    // Step 6: Try to find listing URL
    listingUrl = page.url();
    if (listingUrl.includes(directory.url)) {
      console.log(`[SUCCESS] Listing URL: ${listingUrl}`);
      success = true;
    }

  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    errorMessage = error.message;
    
    // Screenshot error state
    try {
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', `${directory.slug}-error.png`) 
      });
    } catch (e) {}
  } finally {
    await browser.close();
  }

  // Store result in database
  await pool.query(`
    INSERT INTO listing_submissions (
      client_email, client_name, directory_id, directory_slug,
      status, site_username, site_password, listing_url, error_message,
      submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (client_email, directory_slug) DO UPDATE SET
      status = $5, site_username = $6, site_password = $7, 
      listing_url = $8, error_message = $9, updated_at = NOW()
  `, [
    client.email, client.name, directory.id, directory.slug,
    success ? 'submitted' : 'failed',
    client.email, password, listingUrl, errorMessage
  ]);

  return { success, listingUrl, password, error: errorMessage };
}

/**
 * Process all directories for a client
 */
async function processClient(clientEmail) {
  // Get client info
  const clientResult = await pool.query(`
    SELECT * FROM listing_clients WHERE email = $1
  `, [clientEmail]);

  if (clientResult.rows.length === 0) {
    throw new Error('Client not found');
  }

  const client = clientResult.rows[0];

  // Get IMAP credentials
  const imapResult = await pool.query(`
    SELECT * FROM listing_client_emails WHERE client_email = $1
  `, [client.email]);

  const imapCredentials = imapResult.rows[0] ? {
    host: imapResult.rows[0].imap_host,
    port: 993,
    user: imapResult.rows[0].listings_email,
    password: imapResult.rows[0].listings_email_password
  } : null;

  // Get matched directories
  const categories = [client.category, ...(client.subcategories || [])];
  const dirResult = await pool.query(`
    SELECT * FROM listing_directories
    WHERE active = true AND category = ANY($1)
    ORDER BY estimated_da DESC
    LIMIT 50
  `, [categories]);

  console.log(`\nProcessing ${client.name} - ${dirResult.rows.length} directories matched\n`);

  const results = [];
  for (const directory of dirResult.rows) {
    // Check if already submitted
    const existing = await pool.query(`
      SELECT status FROM listing_submissions 
      WHERE client_email = $1 AND directory_slug = $2
    `, [client.email, directory.slug]);

    if (existing.rows.length > 0 && existing.rows[0].status !== 'failed') {
      console.log(`[SKIP] ${directory.name} - already ${existing.rows[0].status}`);
      continue;
    }

    const result = await submitToDirectory(client, directory, imapCredentials);
    results.push({ directory: directory.name, ...result });

    // Rate limit - wait between submissions
    await new Promise(r => setTimeout(r, 5000));
  }

  return results;
}

// CLI interface
if (require.main === module) {
  const clientEmail = process.argv[2];
  
  if (!clientEmail) {
    console.log('Usage: node directory-submitter.js <client-email>');
    console.log('\nThis will submit the client to all matched directories.');
    process.exit(1);
  }

  processClient(clientEmail)
    .then(results => {
      console.log('\n' + '='.repeat(60));
      console.log('RESULTS:');
      console.log('='.repeat(60));
      results.forEach(r => {
        console.log(`${r.success ? '✅' : '❌'} ${r.directory}: ${r.listingUrl || r.error}`);
      });
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  submitToDirectory,
  processClient,
  detectCaptcha,
  solveCaptcha,
  fillSignupForm
};
