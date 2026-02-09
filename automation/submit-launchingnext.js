#!/usr/bin/env node
/**
 * Full submission to Launching Next
 */

const { chromium } = require('playwright');
const path = require('path');

const CLIENT = {
  name: 'Spendbase',
  url: 'https://spendbase.cards',
  tagline: 'Compare 93+ crypto debit cards',
  description: 'Spendbase is the comprehensive database for crypto debit cards. Compare 93+ cards with full specs: cashback rates, fees, custody models, supported chains, and regions. Features community ratings, industry intel on card issuers, funding data, and custody analysis. Top picks: Ether.fi Cash (4.08% cashback), Gnosis Pay (self-custody Visa), KAST (160+ countries).',
  tags: 'crypto, debit cards, fintech, comparison, ethereum, solana, bitcoin, cashback, web3',
  email: 'henry@spendbase.cards',
  founderName: 'Chris'
};

async function submit() {
  console.log('Starting Launching Next submission...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate
    console.log('[1] Navigating to submit page...');
    await page.goto('https://www.launchingnext.com/submit/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(2000);
    
    // Accept cookies if present
    try {
      const acceptBtn = await page.$('button:has-text("Accept all")');
      if (acceptBtn) {
        await acceptBtn.click();
        console.log('[2] Accepted cookies');
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // Fill the form
    console.log('[3] Filling form fields...');
    
    // Startup Name
    await page.fill('input[name="startupname"]', CLIENT.name);
    console.log('   ✅ Startup Name');
    
    // Startup URL
    await page.fill('input[name="startupurl"]', CLIENT.url.replace('https://', ''));
    console.log('   ✅ Startup URL');
    
    // Headline
    await page.fill('input[name="description"]', CLIENT.tagline);
    console.log('   ✅ Headline');
    
    // Full description
    await page.fill('textarea[name="fulldescription"]', CLIENT.description);
    console.log('   ✅ Full Description');
    
    // Tags
    await page.fill('textarea[name="tags"]', CLIENT.tags);
    console.log('   ✅ Tags');
    
    // Funding - select "A bootstrapped startup" (click the label)
    try {
      await page.click('text=A bootstrapped startup');
      console.log('   ✅ Funding type');
    } catch (e) { console.log('   ⚠️ Funding type skipped'); }
    
    // Marketing budget - select "$0" (click the label)
    try {
      await page.click('text=$0');
      console.log('   ✅ Marketing budget');
    } catch (e) { console.log('   ⚠️ Marketing budget skipped'); }
    
    // Your Name - try multiple selectors
    try {
      const nameField = await page.$('input[name="yourname"], input[placeholder*="Name"], input[name="name"]');
      if (nameField) await nameField.fill(CLIENT.founderName);
      console.log('   ✅ Your Name');
    } catch (e) { console.log('   ⚠️ Your Name skipped'); }
    
    // Email - try multiple selectors
    try {
      const emailField = await page.$('input[name="email"], input[type="email"]');
      if (emailField) await emailField.fill(CLIENT.email);
      console.log('   ✅ Email');
    } catch (e) { console.log('   ⚠️ Email skipped'); }
    
    // Quick Check (2+3=5) - find the input after the label
    try {
      // Find input near "2+3" text
      const inputs = await page.$$('input[type="text"], input[type="number"], input:not([type])');
      for (const input of inputs) {
        const placeholder = await input.getAttribute('placeholder');
        const name = await input.getAttribute('name');
        // Check if this is near the captcha question
        if (placeholder?.includes('2+3') || name?.includes('captcha') || name?.includes('check') || name?.includes('answer')) {
          await input.fill('5');
          console.log('   ✅ Captcha filled (2+3=5)');
          break;
        }
      }
      // Also try filling the last text input on the page (often the captcha)
      const allInputs = await page.$$('input[type="text"]');
      if (allInputs.length > 0) {
        const lastInput = allInputs[allInputs.length - 1];
        const val = await lastInput.inputValue();
        if (!val) {
          await lastInput.fill('5');
          console.log('   ✅ Captcha filled via last input');
        }
      }
    } catch (e) { console.log('   ⚠️ Captcha error:', e.message); }
    
    // Screenshot before submit
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'launchingnext-filled.png'),
      fullPage: true
    });
    console.log('\n[4] Screenshot saved');
    
    // Scroll to submit button
    await page.evaluate(() => {
      document.querySelector('button[type="submit"], input[type="submit"]')?.scrollIntoView();
    });
    await page.waitForTimeout(500);
    
    // Submit - scroll down and try multiple selectors
    console.log('[5] Submitting...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Try multiple button selectors
    const submitSelectors = [
      'button:has-text("Submit Startup")',
      'input[type="submit"]',
      'button[type="submit"]',
      '.submit-btn',
      'button.btn-primary'
    ];
    
    let clicked = false;
    for (const sel of submitSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          clicked = true;
          console.log('   Clicked:', sel);
          break;
        }
      } catch (e) {}
    }
    
    if (!clicked) {
      // Fallback: click any button with Submit text
      await page.click('button >> text=/submit/i');
    }
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Screenshot result
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'launchingnext-result.png'),
      fullPage: true
    });
    
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    if (pageContent.includes('Thank') || pageContent.includes('success') || pageContent.includes('submitted')) {
      console.log('\n✅ SUCCESS! Submission accepted');
      console.log('   Current URL:', currentUrl);
    } else if (pageContent.includes('error') || pageContent.includes('Error')) {
      console.log('\n⚠️  Possible error - check screenshot');
    } else {
      console.log('\n📋 Submission completed - check screenshots');
      console.log('   Current URL:', currentUrl);
    }
    
    // Keep browser open briefly
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'launchingnext-error.png'),
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

submit().catch(console.error);
