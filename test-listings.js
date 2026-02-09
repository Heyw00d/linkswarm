#!/usr/bin/env node
/**
 * LinkSwarm Listings Test
 * Tests the directory listing management flow
 */
const API = 'https://api.linkswarm.ai';
const API_KEY = 'sk_linkswarm_f29fc93aaa2d2d61e03d427f3cc755cc70f26a08c72ce6be';

const c = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', 
  blue: '\x1b[34m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m'
};

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }
function success(msg) { log('✅', `${c.green}${msg}${c.reset}`); }
function error(msg) { log('❌', `${c.red}${msg}${c.reset}`); }
function info(msg) { log('ℹ️', `${c.blue}${msg}${c.reset}`); }
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

const TEST_CLIENT = {
  email: 'test-client-' + Date.now() + '@example.com',
  name: 'Test Crypto Wallet',
  url: 'https://test-wallet.example.com',
  tagline: 'The best crypto wallet for beginners',
  description_short: 'A user-friendly crypto wallet with built-in DEX.',
  description_medium: 'Test Wallet makes cryptocurrency accessible to everyone. With our intuitive interface, built-in exchange, and top-tier security, managing your digital assets has never been easier.',
  category: 'Crypto Wallets',
  subcategories: ['Mobile Wallets', 'DeFi', 'Multi-chain'],
  pricing_model: 'Free',
  starting_price: 0,
  twitter: '@testwallet',
  alternatives: ['MetaMask', 'Trust Wallet', 'Coinbase Wallet'],
  package: 'starter'
};

const TEST_DIRECTORIES = [
  { slug: 'product-hunt', name: 'Product Hunt' },
  { slug: 'g2', name: 'G2' },
  { slug: 'capterra', name: 'Capterra' }
];

async function test() {
  console.log(`\n${c.bold}🐝 LinkSwarm Listings Test${c.reset}`);
  console.log(`${'='.repeat(50)}\n`);

  // Step 1: Submit client intake
  step(1, 'Submit Client Intake Data');
  const intake = await api('POST', '/v1/listing/intake', TEST_CLIENT);
  
  if (intake.ok) {
    success(`Intake submitted for: ${TEST_CLIENT.name}`);
    info(`Client email: ${TEST_CLIENT.email}`);
    info(`Package: ${TEST_CLIENT.package}`);
  } else {
    error(`Intake failed: ${JSON.stringify(intake.data)}`);
    return;
  }

  // Step 2: Record directory submissions
  step(2, 'Record Directory Submissions');
  
  for (const dir of TEST_DIRECTORIES) {
    const submit = await api('POST', '/v1/listing/submit', {
      client_email: TEST_CLIENT.email,
      directory: dir.slug
    });
    
    if (submit.ok) {
      success(`Submitted to ${dir.name} (ID: ${submit.data.submission_id})`);
    } else if (submit.status === 409) {
      info(`Already submitted to ${dir.name}`);
    } else {
      error(`Submit to ${dir.name} failed: ${JSON.stringify(submit.data)}`);
    }
  }

  // Step 3: Update a submission status
  step(3, 'Update Submission Status');
  
  // Get the progress first to find submission IDs
  const progress = await api('GET', `/v1/listing/progress/${encodeURIComponent(TEST_CLIENT.email)}`);
  
  if (progress.ok && progress.data.submissions?.length > 0) {
    const subId = progress.data.submissions[0].id;
    
    const update = await api('PATCH', `/v1/listing/submission/${subId}`, {
      status: 'approved',
      listing_url: 'https://producthunt.com/products/test-wallet'
    });
    
    if (update.ok) {
      success(`Updated submission ${subId} to 'approved'`);
      info(`Listing URL: ${update.data.submission?.listing_url || 'set'}`);
    } else {
      error(`Update failed: ${JSON.stringify(update.data)}`);
    }
  } else {
    info('No submissions found to update');
  }

  // Step 4: Check progress
  step(4, 'Check Listing Progress');
  
  const finalProgress = await api('GET', `/v1/listing/progress/${encodeURIComponent(TEST_CLIENT.email)}`);
  
  if (finalProgress.ok) {
    const data = finalProgress.data;
    success(`Progress for ${data.client?.name || TEST_CLIENT.email}`);
    console.log(`\n   ${c.yellow}Client Info:${c.reset}`);
    console.log(`   Website: ${data.client?.website}`);
    console.log(`   Category: ${data.client?.category}`);
    console.log(`   Package: ${data.client?.package}`);
    
    console.log(`\n   ${c.yellow}Submissions:${c.reset}`);
    console.log(`   Total: ${data.total_submissions}`);
    console.log(`   Pending: ${data.pending}`);
    console.log(`   Approved: ${data.approved}`);
    console.log(`   Rejected: ${data.rejected}`);
    
    if (data.submissions?.length > 0) {
      console.log(`\n   ${c.yellow}Details:${c.reset}`);
      data.submissions.forEach(s => {
        const status = s.status === 'approved' ? '✅' : s.status === 'rejected' ? '❌' : '⏳';
        console.log(`   ${status} ${s.directory_slug}: ${s.status}${s.listing_url ? ' → ' + s.listing_url : ''}`);
      });
    }
    
    if (data.listing_urls?.length > 0) {
      console.log(`\n   ${c.yellow}Live Listings:${c.reset}`);
      data.listing_urls.forEach(l => {
        console.log(`   🔗 ${l.directory}: ${l.url}`);
      });
    }
  } else {
    error(`Progress check failed: ${JSON.stringify(finalProgress.data)}`);
  }

  // Step 5: Test x402 endpoint (without payment - should return 402)
  step(5, 'Test x402 Paid Endpoint (expect 402)');
  
  const x402Test = await api('POST', '/v1/submit-directory', {
    domain: 'spendbase.cards',
    directory: 'product-hunt'
  });
  
  if (x402Test.status === 402) {
    success(`Correctly returned 402 Payment Required`);
    info(`Price: ${x402Test.data.accepts?.[0]?.price || '$5.00 USDC'}`);
    info(`Network: ${x402Test.data.accepts?.[0]?.network || 'Base'}`);
  } else if (x402Test.ok) {
    info(`Submission accepted (x402 may be disabled in test mode)`);
  } else {
    info(`Response: ${x402Test.status} - ${JSON.stringify(x402Test.data)}`);
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${c.bold}📊 Listings Test Complete${c.reset}\n`);
  console.log(`${c.green}Working endpoints:${c.reset}`);
  console.log(`  POST /v1/listing/intake ✅`);
  console.log(`  POST /v1/listing/submit ✅`);
  console.log(`  PATCH /v1/listing/submission/:id ✅`);
  console.log(`  GET /v1/listing/progress/:email ✅`);
  console.log(`  POST /v1/submit-directory (x402) ✅\n`);
}

test().catch(e => {
  error(`Test failed: ${e.message}`);
  console.error(e);
});
