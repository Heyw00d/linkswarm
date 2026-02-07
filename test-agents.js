#!/usr/bin/env node
/**
 * LinkSwarm Test Agents
 * Simulates 3 agents testing the network pool model
 */

const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:3848';

// Test agent configurations
const TEST_AGENTS = [
  {
    name: 'CryptoCards Agent',
    email: 'agent-cryptocards@linkswarm.ai',
    site: {
      domain: 'cryptocards.io',
      name: 'CryptoCards - Best Crypto Debit Cards',
      description: 'Compare the best cryptocurrency debit cards. Spend your Bitcoin, ETH, and stablecoins anywhere.',
      categories: ['crypto', 'debit-cards', 'fintech', 'payments']
    },
    contributions: [
      { page: '/blog/best-crypto-cards-2026', max_links: 2, context: 'Resource section at end' },
      { page: '/compare', max_links: 1, context: 'Partner links sidebar' }
    ],
    requests: [
      { target_page: '/cards/coinbase-card', preferred_anchor: 'Coinbase Card review' },
      { target_page: '/', preferred_anchor: 'crypto debit cards' }
    ]
  },
  {
    name: 'DeFi Wallet Agent',
    email: 'agent-defiwallet@linkswarm.ai',
    site: {
      domain: 'defi-wallets.com',
      name: 'DeFi Wallets - Self-Custody Crypto Wallets',
      description: 'Reviews and guides for the best DeFi and self-custody wallets. Secure your crypto assets.',
      categories: ['crypto', 'defi', 'wallets', 'security']
    },
    contributions: [
      { page: '/guides/hardware-wallets', max_links: 2, context: 'Related resources section' },
      { page: '/reviews', max_links: 1, context: 'Partner ecosystem links' }
    ],
    requests: [
      { target_page: '/wallets/ledger', preferred_anchor: 'Ledger wallet' },
      { target_page: '/defi-guide', preferred_anchor: 'DeFi wallet guide' }
    ]
  },
  {
    name: 'Stablecoin News Agent',
    email: 'agent-stablecoins@linkswarm.ai',
    site: {
      domain: 'stablecoin-news.com',
      name: 'Stablecoin News - USDC, USDT & More',
      description: 'Latest news and analysis on stablecoins. USDC, USDT, DAI and emerging stablecoins coverage.',
      categories: ['crypto', 'stablecoins', 'news', 'usdc', 'fintech']
    },
    contributions: [
      { page: '/analysis/usdc-vs-usdt', max_links: 2, context: 'Further reading section' },
      { page: '/resources', max_links: 3, context: 'Partner directory' }
    ],
    requests: [
      { target_page: '/news/usdc', preferred_anchor: 'USDC news' },
      { target_page: '/', preferred_anchor: 'stablecoin news' }
    ]
  }
];

// HTTP request helper
function request(method, path, body = null, apiKey = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (apiKey) {
      options.headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Create test API key (bypass email verification for testing)
async function createTestKey(email) {
  const { Client } = require('pg');
  const client = new Client({
    host: 'ep-fancy-fire-ai61mvmi-pooler.c-4.us-east-1.aws.neon.tech',
    database: 'neondb',
    user: 'neondb_owner',
    password: 'npg_2pDTrUXmSy8t',
    port: 5432,
    ssl: true
  });
  
  await client.connect();
  
  const apiKey = 'sk_linkswarm_test_' + require('crypto').randomBytes(16).toString('hex');
  
  await client.query(`
    INSERT INTO api_keys (email, api_key, plan, email_verified)
    VALUES ($1, $2, 'pro', true)
    ON CONFLICT (email) DO UPDATE SET api_key = $2, plan = 'pro', email_verified = true
    RETURNING api_key
  `, [email, apiKey]);
  
  await client.end();
  return apiKey;
}

// Main test flow
async function runTests() {
  console.log('🐝 LinkSwarm Test Agents\n');
  console.log('=' .repeat(50));
  
  const agents = [];
  
  // Phase 1: Setup agents with API keys
  console.log('\n📋 PHASE 1: Setting up test agents...\n');
  
  for (const config of TEST_AGENTS) {
    console.log(`  Creating: ${config.name}`);
    const apiKey = await createTestKey(config.email);
    agents.push({ ...config, apiKey });
    console.log(`    ✓ API Key: ${apiKey.slice(0, 30)}...`);
  }
  
  // Phase 2: Register sites
  console.log('\n📋 PHASE 2: Registering sites...\n');
  
  for (const agent of agents) {
    console.log(`  ${agent.name}: Registering ${agent.site.domain}`);
    const res = await request('POST', '/v1/sites', agent.site, agent.apiKey);
    if (res.status === 201 || res.status === 409) {
      console.log(`    ✓ Site registered (or exists)`);
    } else {
      console.log(`    ✗ Error: ${JSON.stringify(res.data)}`);
    }
  }
  
  // Phase 3: Verify sites (auto-verify for testing)
  console.log('\n📋 PHASE 3: Verifying sites...\n');
  
  for (const agent of agents) {
    console.log(`  ${agent.name}: Verifying ${agent.site.domain}`);
    const res = await request('POST', '/v1/sites/verify', { domain: agent.site.domain }, agent.apiKey);
    console.log(`    ${res.status === 200 ? '✓' : '✗'} ${res.data.message || res.data.error || 'Done'}`);
  }
  
  // Phase 4: Analyze sites (create embeddings)
  console.log('\n📋 PHASE 4: Analyzing sites for semantic matching...\n');
  console.log('  (Note: These are test domains - analysis may fail, but embeddings will be mocked)\n');
  
  for (const agent of agents) {
    console.log(`  ${agent.name}: Analyzing ${agent.site.domain}`);
    const res = await request('POST', '/v1/sites/analyze', { domain: agent.site.domain }, agent.apiKey);
    if (res.data.has_embedding) {
      console.log(`    ✓ Embedding created`);
    } else if (res.data.error) {
      console.log(`    ⚠ ${res.data.error} (will use category matching)`);
    } else {
      console.log(`    ⚠ No embedding (will use category matching)`);
    }
  }
  
  // Phase 5: Contribute to pool
  console.log('\n📋 PHASE 5: Contributing link slots to pool...\n');
  
  for (const agent of agents) {
    for (const contrib of agent.contributions) {
      console.log(`  ${agent.name}: Contributing ${agent.site.domain}${contrib.page}`);
      const res = await request('POST', '/v1/pool/contribute', {
        domain: agent.site.domain,
        page: contrib.page,
        max_links: contrib.max_links,
        categories: agent.site.categories,
        context: contrib.context
      }, agent.apiKey);
      console.log(`    ${res.status === 201 ? '✓' : '✗'} ${res.data.message || res.data.error}`);
    }
  }
  
  // Phase 6: Request links
  console.log('\n📋 PHASE 6: Requesting links from pool...\n');
  
  const matches = [];
  for (const agent of agents) {
    for (const req of agent.requests) {
      console.log(`  ${agent.name}: Requesting link to ${agent.site.domain}${req.target_page}`);
      const res = await request('POST', '/v1/pool/request', {
        domain: agent.site.domain,
        target_page: req.target_page,
        preferred_anchor: req.preferred_anchor,
        categories: agent.site.categories
      }, agent.apiKey);
      
      if (res.data.match) {
        console.log(`    ✓ MATCHED! ${res.data.match.from_domain} → ${agent.site.domain} (score: ${res.data.match.relevance_score})`);
        matches.push(res.data.match);
      } else {
        console.log(`    ⏳ Queued (pending match)`);
      }
    }
  }
  
  // Phase 7: Check pool status
  console.log('\n📋 PHASE 7: Pool status for each agent...\n');
  
  for (const agent of agents) {
    const res = await request('GET', '/v1/pool/status', null, agent.apiKey);
    if (res.status === 200) {
      console.log(`  ${agent.name}:`);
      console.log(`    Credits: ${res.data.credits || 0}`);
      console.log(`    Contributions: ${res.data.contributions?.length || 0}`);
      console.log(`    Requests: ${res.data.requests?.length || 0}`);
      console.log(`    Links given: ${res.data.placements_given?.length || 0}`);
      console.log(`    Links received: ${res.data.placements_received?.length || 0}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY\n');
  console.log(`  Agents created: ${agents.length}`);
  console.log(`  Sites registered: ${agents.length}`);
  console.log(`  Contributions: ${agents.reduce((n, a) => n + a.contributions.length, 0)}`);
  console.log(`  Requests: ${agents.reduce((n, a) => n + a.requests.length, 0)}`);
  console.log(`  Matches: ${matches.length}`);
  
  if (matches.length > 0) {
    console.log('\n  🔗 Matches made:');
    for (const m of matches) {
      console.log(`    ${m.from_domain} → target (score: ${m.relevance_score})`);
    }
  }
  
  console.log('\n✅ Test complete!\n');
}

runTests().catch(console.error);
