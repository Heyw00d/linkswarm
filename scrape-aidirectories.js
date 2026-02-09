#!/usr/bin/env node
/**
 * Scrape all directories from aidirectori.es
 * Outputs JSON with name, url, submitUrl, domainRating, monthlyVisits, pricing
 */

const https = require('https');

async function fetchPage(page = 1) {
  return new Promise((resolve, reject) => {
    const url = `https://www.aidirectori.es/api/directories?page=${page}&limit=50`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.error('Fetching directories from aidirectori.es...');
  
  const allDirectories = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      console.error(`Fetching page ${page}...`);
      const response = await fetchPage(page);
      
      if (response.directories && response.directories.length > 0) {
        allDirectories.push(...response.directories);
        page++;
        
        // Check if there are more pages
        if (response.directories.length < 50) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error('Error fetching page:', e.message);
      hasMore = false;
    }
  }
  
  // Format output
  const formatted = allDirectories.map(d => ({
    name: d.name,
    url: d.url,
    submitUrl: d.submissionUrl,
    domainRating: d.domainRating || d.dr,
    monthlyVisits: d.monthlyVisits,
    pricing: d.pricing,
    category: d.category,
    experience: d.experience
  }));
  
  console.log(JSON.stringify(formatted, null, 2));
  console.error(`\nTotal: ${formatted.length} directories`);
}

main().catch(console.error);
