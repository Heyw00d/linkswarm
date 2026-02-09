#!/usr/bin/env node
/**
 * Scrape aidirectori.es via Playwright
 * Run with: node aidirectories-scraper.js
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.error('Loading aidirectori.es...');
  await page.goto('https://www.aidirectori.es/', { waitUntil: 'networkidle' });
  
  const allDirectories = [];
  let pageNum = 1;
  
  while (true) {
    console.error(`Scraping page ${pageNum}...`);
    
    // Extract directories from current page
    const dirs = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        const nameEl = cells[0]?.querySelector('h3');
        let name = nameEl?.textContent?.replace(' Has Deal', '').trim();
        
        // Skip paywalled entries
        if (name?.includes('Get AI Directories')) return null;
        
        const visitLink = cells[6]?.querySelector('a')?.href;
        const submitLink = cells[7]?.querySelector('a')?.href;
        const dr = cells[2]?.textContent?.trim();
        const visits = cells[3]?.textContent?.trim();
        const experience = cells[4]?.textContent?.trim();
        const pricing = cells[5]?.textContent?.trim();
        
        if (!name || !visitLink) return null;
        
        return { 
          name, 
          url: visitLink?.split('?')[0], // Remove tracking params
          submitUrl: submitLink?.split('?')[0],
          domainRating: parseInt(dr) || 0,
          monthlyVisits: visits,
          experience,
          pricing
        };
      }).filter(Boolean);
    });
    
    allDirectories.push(...dirs);
    
    // Check for next button
    const nextBtn = await page.$('button:has-text("Next"):not([disabled])');
    if (!nextBtn) {
      console.error('No more pages');
      break;
    }
    
    await nextBtn.click();
    await page.waitForTimeout(1000);
    pageNum++;
  }
  
  await browser.close();
  
  // Deduplicate by URL
  const seen = new Set();
  const unique = allDirectories.filter(d => {
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
  
  // Sort by DR
  unique.sort((a, b) => b.domainRating - a.domainRating);
  
  console.log(JSON.stringify(unique, null, 2));
  console.error(`\nTotal: ${unique.length} directories scraped`);
  
  // Save to file
  fs.writeFileSync(__dirname + '/aidirectories-list.json', JSON.stringify(unique, null, 2));
  console.error('Saved to aidirectories-list.json');
}

scrape().catch(console.error);
