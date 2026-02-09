#!/usr/bin/env node
/**
 * Listing Swarm - Automated Directory Submissions
 * 
 * Submits products to S-Tier platforms that LLMs actually cite.
 * 88% of AI citations come from just 6 platforms. We focus on those.
 */

const fs = require('fs');
const path = require('path');

// Platform modules
const platforms = {
  g2: require('./platforms/g2'),
  capterra: require('./platforms/capterra'),
  crunchbase: require('./platforms/crunchbase'),
  producthunt: require('./platforms/producthunt'),
  reddit: require('./platforms/reddit'),
  github: require('./platforms/github'),
  trustradius: require('./platforms/trustradius'),
  getapp: require('./platforms/getapp'),
};

// Platform tiers
const TIERS = {
  s: ['g2', 'capterra', 'getapp', 'trustradius', 'crunchbase', 'producthunt', 'reddit', 'github'],
  a: ['hackernews', 'stackoverflow', 'devto', 'medium'],
  b: ['alternativeto', 'saashub', 'betalist', 'indiehackers'], // We skip these
};

// Load site config
function loadSiteConfig(siteId) {
  const configPath = path.join(__dirname, 'sites', `${siteId}.json`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Site config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Load submissions tracking
function loadSubmissions() {
  const submissionsPath = path.join(__dirname, 'submissions.json');
  if (!fs.existsSync(submissionsPath)) {
    return { submissions: [] };
  }
  return JSON.parse(fs.readFileSync(submissionsPath, 'utf8'));
}

// Save submissions tracking
function saveSubmissions(data) {
  const submissionsPath = path.join(__dirname, 'submissions.json');
  fs.writeFileSync(submissionsPath, JSON.stringify(data, null, 2));
}

// Check if already submitted
function isAlreadySubmitted(siteId, platformId, submissions) {
  return submissions.submissions.some(
    s => s.site === siteId && s.platform === platformId && s.status !== 'failed'
  );
}

// Generate submission ID
function generateSubmissionId() {
  return 'sub_' + Math.random().toString(36).substr(2, 9);
}

// Main submission orchestrator
async function runListingSwarm(options) {
  const { site, tier = 's', auto = 'partial', dryRun = false } = options;
  
  console.log(`\n🐝 Listing Swarm - Submitting ${site} to ${tier.toUpperCase()}-tier platforms\n`);
  
  // Load site config
  const siteConfig = loadSiteConfig(site);
  console.log(`📋 Loaded config for: ${siteConfig.name}`);
  console.log(`   URL: ${siteConfig.url}`);
  console.log(`   Category: ${siteConfig.category}\n`);
  
  // Load submissions
  const submissions = loadSubmissions();
  
  // Get platforms for this tier
  const platformList = TIERS[tier.toLowerCase()];
  if (!platformList) {
    throw new Error(`Unknown tier: ${tier}. Use 's', 'a', or 'b'.`);
  }
  
  console.log(`🎯 Targeting ${platformList.length} platforms:\n`);
  
  const results = [];
  
  for (const platformId of platformList) {
    // Check if already submitted
    if (isAlreadySubmitted(site, platformId, submissions)) {
      console.log(`⏭️  ${platformId}: Already submitted, skipping`);
      continue;
    }
    
    // Get platform module
    const platform = platforms[platformId];
    if (!platform) {
      console.log(`⚠️  ${platformId}: No submitter module yet`);
      continue;
    }
    
    console.log(`\n📤 ${platformId.toUpperCase()}`);
    console.log(`   Automation: ${platform.automation}`);
    console.log(`   Citation impact: ${platform.citationImpact || 'High'}`);
    
    try {
      if (dryRun) {
        console.log(`   [DRY RUN] Would submit to ${platformId}`);
        continue;
      }
      
      // Run submission based on automation level
      let result;
      if (auto === 'full' && platform.automation === 'full') {
        result = await platform.submit(siteConfig);
      } else if (auto === 'partial' || platform.automation === 'partial') {
        result = await platform.prepare(siteConfig);
      } else {
        result = platform.instructions(siteConfig);
      }
      
      // Log submission
      const submission = {
        id: generateSubmissionId(),
        site,
        platform: platformId,
        status: result.status || 'pending',
        submittedAt: new Date().toISOString(),
        listingUrl: result.url || null,
        notes: result.notes || '',
        automation: platform.automation,
      };
      
      submissions.submissions.push(submission);
      results.push(submission);
      
      console.log(`   Status: ${submission.status}`);
      if (submission.notes) console.log(`   Notes: ${submission.notes}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        platform: platformId,
        status: 'failed',
        error: error.message,
      });
    }
  }
  
  // Save submissions
  saveSubmissions(submissions);
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 SUBMISSION SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Total platforms: ${platformList.length}`);
  console.log(`Submitted: ${results.filter(r => r.status !== 'failed').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'failed').length}`);
  console.log(`Skipped: ${platformList.length - results.length}`);
  
  // Next steps
  console.log(`\n📝 NEXT STEPS:`);
  const pending = submissions.submissions.filter(
    s => s.site === site && s.status === 'pending'
  );
  for (const sub of pending) {
    console.log(`   - ${sub.platform}: ${sub.notes || 'Awaiting action'}`);
  }
  
  return results;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    site: null,
    tier: 's',
    auto: 'partial',
    dryRun: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--site':
        options.site = args[++i];
        break;
      case '--tier':
        options.tier = args[++i];
        break;
      case '--auto':
        options.auto = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Listing Swarm - Submit to S-Tier platforms

Usage:
  node listing-swarm.js --site <site-id> [options]

Options:
  --site <id>      Site ID (required, matches sites/<id>.json)
  --tier <s|a|b>   Platform tier (default: s)
  --auto <level>   Automation level: full, partial, manual (default: partial)
  --dry-run        Preview without submitting

Examples:
  node listing-swarm.js --site spendbase
  node listing-swarm.js --site linkswarm --auto full
  node listing-swarm.js --site mysite --dry-run
        `);
        process.exit(0);
    }
  }
  
  if (!options.site) {
    console.error('Error: --site is required');
    process.exit(1);
  }
  
  runListingSwarm(options)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err.message);
      process.exit(1);
    });
}

module.exports = { runListingSwarm };
