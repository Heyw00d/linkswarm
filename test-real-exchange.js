#!/usr/bin/env node
/**
 * LinkSwarm Real Exchange Test
 * Tests actual link exchange between verified sites
 */

const API = 'https://api.linkswarm.ai';

// Real verified sites with shared API key
const API_KEY = 'sk_linkswarm_f29fc93aaa2d2d61e03d427f3cc755cc70f26a08c72ce6be';

const SITE_A = {
  domain: 'spendbase.cards',
  name: 'Spendbase',
  page: '/resources/partners',
  categories: ['crypto', 'fintech']
};

const SITE_B = {
  domain: 'usdckey.com',
  name: 'USDCkey',
  page: '/guides/tools',
  categories: ['crypto', 'stablecoin']
};

// Colors
const c = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }
function success(msg) { log('✅', `${c.green}${msg}${c.reset}`); }
function error(msg) { log('❌', `${c.red}${msg}${c.reset}`); }
function info(msg) { log('ℹ️', `${c.blue}${msg}${c.reset}`); }
function warn(msg) { log('⚠️', `${c.yellow}${msg}${c.reset}`); }
function step(num, msg) { console.log(`\n${c.bold}[${num}]${c.reset} ${c.cyan}${msg}${c.reset}`); }

async function api(method, path, body = null) {
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, ok: res.ok };
  } catch (e) {
    return { status: 0, data: { error: e.message }, ok: false };
  }
}

async function runTest() {
  console.log(`\n${c.bold}🐝 LinkSwarm Real Exchange Test${c.reset}`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`Testing exchange between:`);
  console.log(`  • ${SITE_A.domain} (${SITE_A.name})`);
  console.log(`  • ${SITE_B.domain} (${SITE_B.name})\n`);

  // ============ STEP 1: Check Sites Status ============
  step(1, 'Verify Sites Exist');
  
  const sitesA = await api('GET', '/v1/sites');
  if (sitesA.ok) {
    const mySites = sitesA.data.sites || sitesA.data || [];
    success(`Found ${mySites.length} site(s) for this API key`);
    mySites.forEach(s => info(`  ${s.domain} (verified: ${s.verified})`));
  } else {
    error(`Failed to get sites: ${JSON.stringify(sitesA.data)}`);
  }

  // ============ STEP 2: Check Pool Status Before ============
  step(2, 'Check Pool Status (Before)');
  
  const poolBefore = await api('GET', '/v1/pool/status');
  if (poolBefore.ok) {
    success('Pool status:');
    console.log(`   Credits: ${JSON.stringify(poolBefore.data.credits || poolBefore.data.balance)}`);
    console.log(`   Contributions: ${poolBefore.data.contributions || 0}`);
    console.log(`   Pending: ${poolBefore.data.pending || 0}`);
  } else {
    warn(`Pool status: ${JSON.stringify(poolBefore.data)}`);
  }

  // ============ STEP 3: Spendbase Contributes a Link ============
  step(3, `${SITE_A.domain} Contributes Link Slot`);
  
  const contributeA = await api('POST', '/v1/pool/contribute', {
    domain: SITE_A.domain,
    page: SITE_A.page,
    max_links: 2,
    categories: SITE_A.categories,
    context: 'Partner tools and resources for crypto users'
  });
  
  if (contributeA.ok) {
    success(`Contribution created!`);
    info(`ID: ${contributeA.data.id || contributeA.data.contributionId}`);
    info(`Available slots: ${contributeA.data.max_links || 2}`);
  } else {
    error(`Contribute failed: ${JSON.stringify(contributeA.data)}`);
  }

  // ============ STEP 4: USDCkey Contributes a Link ============
  step(4, `${SITE_B.domain} Contributes Link Slot`);
  
  const contributeB = await api('POST', '/v1/pool/contribute', {
    domain: SITE_B.domain,
    page: SITE_B.page,
    max_links: 2,
    categories: SITE_B.categories,
    context: 'Essential tools for stablecoin users'
  });
  
  if (contributeB.ok) {
    success(`Contribution created!`);
    info(`ID: ${contributeB.data.id || contributeB.data.contributionId}`);
  } else {
    error(`Contribute failed: ${JSON.stringify(contributeB.data)}`);
  }

  // ============ STEP 5: Check Pool After Contributions ============
  step(5, 'Check Pool Status (After Contributions)');
  
  const poolAfter = await api('GET', '/v1/pool/status');
  if (poolAfter.ok) {
    success('Pool status updated:');
    console.log(`   Credits: ${JSON.stringify(poolAfter.data.credits || poolAfter.data.balance)}`);
    console.log(`   Contributions: ${poolAfter.data.contributions || 0}`);
  }

  // ============ STEP 6: Spendbase Requests Link from Pool ============
  step(6, `${SITE_A.domain} Requests Link`);
  
  const requestA = await api('POST', '/v1/pool/request', {
    domain: SITE_A.domain,
    target_page: '/crypto-cards',
    anchor_text: 'compare crypto cards',
    categories: ['crypto', 'fintech']
  });
  
  if (requestA.ok) {
    success(`Link request created!`);
    if (requestA.data.match) {
      info(`Matched with: ${requestA.data.match.domain}`);
      info(`Will be placed on: ${requestA.data.match.page}`);
    } else if (requestA.data.requestId) {
      info(`Request queued: ${requestA.data.requestId}`);
      info(`Waiting for matching contribution...`);
    }
    console.log(`   Full response: ${JSON.stringify(requestA.data, null, 2)}`);
  } else {
    error(`Request failed: ${JSON.stringify(requestA.data)}`);
  }

  // ============ STEP 7: USDCkey Requests Link ============
  step(7, `${SITE_B.domain} Requests Link`);
  
  const requestB = await api('POST', '/v1/pool/request', {
    domain: SITE_B.domain,
    target_page: '/usdc-spending-guide',
    anchor_text: 'USDC spending guide',
    categories: ['crypto', 'stablecoin']
  });
  
  if (requestB.ok) {
    success(`Link request created!`);
    console.log(`   Full response: ${JSON.stringify(requestB.data, null, 2)}`);
  } else {
    error(`Request failed: ${JSON.stringify(requestB.data)}`);
  }

  // ============ STEP 8: Check Exchanges ============
  step(8, 'Check Exchange History');
  
  const exchanges = await api('GET', '/v1/exchanges');
  if (exchanges.ok) {
    const list = exchanges.data.exchanges || exchanges.data || [];
    success(`Found ${Array.isArray(list) ? list.length : 0} exchange(s)`);
    if (Array.isArray(list) && list.length > 0) {
      list.slice(0, 5).forEach(ex => {
        console.log(`   ${ex.source_domain || ex.sourceDomain} ↔ ${ex.target_domain || ex.targetDomain}`);
        console.log(`      Status: ${ex.status}, Created: ${ex.created_at}`);
      });
    }
  } else {
    warn(`Exchanges: ${JSON.stringify(exchanges.data)}`);
  }

  // ============ STEP 9: Check Link Requests ============
  step(9, 'Check Pending Link Requests');
  
  const requests = await api('GET', '/v1/pool/requests');
  if (requests.ok) {
    const list = requests.data.requests || requests.data || [];
    success(`Found ${Array.isArray(list) ? list.length : '?'} request(s)`);
  } else {
    info(`Requests endpoint: ${JSON.stringify(requests.data)}`);
  }

  // ============ Summary ============
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${c.bold}🐝 Test Complete!${c.reset}\n`);
  
  console.log(`${c.yellow}What happened:${c.reset}`);
  console.log(`1. Both sites contributed link slots to the pool`);
  console.log(`2. Both sites requested links from the pool`);
  console.log(`3. The system should match compatible requests\n`);
  
  console.log(`${c.cyan}Next steps:${c.reset}`);
  console.log(`• Check /v1/pool/status for credit balances`);
  console.log(`• Check /v1/exchanges for completed matches`);
  console.log(`• Implement actual link placement on pages\n`);
}

runTest().catch(e => {
  error(`Test failed: ${e.message}`);
  console.error(e);
});
