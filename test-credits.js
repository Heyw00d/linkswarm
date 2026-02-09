#!/usr/bin/env node
/**
 * Quick credit test
 */
const API = 'https://api.linkswarm.ai';
const API_KEY = 'sk_linkswarm_f29fc93aaa2d2d61e03d427f3cc755cc70f26a08c72ce6be';

async function api(method, path, body = null) {
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

async function test() {
  console.log('🐝 Credit System Test\n');
  
  // Check balance before
  console.log('1. Balance BEFORE:');
  const before = await api('GET', '/v1/pool/status');
  console.log(`   Credits: ${JSON.stringify(before.credits)}\n`);
  
  // Contribute a link
  console.log('2. Contributing link slot...');
  const contrib = await api('POST', '/v1/pool/contribute', {
    domain: 'spendbase.cards',
    page: '/test-credits-' + Date.now(),
    max_links: 1,
    categories: ['crypto']
  });
  console.log(`   Result: ${JSON.stringify(contrib)}\n`);
  
  // Check balance after
  console.log('3. Balance AFTER:');
  const after = await api('GET', '/v1/pool/status');
  console.log(`   Credits: ${JSON.stringify(after.credits)}\n`);
  
  // Summary
  const beforeBal = before.credits?.balance || 0;
  const afterBal = after.credits?.balance || 0;
  console.log(`📊 Balance change: ${beforeBal} → ${afterBal} (${afterBal > beforeBal ? '+' : ''}${afterBal - beforeBal})`);
}

test().catch(console.error);
