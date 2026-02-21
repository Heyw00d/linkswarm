/**
 * LinkSwarm Discord Community Bot
 * - Welcomes new members
 * - Answers questions about LinkSwarm
 * - HTTP API for message relay
 */

const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const http = require('http');

// Mission Control API
const MC_API = 'https://mission-control-api.viewfi-analytics-prod.workers.dev';
const MC_KEY = 'mc-api-key-2026';
const HTTP_PORT = 3848;

async function logToMC(message) {
  try {
    await fetch(`${MC_API}/api/chat`, {
      method: 'POST',
      headers: {
        'X-API-Key': MC_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'linkswarm-bot',
        text: message,
        type: 'agent'
      })
    });
  } catch (err) {
    console.error('Failed to log to MC:', err.message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// LinkSwarm knowledge base for answering questions
const LINKSWARM_INFO = {
  what: `**LinkSwarm** is an autonomous backlink exchange network where websites trade high-quality backlinks fairly and transparently.

🔗 **How it works:**
1. Register your site at linkswarm.ai/register
2. Your AI agent verifies domain ownership
3. Browse matching opportunities in the network
4. Exchange backlinks with compatible sites
5. Track your backlink portfolio

No manual outreach. No shady deals. Just fair link exchanges between verified sites.`,

  pricing: `**LinkSwarm Pricing:**
• **Free tier** — 3 sites, 5 exchanges/month
• **Pro ($29/mo)** — 25 sites, 50 exchanges/month, priority matching
• **Agency ($99/mo)** — Unlimited sites & exchanges, white-label, API access

All plans include verification, matching algorithm, and placement tracking.
👉 Upgrade at https://linkswarm.ai/dashboard`,

  register: `**To register your site:**
1. Go to https://linkswarm.ai/register
2. Enter your email and domain
3. Verify your email (check inbox!)
4. Add DNS TXT record or meta tag to verify ownership
5. Once verified, you'll appear in the network!

Takes about 2 minutes. Your site starts matching immediately. 🚀`,

  benefits: `**Why use LinkSwarm?**
✅ Automated matching — AI finds relevant sites
✅ Fair exchange — 1:1 link trades
✅ Quality control — All sites verified
✅ Track everything — See which links are live
✅ Save time — No cold outreach needed
✅ LLM visibility — Backlinks boost AI citations
✅ Credit system — Earn credits by giving links

Better than manual outreach, safer than PBNs! 🐝`,

  stats: `**Network Stats:**
• 19+ verified sites
• Multiple niches (crypto, fintech, SaaS, real estate, AI tools)
• Growing daily!

Join at https://linkswarm.ai/register`,

  credits: `**How Credits Work:**
• **Earn credits** by adding links to other sites
• **Spend credits** to request links to your site
• **1 credit = 1 link exchange**
• Start with 0 credits — contribute first to earn!

💡 **Tip:** You also get **3 free credits** for each person you refer!
Share your referral link from the dashboard.`,

  verification: `**How to Verify Your Site:**

**Option 1 — DNS TXT Record (recommended):**
Add a TXT record to your domain:
\`linkswarm-verify=YOUR_TOKEN\`

**Option 2 — HTML Meta Tag:**
Add to your homepage \`<head>\`:
\`<meta name="linkswarm-verify" content="YOUR_TOKEN">\`

Find your verification token in the dashboard after adding your site.
Usually takes 1-5 minutes to verify! ✅`,

  api: `**LinkSwarm API:**
Full REST API for automation and integrations.

📚 **Docs:** https://linkswarm.ai/docs/api/
🔑 **Get your API key:** Dashboard → Settings → API Key

**Popular endpoints:**
• \`GET /v1/sites\` — List your sites
• \`POST /v1/sites\` — Add a new site
• \`GET /v1/discover\` — Find link partners
• \`POST /v1/pool/contribute\` — Offer a link slot
• \`POST /v1/pool/request\` — Request a backlink

Pro & Agency plans get higher rate limits.`,

  llm: `**LLM Readiness & AI Visibility:**
Backlinks help your site get cited by AI models like ChatGPT, Claude, and Perplexity!

🤖 **Check your LLM Readiness score:**
Dashboard → Your Sites → Click "LLM Readiness"

**What we check:**
• llms.txt file
• Schema.org markup
• ai.txt file
• agent.json
• Domain authority
• Keyword rankings

Higher scores = more likely to be cited by AI! 📈`,

  referral: `**Referral Program:**
Earn **3 credits** for every person you refer! 🎁

**How it works:**
1. Get your unique referral link from the dashboard
2. Share it with friends, on social, in communities
3. When they sign up and verify their email → you get 3 credits!

No limit on referrals. The more you share, the more you earn! 🚀`,

  support: `**Need Help?**
• 💬 Ask here in Discord — we're friendly!
• 📧 Email: hello@linkswarm.ai
• 🐦 Twitter: @Link_Swarm
• 📚 Docs: https://linkswarm.ai/docs/

For account issues, email us with your registered email address.`,

  reciprocal: `**Are these reciprocal links?**
**No!** LinkSwarm uses a **triangular exchange** system:

• You give a link to Site A
• You receive a link from Site B (different site!)

This keeps link profiles natural and avoids the "reciprocal link" penalty that search engines watch for. Much safer! ✅`,

  quality: `**How do you ensure quality?**
Every site in the network is:

✅ **Verified** — Domain ownership confirmed
✅ **Scanned** — Checked for spam/prohibited content
✅ **Scored** — Quality metrics from DataForSEO
✅ **Matched** — Only paired with relevant sites

Low-quality or spammy sites get rejected. We keep the network clean! 🧹`,

  safe: `**Is LinkSwarm safe for SEO?**
Yes! Here's why:

✅ **No reciprocal links** — Triangular exchanges only
✅ **Relevant matches** — Sites matched by niche/category
✅ **Natural anchor text** — Varied, contextual anchors
✅ **Quality control** — All sites verified & scanned
✅ **Gradual growth** — Not 1000 links overnight

We follow SEO best practices. Much safer than PBNs or link farms! 🛡️`,

  niche: `**What niches are in the network?**
Current categories include:
• 💰 Crypto & DeFi
• 🏦 Fintech & Banking
• 🤖 AI & SaaS tools
• 🏠 Real Estate
• 📊 Analytics
• 🎮 Gaming
• 📝 Blogs & Content

More niches joining daily! Register your site to expand your category. 🌐`,

  dashboard: `**Dashboard Features:**
• 📊 View your sites & stats
• 🔍 Discover link partners
• 💰 Track credits & transactions
• 🔗 Manage exchanges
• 🤖 Check LLM Readiness scores
• 🎁 Get your referral link
• ⚙️ API key & settings

👉 https://linkswarm.ai/dashboard`
};

// Welcome message for new members
const WELCOME_EMBED = new EmbedBuilder()
  .setColor(0x10B981)
  .setTitle('🐝 Welcome to LinkSwarm!')
  .setDescription(`Hey there! Welcome to the LinkSwarm community.

**What is LinkSwarm?**
An autonomous backlink exchange network where websites trade high-quality links fairly.

**Quick Start:**
1. Register at [linkswarm.ai/register](https://linkswarm.ai/register)
2. Verify your domain
3. Start exchanging links!

**Channels:**
• #general — Chat with the community
• #exchanges — See live link exchanges
• #signups — New member announcements
• #support — Get help

Feel free to ask questions — I'm here to help! 🐝`)
  .setFooter({ text: 'LinkSwarm • Fair link exchanges' });

// Detect questions and respond
function detectQuestion(content) {
  const lower = content.toLowerCase();
  
  // What is LinkSwarm
  if (lower.includes('what is linkswarm') || lower.includes('what does linkswarm') || lower.includes('how does linkswarm work') || lower.includes('explain linkswarm')) {
    return LINKSWARM_INFO.what;
  }
  
  // Pricing
  if (lower.includes('price') || lower.includes('pricing') || lower.includes('cost') || lower.includes('how much') || lower.includes('plans') || lower.includes('subscription')) {
    return LINKSWARM_INFO.pricing;
  }
  
  // Registration
  if ((lower.includes('register') || lower.includes('sign up') || lower.includes('signup') || lower.includes('join') || lower.includes('get started') || lower.includes('create account')) && !lower.includes('referral')) {
    return LINKSWARM_INFO.register;
  }
  
  // Benefits
  if (lower.includes('why should') || lower.includes('benefit') || lower.includes('worth it') || lower.includes('why use') || lower.includes('advantages')) {
    return LINKSWARM_INFO.benefits;
  }
  
  // Stats
  if (lower.includes('stats') || lower.includes('how many sites') || lower.includes('network size') || lower.includes('how big')) {
    return LINKSWARM_INFO.stats;
  }
  
  // Credits
  if (lower.includes('credit') || lower.includes('earn') || lower.includes('points') || lower.includes('how do i get')) {
    return LINKSWARM_INFO.credits;
  }
  
  // Verification
  if (lower.includes('verify') || lower.includes('verification') || lower.includes('dns') || lower.includes('txt record') || lower.includes('meta tag') || lower.includes('prove ownership')) {
    return LINKSWARM_INFO.verification;
  }
  
  // API
  if (lower.includes('api') || lower.includes('integrate') || lower.includes('automation') || lower.includes('programmatic') || lower.includes('endpoint')) {
    return LINKSWARM_INFO.api;
  }
  
  // LLM / AI visibility
  if (lower.includes('llm') || lower.includes('chatgpt') || lower.includes('claude') || lower.includes('ai visibility') || lower.includes('ai citation') || lower.includes('perplexity') || lower.includes('readiness')) {
    return LINKSWARM_INFO.llm;
  }
  
  // Referral
  if (lower.includes('referral') || lower.includes('refer a friend') || lower.includes('invite') || lower.includes('share link')) {
    return LINKSWARM_INFO.referral;
  }
  
  // Support
  if (lower.includes('help') || lower.includes('support') || lower.includes('contact') || lower.includes('email') || lower.includes('stuck') || lower.includes('issue')) {
    return LINKSWARM_INFO.support;
  }
  
  // Reciprocal links
  if (lower.includes('reciprocal') || lower.includes('link back') || lower.includes('exchange directly') || lower.includes('two-way')) {
    return LINKSWARM_INFO.reciprocal;
  }
  
  // Quality
  if (lower.includes('quality') || lower.includes('spam') || lower.includes('trust') || lower.includes('legitimate') || lower.includes('scam')) {
    return LINKSWARM_INFO.quality;
  }
  
  // Safety / SEO safe
  if (lower.includes('safe') || lower.includes('penalty') || lower.includes('google') || lower.includes('risk') || lower.includes('pbn') || lower.includes('black hat')) {
    return LINKSWARM_INFO.safe;
  }
  
  // Niches
  if (lower.includes('niche') || lower.includes('categories') || lower.includes('what sites') || lower.includes('industry') || lower.includes('type of sites')) {
    return LINKSWARM_INFO.niche;
  }
  
  // Dashboard
  if (lower.includes('dashboard') || lower.includes('where do i') || lower.includes('how do i see') || lower.includes('manage') || lower.includes('settings')) {
    return LINKSWARM_INFO.dashboard;
  }
  
  return null;
}

// Recent messages cache (last 100)
const recentMessages = [];
const MAX_MESSAGES = 100;

// Bot ready
client.once(Events.ClientReady, (c) => {
  console.log(`🐝 LinkSwarm Bot ready! Logged in as ${c.user.tag}`);
  
  // Start HTTP server for message relay
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
    
    // GET /messages - fetch recent messages
    if (url.pathname === '/messages' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const channelName = url.searchParams.get('channel');
      
      let filtered = recentMessages;
      if (channelName) {
        filtered = recentMessages.filter(m => m.channel.toLowerCase().includes(channelName.toLowerCase()));
      }
      
      res.end(JSON.stringify({
        count: filtered.length,
        messages: filtered.slice(-limit).reverse()
      }));
      return;
    }
    
    // GET /channels - list channels
    if (url.pathname === '/channels' && req.method === 'GET') {
      const channels = [];
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(ch => {
          if (ch.type === 0) { // Text channel
            channels.push({ id: ch.id, name: ch.name, guild: guild.name });
          }
        });
      });
      res.end(JSON.stringify({ channels }));
      return;
    }
    
    // POST /send - send a message
    if (url.pathname === '/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { channelId, message } = JSON.parse(body);
          const channel = client.channels.cache.get(channelId);
          if (!channel) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Channel not found' }));
            return;
          }
          const sent = await channel.send(message);
          res.end(JSON.stringify({ success: true, messageId: sent.id }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    
    // GET /guilds - list guilds
    if (url.pathname === '/guilds' && req.method === 'GET') {
      const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount }));
      res.end(JSON.stringify({ guilds }));
      return;
    }
    
    // POST /channels/create - create a new channel
    if (url.pathname === '/channels/create' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { guildId, name, type, private: isPrivate } = JSON.parse(body);
          const guild = client.guilds.cache.get(guildId);
          if (!guild) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Guild not found' }));
            return;
          }
          const channel = await guild.channels.create({
            name: name,
            type: type === 'voice' ? 2 : 0, // 0 = text, 2 = voice
            permissionOverwrites: isPrivate ? [
              { id: guild.roles.everyone.id, deny: ['ViewChannel'] }
            ] : []
          });
          res.end(JSON.stringify({ success: true, channelId: channel.id, name: channel.name }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    
    // Health check
    if (url.pathname === '/health') {
      res.end(JSON.stringify({ status: 'ok', guilds: client.guilds.cache.size }));
      return;
    }
    
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`📡 HTTP relay server running on http://127.0.0.1:${HTTP_PORT}`);
  });
});

// Welcome new members
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`New member joined: ${member.user.tag}`);
  
  // Log to Mission Control
  await logToMC(`🆕 New Discord member: ${member.user.tag}`);
  
  // Try to find a welcome/general channel
  const welcomeChannel = member.guild.channels.cache.find(
    ch => ch.name.includes('welcome') || ch.name.includes('general')
  );
  
  if (welcomeChannel) {
    try {
      await welcomeChannel.send({
        content: `Hey <@${member.id}>! 👋`,
        embeds: [WELCOME_EMBED]
      });
      await logToMC(`👋 Welcomed ${member.user.tag} in Discord`);
    } catch (err) {
      console.error('Failed to send welcome:', err.message);
    }
  }
});

// Handle all messages
client.on(Events.MessageCreate, async (message) => {
  // Ignore bots
  if (message.author.bot) return;
  if (!message.guild) return;
  
  const content = message.content;
  
  // Cache message for relay
  recentMessages.push({
    id: message.id,
    author: message.author.tag,
    authorId: message.author.id,
    content: content,
    channel: message.channel.name,
    channelId: message.channel.id,
    guild: message.guild.name,
    timestamp: message.createdAt.toISOString()
  });
  
  // Trim cache
  while (recentMessages.length > MAX_MESSAGES) {
    recentMessages.shift();
  }
  
  // Log all messages to MC for visibility
  await logToMC(`[#${message.channel.name}] ${message.author.tag}: ${content.substring(0, 200)}`);
  
  // Check if bot is mentioned or message contains a question
  const isMentioned = message.mentions.has(client.user);
  const isQuestion = content.includes('?');
  
  if (isMentioned || isQuestion) {
    const answer = detectQuestion(content);
    
    if (answer) {
      try {
        await message.reply(answer);
        await logToMC(`💬 Answered question from ${message.author.tag}: "${content.substring(0, 50)}..."`);
      } catch (err) {
        console.error('Failed to reply:', err.message);
      }
    }
  }
});

// Login
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not set!');
  console.log('Set it with: export DISCORD_BOT_TOKEN=your_token');
  process.exit(1);
}

client.login(token);
