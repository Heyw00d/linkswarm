#!/usr/bin/env node
/**
 * 2Captcha Integration for LinkSwarm
 * 
 * Supports: reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, normal image captchas
 * 
 * Usage:
 *   const solver = require('./captcha-solver');
 *   const token = await solver.solveRecaptchaV2(siteKey, pageUrl);
 */

const https = require('https');
const fs = require('fs');

// Load API key from env
let API_KEY;
try {
  const envFile = fs.readFileSync(process.env.HOME + '/clawd/.env.linkswarm', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key?.trim() === 'TWOCAPTCHA_API_KEY') {
      API_KEY = val.join('=').trim();
    }
  });
} catch (e) {
  console.warn('Warning: Could not load .env.linkswarm');
}

const API_BASE = '2captcha.com';
const POLL_INTERVAL = 5000; // 5 seconds
const RECAPTCHA_INITIAL_WAIT = 20000; // 20 seconds for reCAPTCHA

/**
 * Make HTTP request
 */
function request(method, path, params = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${API_BASE}${path}`);
    
    if (method === 'GET') {
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    }
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}
    };
    
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    
    if (method === 'POST') {
      req.write(new URLSearchParams(params).toString());
    }
    req.end();
  });
}

/**
 * Submit captcha and get task ID
 */
async function submitTask(params) {
  params.key = API_KEY;
  params.json = 1;
  
  const response = await request('POST', '/in.php', params);
  const result = JSON.parse(response);
  
  if (result.status !== 1) {
    throw new Error(`2Captcha submit error: ${result.request}`);
  }
  
  return result.request; // Task ID
}

/**
 * Poll for result
 */
async function getResult(taskId, initialWait = 5000) {
  await sleep(initialWait);
  
  const maxAttempts = 60; // 5 minutes max
  for (let i = 0; i < maxAttempts; i++) {
    const response = await request('GET', '/res.php', {
      key: API_KEY,
      action: 'get',
      id: taskId,
      json: 1
    });
    
    const result = JSON.parse(response);
    
    if (result.status === 1) {
      return result.request;
    }
    
    if (result.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2Captcha result error: ${result.request}`);
    }
    
    await sleep(POLL_INTERVAL);
  }
  
  throw new Error('2Captcha timeout: captcha not solved in time');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get account balance
 */
async function getBalance() {
  const response = await request('GET', '/res.php', {
    key: API_KEY,
    action: 'getbalance',
    json: 1
  });
  const result = JSON.parse(response);
  if (result.status !== 1) {
    throw new Error(`2Captcha balance error: ${result.request}`);
  }
  return parseFloat(result.request);
}

/**
 * Solve reCAPTCHA v2
 * @param {string} siteKey - The site key (data-sitekey attribute)
 * @param {string} pageUrl - Full URL of the page with captcha
 * @param {object} options - Additional options (invisible, enterprise, proxy)
 * @returns {string} - g-recaptcha-response token
 */
async function solveRecaptchaV2(siteKey, pageUrl, options = {}) {
  const params = {
    method: 'userrecaptcha',
    googlekey: siteKey,
    pageurl: pageUrl
  };
  
  if (options.invisible) params.invisible = 1;
  if (options.enterprise) params.enterprise = 1;
  if (options.dataS) params['data-s'] = options.dataS;
  if (options.proxy) {
    params.proxy = options.proxy;
    params.proxytype = options.proxyType || 'HTTP';
  }
  if (options.userAgent) params.userAgent = options.userAgent;
  if (options.cookies) params.cookies = options.cookies;
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] reCAPTCHA v2 task submitted: ${taskId}`);
  
  return await getResult(taskId, RECAPTCHA_INITIAL_WAIT);
}

/**
 * Solve reCAPTCHA v3
 * @param {string} siteKey - The site key
 * @param {string} pageUrl - Full URL of the page
 * @param {string} action - Action parameter (optional)
 * @param {number} minScore - Minimum score required (0.1-0.9)
 * @returns {string} - g-recaptcha-response token
 */
async function solveRecaptchaV3(siteKey, pageUrl, action = 'verify', minScore = 0.3) {
  const params = {
    method: 'userrecaptcha',
    googlekey: siteKey,
    pageurl: pageUrl,
    version: 'v3',
    action: action,
    min_score: minScore
  };
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] reCAPTCHA v3 task submitted: ${taskId}`);
  
  return await getResult(taskId, RECAPTCHA_INITIAL_WAIT);
}

/**
 * Solve hCaptcha
 * @param {string} siteKey - The site key (data-sitekey attribute)
 * @param {string} pageUrl - Full URL of the page
 * @param {object} options - Additional options (invisible, enterprise, proxy)
 * @returns {string} - h-captcha-response token
 */
async function solveHCaptcha(siteKey, pageUrl, options = {}) {
  const params = {
    method: 'hcaptcha',
    sitekey: siteKey,
    pageurl: pageUrl
  };
  
  if (options.invisible) params.invisible = 1;
  if (options.enterprise) {
    params.enterprise = 1;
    if (options.rqdata) params.data = options.rqdata;
  }
  if (options.proxy) {
    params.proxy = options.proxy;
    params.proxytype = options.proxyType || 'HTTP';
  }
  if (options.userAgent) params.userAgent = options.userAgent;
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] hCaptcha task submitted: ${taskId}`);
  
  return await getResult(taskId, RECAPTCHA_INITIAL_WAIT);
}

/**
 * Solve Cloudflare Turnstile
 * @param {string} siteKey - The site key
 * @param {string} pageUrl - Full URL of the page
 * @param {object} options - Additional options (action, cData, proxy)
 * @returns {string} - cf-turnstile-response token
 */
async function solveTurnstile(siteKey, pageUrl, options = {}) {
  const params = {
    method: 'turnstile',
    sitekey: siteKey,
    pageurl: pageUrl
  };
  
  if (options.action) params.action = options.action;
  if (options.cData) params.data = options.cData;
  if (options.proxy) {
    params.proxy = options.proxy;
    params.proxytype = options.proxyType || 'HTTP';
  }
  if (options.userAgent) params.userAgent = options.userAgent;
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] Turnstile task submitted: ${taskId}`);
  
  return await getResult(taskId, 10000); // Turnstile is usually faster
}

/**
 * Solve normal image captcha
 * @param {string|Buffer} image - Base64 string or image buffer
 * @param {object} options - Additional options (numeric, phrase, caseSensitive, math, minLen, maxLen)
 * @returns {string} - Captcha text
 */
async function solveImage(image, options = {}) {
  const params = {
    method: 'base64',
    body: Buffer.isBuffer(image) ? image.toString('base64') : image
  };
  
  if (options.numeric) params.numeric = options.numeric; // 0=any, 1=numbers only, 2=letters only
  if (options.phrase) params.phrase = 1;
  if (options.caseSensitive) params.regsense = 1;
  if (options.math) params.calc = 1;
  if (options.minLen) params.min_len = options.minLen;
  if (options.maxLen) params.max_len = options.maxLen;
  if (options.language) params.language = options.language; // 0=not specified, 1=Cyrillic, 2=Latin
  if (options.hint) params.textinstructions = options.hint;
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] Image captcha task submitted: ${taskId}`);
  
  return await getResult(taskId);
}

/**
 * Solve GeeTest v3
 * @param {string} gt - gt parameter
 * @param {string} challenge - challenge parameter
 * @param {string} pageUrl - Full URL of the page
 * @param {string} apiServer - API server (optional)
 * @returns {object} - {challenge, validate, seccode}
 */
async function solveGeeTest(gt, challenge, pageUrl, apiServer = null) {
  const params = {
    method: 'geetest',
    gt: gt,
    challenge: challenge,
    pageurl: pageUrl
  };
  
  if (apiServer) params.api_server = apiServer;
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] GeeTest task submitted: ${taskId}`);
  
  const result = await getResult(taskId, RECAPTCHA_INITIAL_WAIT);
  return JSON.parse(result);
}

/**
 * Solve FunCaptcha (Arkose Labs)
 * @param {string} publicKey - Public key
 * @param {string} pageUrl - Full URL of the page
 * @param {string} surl - Service URL (optional)
 * @returns {string} - Token
 */
async function solveFunCaptcha(publicKey, pageUrl, surl = null) {
  const params = {
    method: 'funcaptcha',
    publickey: publicKey,
    pageurl: pageUrl
  };
  
  if (surl) params.surl = surl;
  
  const taskId = await submitTask(params);
  console.log(`[2Captcha] FunCaptcha task submitted: ${taskId}`);
  
  return await getResult(taskId, RECAPTCHA_INITIAL_WAIT);
}

/**
 * Report bad captcha (for refund)
 */
async function reportBad(taskId) {
  const response = await request('GET', '/res.php', {
    key: API_KEY,
    action: 'reportbad',
    id: taskId,
    json: 1
  });
  return JSON.parse(response);
}

/**
 * Report good captcha (helps improve accuracy)
 */
async function reportGood(taskId) {
  const response = await request('GET', '/res.php', {
    key: API_KEY,
    action: 'reportgood',
    id: taskId,
    json: 1
  });
  return JSON.parse(response);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  async function main() {
    if (!API_KEY) {
      console.error('Error: TWOCAPTCHA_API_KEY not set in .env.linkswarm');
      process.exit(1);
    }
    
    switch (cmd) {
      case 'balance':
        const balance = await getBalance();
        console.log(`Balance: $${balance.toFixed(2)}`);
        break;
        
      case 'test-recaptcha':
        if (args.length < 3) {
          console.log('Usage: captcha-solver.js test-recaptcha <siteKey> <pageUrl>');
          process.exit(1);
        }
        const token = await solveRecaptchaV2(args[1], args[2]);
        console.log('Token:', token);
        break;
        
      case 'test-image':
        if (args.length < 2) {
          console.log('Usage: captcha-solver.js test-image <imagePath>');
          process.exit(1);
        }
        const imageBuffer = fs.readFileSync(args[1]);
        const text = await solveImage(imageBuffer);
        console.log('Text:', text);
        break;
        
      default:
        console.log(`
2Captcha Integration for LinkSwarm

Usage:
  captcha-solver.js balance              - Check account balance
  captcha-solver.js test-recaptcha <siteKey> <pageUrl>
  captcha-solver.js test-image <imagePath>

Programmatic usage:
  const solver = require('./captcha-solver');
  
  // reCAPTCHA v2
  const token = await solver.solveRecaptchaV2(siteKey, pageUrl);
  
  // reCAPTCHA v3
  const token = await solver.solveRecaptchaV3(siteKey, pageUrl, 'submit', 0.7);
  
  // hCaptcha
  const token = await solver.solveHCaptcha(siteKey, pageUrl);
  
  // Cloudflare Turnstile
  const token = await solver.solveTurnstile(siteKey, pageUrl);
  
  // Image captcha
  const text = await solver.solveImage(imageBuffer);

Supported captcha types:
  - reCAPTCHA v2 (including invisible and enterprise)
  - reCAPTCHA v3
  - hCaptcha (including enterprise)
  - Cloudflare Turnstile
  - Normal image captchas
  - GeeTest v3
  - FunCaptcha (Arkose Labs)
`);
    }
  }
  
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  getBalance,
  solveRecaptchaV2,
  solveRecaptchaV3,
  solveHCaptcha,
  solveTurnstile,
  solveImage,
  solveGeeTest,
  solveFunCaptcha,
  reportBad,
  reportGood,
  setApiKey: (key) => { API_KEY = key; }
};
