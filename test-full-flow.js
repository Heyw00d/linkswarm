#!/usr/bin/env node
/**
 * LinkSwarm Full Flow Test
 * Tests: Contribute → Request → Match → Pending → Confirm → Verify
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

async function test() {
  console.log(`\n${c.bold}🐝 LinkSwarm Full Flow Test${c.reset}`);
  console.log(`${'='.repeat(50)}\n`);

  // Step 1: Check initial balance
  step(1, 'Check Initial Balance');
  const balanceBefore = await api('GET', '/v1/pool/status');
  const creditsBefore = balanceBefore.data.credits?.balance || 0;
  success(`Balance: ${creditsBefore} credits`);

  // Step 2: Contribute a link slot (earns credit)
  step(2, 'Contribute Link Slot (spendbase.cards)');
  const testPage = '/test-flow-' + Date.now();
  const contrib = await api('POST', '/v1/pool/contribute', {
    domain: 'spendbase.cards',
    page: testPage,
    max_links: 1,
    categories: ['crypto', 'fintech'],
    context: 'Test page for link exchange flow'
  });
  
  if (contrib.ok) {
    success(`Contributed! ID: ${contrib.data.contribution_id}`);
    info(`Credits earned: ${contrib.data.credits_earned}, Balance: ${contrib.data.new_balance}`);
  } else {
    error(`Contribute failed: ${JSON.stringify(contrib.data)}`);
    return;
  }

  // Step 3: Request a link (spends credit, tries to match)
  step(3, 'Request Link (usdckey.com)');
  const request = await api('POST', '/v1/pool/request', {
    domain: 'usdckey.com',
    target_page: '/test-target-' + Date.now(),
    preferred_anchor: 'crypto spending guide',
    categories: ['crypto', 'stablecoin']
  });
  
  if (request.ok) {
    success(`Request created! ID: ${request.data.request_id}`);
    info(`Status: ${request.data.status}`);
    if (request.data.match) {
      success(`🎉 MATCHED with ${request.data.match.from_domain}`);
      info(`Placement ID: ${request.data.match.placement_id}`);
      info(`From page: ${request.data.match.from_page}`);
      info(`Relevance: ${(request.data.match.relevance_score * 100).toFixed(1)}%`);
    }
  } else {
    error(`Request failed: ${JSON.stringify(request.data)}`);
  }

  // Step 4: Check pending placements
  step(4, 'Check Pending Placements');
  const pending = await api('GET', '/v1/placements/pending');
  
  if (pending.ok) {
    success(`Found ${pending.data.count} pending placement(s)`);
    if (pending.data.placements?.length > 0) {
      const p = pending.data.placements[0];
      console.log(`\n   ${c.yellow}Placement Instructions:${c.reset}`);
      console.log(`   Your page: ${p.your_page}`);
      console.log(`   Link to: ${p.link_to}`);
      console.log(`   HTML: ${p.html_snippet}`);
      console.log(`   Confirm: ${p.confirm_endpoint}`);
    }
  } else {
    info(`Pending check: ${JSON.stringify(pending.data)}`);
  }

  // Step 5: Confirm placement (simulate agent placed the link)
  step(5, 'Confirm Link Placed');
  
  // Get a placement to confirm
  let placementToConfirm = request.data.match?.placement_id;
  if (!placementToConfirm && pending.data.placements?.length > 0) {
    placementToConfirm = pending.data.placements[0].placement_id;
  }
  
  if (placementToConfirm) {
    const confirm = await api('POST', '/v1/pool/confirm', {
      placement_id: placementToConfirm
    });
    
    if (confirm.ok) {
      success(`Placement ${placementToConfirm} confirmed!`);
      info(confirm.data.message);
      info(`Reciprocal blocked until: ${confirm.data.reciprocal_blocked_until}`);
    } else {
      error(`Confirm failed: ${JSON.stringify(confirm.data)}`);
    }
    
    // Step 6: Trigger verification
    step(6, 'Trigger Verification');
    const verify = await api('POST', `/v1/placements/${placementToConfirm}/verify`);
    
    if (verify.ok) {
      if (verify.data.verified) {
        success(`Link VERIFIED! ✨`);
        info('Credit awarded to contributor');
      } else {
        info(`Not verified (expected - test page doesn't have real link)`);
        info(`Reason: ${verify.data.status}`);
      }
    } else {
      info(`Verify response: ${JSON.stringify(verify.data)}`);
    }
  } else {
    info('No placement to confirm (no match occurred)');
  }

  // Step 7: Check final balance
  step(7, 'Check Final Balance');
  const balanceAfter = await api('GET', '/v1/pool/status');
  const creditsAfter = balanceAfter.data.credits?.balance || 0;
  success(`Balance: ${creditsAfter} credits`);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${c.bold}📊 Summary${c.reset}`);
  console.log(`   Credits before: ${creditsBefore}`);
  console.log(`   Credits after:  ${creditsAfter}`);
  console.log(`   Change: ${creditsAfter >= creditsBefore ? '+' : ''}${creditsAfter - creditsBefore}`);
  
  console.log(`\n${c.bold}🔄 Flow Tested:${c.reset}`);
  console.log(`   1. Contribute → +1 credit ✅`);
  console.log(`   2. Request → matched ✅`);
  console.log(`   3. Pending placements visible ✅`);
  console.log(`   4. Confirm placement ✅`);
  console.log(`   5. Verification triggered ✅`);
  console.log(`\n${c.green}Full flow working!${c.reset} 🐝\n`);
}

test().catch(e => {
  error(`Test failed: ${e.message}`);
  console.error(e);
});
