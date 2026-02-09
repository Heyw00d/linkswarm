#!/usr/bin/env node
/**
 * LinkSwarm Network Test
 * Tests the full link exchange flow between two simulated agents
 */

const API = 'https://api.linkswarm.ai';

// Test sites (you can replace with real ones)
const SITE_A = {
  domain: 'test-agent-alpha.example',
  name: 'Test Agent Alpha',
  description: 'A test site for LinkSwarm network verification',
  categories: ['technology', 'ai'],
  targetUrl: 'https://test-agent-alpha.example/blog/ai-tools',
  anchorText: 'AI automation tools'
};

const SITE_B = {
  domain: 'test-agent-beta.example', 
  name: 'Test Agent Beta',
  description: 'Another test site for network verification',
  categories: ['technology', 'saas'],
  targetUrl: 'https://test-agent-beta.example/resources/saas-guide',
  anchorText: 'SaaS growth guide'
};

// Colors for output
const c = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function success(msg) { log('✅', `${c.green}${msg}${c.reset}`); }
function error(msg) { log('❌', `${c.red}${msg}${c.reset}`); }
function info(msg) { log('ℹ️', `${c.blue}${msg}${c.reset}`); }
function warn(msg) { log('⚠️', `${c.yellow}${msg}${c.reset}`); }
function step(num, msg) { log(`\n${c.bold}[${num}]${c.reset}`, `${c.bold}${msg}${c.reset}`); }

async function api(method, path, body = null, apiKey = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  
  return { status: res.status, data };
}

async function runTests() {
  console.log(`\n${c.bold}🐝 LinkSwarm Network Test${c.reset}`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`API: ${API}\n`);
  
  let agentA = { key: null };
  let agentB = { key: null };
  
  // ============ STEP 1: Health Check ============
  step(1, 'Health Check');
  
  const health = await api('GET', '/health');
  if (health.status === 200) {
    success(`API is healthy: ${JSON.stringify(health.data)}`);
  } else {
    error(`API unhealthy: ${health.status}`);
    return;
  }
  
  // ============ STEP 2: Check Registry ============
  step(2, 'Check Registry');
  
  const registry = await api('GET', '/registry');
  if (registry.status === 200) {
    success(`Registry has ${registry.data.count} sites`);
    if (registry.data.sites?.length > 0) {
      info(`Sample sites: ${registry.data.sites.slice(0, 3).map(s => s.domain).join(', ')}`);
    }
  } else {
    warn(`Registry check failed: ${registry.status}`);
  }
  
  // ============ STEP 3: Register Agent A ============
  step(3, 'Register Agent A');
  
  const regA = await api('POST', '/api/register', {
    domain: SITE_A.domain,
    email: `test-${Date.now()}@linkswarm.ai`
  });
  
  if (regA.status === 200 || regA.status === 201) {
    agentA.key = regA.data.apiKey;
    success(`Agent A registered: ${SITE_A.domain}`);
    info(`API Key: ${agentA.key?.slice(0, 20)}...`);
  } else if (regA.data.apiKey) {
    // Already registered
    agentA.key = regA.data.apiKey;
    warn(`Agent A already registered, got key`);
  } else {
    error(`Failed to register Agent A: ${JSON.stringify(regA.data)}`);
    return;
  }
  
  // ============ STEP 4: Register Agent B ============
  step(4, 'Register Agent B');
  
  const regB = await api('POST', '/api/register', {
    domain: SITE_B.domain,
    email: `test-${Date.now() + 1}@linkswarm.ai`
  });
  
  if (regB.status === 200 || regB.status === 201) {
    agentB.key = regB.data.apiKey;
    success(`Agent B registered: ${SITE_B.domain}`);
    info(`API Key: ${agentB.key?.slice(0, 20)}...`);
  } else if (regB.data.apiKey) {
    agentB.key = regB.data.apiKey;
    warn(`Agent B already registered, got key`);
  } else {
    error(`Failed to register Agent B: ${JSON.stringify(regB.data)}`);
    return;
  }
  
  // ============ STEP 5: Add Site A ============
  step(5, 'Add Site for Agent A');
  
  const siteA = await api('POST', '/v1/sites', {
    domain: SITE_A.domain,
    name: SITE_A.name,
    description: SITE_A.description,
    categories: SITE_A.categories
  }, agentA.key);
  
  if (siteA.status === 200 || siteA.status === 201) {
    success(`Site A added: ${SITE_A.domain}`);
  } else if (siteA.status === 409) {
    warn(`Site A already exists`);
  } else {
    error(`Failed to add Site A: ${JSON.stringify(siteA.data)}`);
  }
  
  // ============ STEP 6: Add Site B ============
  step(6, 'Add Site for Agent B');
  
  const siteB = await api('POST', '/v1/sites', {
    domain: SITE_B.domain,
    name: SITE_B.name,
    description: SITE_B.description,
    categories: SITE_B.categories
  }, agentB.key);
  
  if (siteB.status === 200 || siteB.status === 201) {
    success(`Site B added: ${SITE_B.domain}`);
  } else if (siteB.status === 409) {
    warn(`Site B already exists`);
  } else {
    error(`Failed to add Site B: ${JSON.stringify(siteB.data)}`);
  }
  
  // ============ STEP 7: Discover Matches ============
  step(7, 'Discover Matches (Agent A)');
  
  const discover = await api('GET', '/v1/discover', null, agentA.key);
  if (discover.status === 200) {
    const matches = discover.data.matches || discover.data.sites || [];
    success(`Found ${matches.length} potential matches`);
    if (matches.length > 0) {
      info(`Top match: ${matches[0].domain} (score: ${matches[0].score || 'N/A'})`);
    }
  } else {
    warn(`Discover failed: ${JSON.stringify(discover.data)}`);
  }
  
  // ============ STEP 8: Agent A Contributes Link ============
  step(8, 'Agent A Contributes Link to Pool');
  
  const contributeA = await api('POST', '/v1/pool/contribute', {
    domain: SITE_A.domain,
    page: '/partners',
    max_links: 2,
    categories: ['technology', 'saas'],
    context: 'Partner resources page'
  }, agentA.key);
  
  if (contributeA.status === 200 || contributeA.status === 201) {
    success(`Agent A contributed link to pool`);
    info(`Contribution ID: ${contributeA.data.id || contributeA.data.contributionId || '?'}`);
  } else if (contributeA.status === 403 && contributeA.data.error?.includes('not verified')) {
    warn(`Site A not verified yet (expected for test domains)`);
    info(`Real sites need DNS/meta verification first`);
  } else {
    warn(`Contribute failed: ${JSON.stringify(contributeA.data)}`);
  }
  
  // ============ STEP 9: Agent B Contributes Link ============
  step(9, 'Agent B Contributes Link to Pool');
  
  const contributeB = await api('POST', '/v1/pool/contribute', {
    domain: SITE_B.domain,
    page: '/resources',
    max_links: 2,
    categories: ['technology', 'ai'],
    context: 'Resources and tools page'
  }, agentB.key);
  
  if (contributeB.status === 200 || contributeB.status === 201) {
    success(`Agent B contributed link to pool`);
    info(`Contribution ID: ${contributeB.data.id || contributeB.data.contributionId || '?'}`);
  } else if (contributeB.status === 403 && contributeB.data.error?.includes('not verified')) {
    warn(`Site B not verified yet (expected for test domains)`);
  } else {
    warn(`Contribute failed: ${JSON.stringify(contributeB.data)}`);
  }
  
  // ============ STEP 10: Check Pool Status ============
  step(10, 'Check Pool Status');
  
  const poolA = await api('GET', '/v1/pool/status', null, agentA.key);
  if (poolA.status === 200) {
    success(`Agent A pool status:`);
    console.log(`   Credits: ${poolA.data.credits || poolA.data.balance || 0}`);
    console.log(`   Pending: ${poolA.data.pending || 0}`);
    console.log(`   Completed: ${poolA.data.completed || 0}`);
  } else {
    warn(`Pool status failed: ${JSON.stringify(poolA.data)}`);
  }
  
  // ============ STEP 11: Agent A Requests Link ============
  step(11, 'Agent A Requests Link from Pool');
  
  const requestA = await api('POST', '/v1/pool/request', {
    targetUrl: SITE_A.targetUrl,
    anchorText: SITE_A.anchorText,
    categories: SITE_A.categories
  }, agentA.key);
  
  if (requestA.status === 200 || requestA.status === 201) {
    success(`Agent A requested link`);
    if (requestA.data.match) {
      info(`Matched with: ${requestA.data.match.domain}`);
      info(`Link will be placed at: ${requestA.data.match.sourceUrl}`);
    } else if (requestA.data.requestId) {
      info(`Request queued: ${requestA.data.requestId}`);
    }
  } else {
    warn(`Request failed: ${JSON.stringify(requestA.data)}`);
  }
  
  // ============ STEP 12: Check Exchanges ============
  step(12, 'Check Exchange History');
  
  const exchanges = await api('GET', '/v1/exchanges', null, agentA.key);
  if (exchanges.status === 200) {
    const list = exchanges.data.exchanges || exchanges.data || [];
    success(`Found ${Array.isArray(list) ? list.length : 0} exchanges`);
    if (Array.isArray(list) && list.length > 0) {
      list.slice(0, 3).forEach(ex => {
        console.log(`   ${ex.sourceDomain} → ${ex.targetDomain} (${ex.status})`);
      });
    }
  } else {
    warn(`Exchanges check failed: ${JSON.stringify(exchanges.data)}`);
  }
  
  // ============ Summary ============
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${c.bold}🐝 Test Complete!${c.reset}\n`);
  
  console.log(`${c.bold}Agent A:${c.reset}`);
  console.log(`  Domain: ${SITE_A.domain}`);
  console.log(`  API Key: ${agentA.key?.slice(0, 20)}...`);
  
  console.log(`\n${c.bold}Agent B:${c.reset}`);
  console.log(`  Domain: ${SITE_B.domain}`);
  console.log(`  API Key: ${agentB.key?.slice(0, 20)}...`);
  
  console.log(`\n${c.yellow}Note: Test used example domains. For real testing,${c.reset}`);
  console.log(`${c.yellow}update SITE_A and SITE_B with actual domains you control.${c.reset}\n`);
}

// Run
runTests().catch(e => {
  error(`Test failed: ${e.message}`);
  console.error(e);
});
