#!/usr/bin/env node
/**
 * Test single directory submission flow
 */

const { chromium } = require('playwright');
const path = require('path');
const captchaSolver = require('../captcha-solver');

const TEST_CLIENT = {
  email: 'henry@spendbase.cards',
  name: 'Spendbase',
  url: 'https://spendbase.cards',
  tagline: 'Compare 93+ crypto debit cards',
  description: 'The largest crypto card comparison site. Find the best rates, cashback, and rewards.'
};

async function detectCaptcha(page) {
  return await page.evaluate(() => {
    // reCAPTCHA v2
    const recaptchaV2 = document.querySelector('.g-recaptcha, [data-sitekey]');
    if (recaptchaV2) {
      return {
        type: 'recaptcha_v2',
        siteKey: recaptchaV2.getAttribute('data-sitekey'),
        invisible: recaptchaV2.getAttribute('data-size') === 'invisible'
      };
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
        siteKey: turnstile.getAttribute('data-sitekey')
      };
    }

    return null;
  });
}

async function testDirectory(url, slug) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${slug}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();

  try {
    // Step 1: Navigate
    console.log('\n[1] Navigating...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', `${slug}-01-loaded.png`),
      fullPage: true
    });
    console.log('   Screenshot saved');

    // Step 2: Detect form fields
    console.log('\n[2] Detecting form fields...');
    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      return inputs.map(i => ({
        tag: i.tagName.toLowerCase(),
        type: i.type || 'text',
        name: i.name,
        id: i.id,
        placeholder: i.placeholder
      })).filter(f => f.name || f.id || f.placeholder);
    });
    console.log('   Found fields:', fields.length);
    fields.slice(0, 10).forEach(f => console.log(`   - ${f.name || f.id || f.placeholder} (${f.type})`));

    // Step 3: Detect CAPTCHA
    console.log('\n[3] Detecting CAPTCHA...');
    const captcha = await detectCaptcha(page);
    if (captcha) {
      console.log(`   Found: ${captcha.type}`);
      console.log(`   Site Key: ${captcha.siteKey}`);
      
      // Try to solve it
      console.log('\n[4] Solving CAPTCHA via 2Captcha...');
      let token;
      const pageUrl = page.url();
      
      if (captcha.type === 'recaptcha_v2') {
        token = await captchaSolver.solveRecaptchaV2(captcha.siteKey, pageUrl, { invisible: captcha.invisible });
      } else if (captcha.type === 'hcaptcha') {
        token = await captchaSolver.solveHCaptcha(captcha.siteKey, pageUrl);
      } else if (captcha.type === 'turnstile') {
        token = await captchaSolver.solveTurnstile(captcha.siteKey, pageUrl);
      }
      
      if (token) {
        console.log(`   ✅ Solved! Token length: ${token.length}`);
        console.log(`   Token preview: ${token.slice(0, 50)}...`);
      }
    } else {
      console.log('   No CAPTCHA detected');
    }

    // Step 4: Try filling form
    console.log('\n[5] Attempting to fill form...');
    
    // Common selectors to try
    const fillAttempts = [
      { selector: 'input[name="email"], input[type="email"], #email', value: TEST_CLIENT.email },
      { selector: 'input[name="name"], input[name="tool_name"], input[name="product"], #name', value: TEST_CLIENT.name },
      { selector: 'input[name="url"], input[name="website"], input[type="url"], #url', value: TEST_CLIENT.url },
      { selector: 'input[name="tagline"], input[name="description"], #tagline', value: TEST_CLIENT.tagline },
      { selector: 'textarea[name="description"], textarea#description', value: TEST_CLIENT.description }
    ];

    for (const attempt of fillAttempts) {
      try {
        const el = await page.$(attempt.selector);
        if (el) {
          await el.fill(attempt.value);
          console.log(`   ✅ Filled: ${attempt.selector.slice(0, 40)}`);
        }
      } catch (e) {}
    }

    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', `${slug}-02-filled.png`),
      fullPage: true
    });

    // Keep browser open for inspection
    console.log('\n[6] Browser open for inspection. Press Ctrl+C to close.');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', `${slug}-error.png`),
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

// Run test
const url = process.argv[2] || 'https://futuretools.io/submit-a-tool';
const slug = process.argv[3] || 'futuretools';

testDirectory(url, slug).catch(console.error);
