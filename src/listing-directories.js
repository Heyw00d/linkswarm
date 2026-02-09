/**
 * LinkSwarm Directory Database (INTERNAL - NOT EXPOSED VIA API)
 * This is proprietary data - never return full list to clients
 */

const directories = [
  // CRYPTO / WEB3
  {
    id: 'microlaunch',
    name: 'MicroLaunch',
    url: 'https://microlaunch.net/',
    submitUrl: 'https://microlaunch.net/',
    dr: 55,
    traffic: '54k',
    categories: ['crypto', 'tech', 'startup'],
    pricing: 'free',
    requiresLogin: true,
    captchaType: null,
    fields: ['name', 'url', 'tagline', 'description', 'logo']
  },
  {
    id: 'openalternative',
    name: 'OpenAlternative',
    url: 'https://openalternative.co/',
    submitUrl: 'https://openalternative.co/submit',
    dr: 50,
    traffic: '275k',
    categories: ['tech', 'opensource', 'startup'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description', 'github']
  },
  {
    id: 'aiagentstore',
    name: 'AI Agent Store',
    url: 'https://aiagentstore.ai/',
    submitUrl: 'https://aiagentstore.ai/new-agent',
    dr: 45,
    traffic: '45k',
    categories: ['ai', 'tech', 'agents'],
    pricing: 'free',
    requiresLogin: true,
    captchaType: null,
    fields: ['name', 'url', 'description', 'logo', 'screenshots']
  },
  {
    id: 'trustmrr',
    name: 'TrustMRR',
    url: 'https://trustmrr.com/',
    submitUrl: 'https://trustmrr.com/',
    dr: 49,
    traffic: '80k',
    categories: ['saas', 'startup', 'tech'],
    pricing: 'free',
    requiresLogin: true,
    captchaType: null,
    fields: ['name', 'url', 'tagline', 'description', 'mrr']
  },
  {
    id: 'aitooltek',
    name: 'AI Tool Trek',
    url: 'https://aitooltrek.com/',
    submitUrl: 'https://aitooltrek.com/submit',
    dr: 49,
    traffic: '4k',
    categories: ['ai', 'tech'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description', 'category']
  },
  {
    id: 'launchedsite',
    name: 'Launched Site',
    url: 'https://launched.site/',
    submitUrl: 'https://launched.site/',
    dr: 45,
    traffic: '10k',
    categories: ['startup', 'tech', 'product'],
    pricing: 'free',
    requiresLogin: true,
    captchaType: null,
    fields: ['name', 'url', 'tagline', 'description']
  },
  {
    id: 'botsfloor',
    name: 'BotsFloor',
    url: 'https://botsfloor.com/',
    submitUrl: 'https://botsfloor.com/submit',
    dr: 41,
    traffic: '1k',
    categories: ['ai', 'bots', 'tech'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description', 'platform']
  },
  {
    id: 'detectortools',
    name: 'DetectorTools',
    url: 'https://detectortools.ai/',
    submitUrl: 'https://detectortools.ai/submit-tool/',
    dr: 37,
    traffic: '4k',
    categories: ['ai', 'tech'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description', 'category']
  },
  {
    id: 'wavel',
    name: 'Wavel',
    url: 'https://www.wavel.io/',
    submitUrl: 'https://www.wavel.io/submit-tool',
    dr: 34,
    traffic: '12k',
    categories: ['ai', 'tech', 'audio'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description']
  },
  {
    id: 'simplelister',
    name: 'Simple Lister',
    url: 'https://simplelister.com/',
    submitUrl: 'https://simplelister.com/submit',
    dr: 30,
    traffic: '9k',
    categories: ['startup', 'tech', 'product'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'tagline', 'description']
  },
  {
    id: 'indiehunt',
    name: 'IndieHunt',
    url: 'https://indiehunt.io/',
    submitUrl: 'https://indiehunt.io/submit',
    dr: 21,
    traffic: '500',
    categories: ['indie', 'startup', 'tech'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'tagline', 'description', 'maker']
  },
  {
    id: 'saasbaba',
    name: 'SaasBaba',
    url: 'https://saasbaba.com/',
    submitUrl: 'https://saasbaba.com/add-ai-tool/',
    dr: 10,
    traffic: '9k',
    categories: ['saas', 'ai', 'tech'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description', 'category', 'logo']
  },
  {
    id: 'freeaitools',
    name: 'Free AI Tools',
    url: 'https://free-ai-tools-directory.com/',
    submitUrl: 'https://free-ai-tools-directory.com/submit-request/',
    dr: 12,
    traffic: '23k',
    categories: ['ai', 'tech', 'free'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description', 'category']
  },
  {
    id: 'theaigeneration',
    name: 'The AI Generation',
    url: 'https://www.theaigeneration.com/',
    submitUrl: 'https://www.theaigeneration.com/add/',
    dr: 7,
    traffic: '77k',
    categories: ['ai', 'tech'],
    pricing: 'free',
    requiresLogin: false,
    captchaType: null,
    fields: ['name', 'url', 'description']
  }
];

// Category definitions (this IS exposed to clients)
const categories = {
  crypto: { name: 'Crypto & Web3', description: 'Blockchain, DeFi, NFT projects' },
  tech: { name: 'Technology', description: 'Software, apps, developer tools' },
  ai: { name: 'AI & ML', description: 'Artificial intelligence, machine learning' },
  startup: { name: 'Startups', description: 'New ventures, indie projects' },
  saas: { name: 'SaaS', description: 'Software as a service products' },
  fintech: { name: 'Fintech', description: 'Financial technology' },
  product: { name: 'Product', description: 'Consumer products, e-commerce' },
  fashion: { name: 'Fashion', description: 'Apparel, accessories, style' },
  opensource: { name: 'Open Source', description: 'OSS projects' },
  agents: { name: 'AI Agents', description: 'Autonomous agents, bots' },
  indie: { name: 'Indie', description: 'Independent makers, bootstrapped' }
};

/**
 * Match directories to client categories (INTERNAL)
 * @param {string[]} clientCategories - Categories client selected
 * @returns {object[]} Matched directories (internal use only)
 */
function matchDirectories(clientCategories) {
  return directories.filter(dir => 
    dir.categories.some(cat => clientCategories.includes(cat))
  ).sort((a, b) => b.dr - a.dr); // Sort by DR descending
}

/**
 * Get category list (EXPOSED to clients)
 */
function getCategories() {
  return categories;
}

/**
 * Get match count without exposing directories (EXPOSED)
 */
function getMatchCount(clientCategories) {
  const matched = matchDirectories(clientCategories);
  return {
    total: matched.length,
    free: matched.filter(d => d.pricing === 'free').length,
    paid: matched.filter(d => d.pricing !== 'free').length,
    avgDR: Math.round(matched.reduce((sum, d) => sum + d.dr, 0) / matched.length)
  };
}

/**
 * Get directory by ID (INTERNAL)
 */
function getDirectory(id) {
  return directories.find(d => d.id === id);
}

/**
 * Get all directories (INTERNAL - never expose via API)
 */
function getAllDirectories() {
  return directories;
}

module.exports = {
  matchDirectories,      // INTERNAL
  getCategories,         // PUBLIC
  getMatchCount,         // PUBLIC  
  getDirectory,          // INTERNAL
  getAllDirectories      // INTERNAL
};
